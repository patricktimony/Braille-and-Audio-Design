"""Everything the patron can do, independent of the window toolkit.

The UI passes in logical key names (see keymap.py) and calls tick() about
ten times a second.  Slow work (finding scanners, scanning, OCR) goes
through run_job(fn, on_done, on_error), which the UI runs on a background
thread; the callbacks come back on the UI thread.
"""

import logging
import os
import time

from .document import Page
from .keymap import LAYOUT_LAPTOP, LAYOUT_NUMPAD, Action, action_for, help_text
from .ocr import OcrError
from .scanners import ScannerError

log = logging.getLogger(__name__)

SETUP = "setup"
IDLE = "idle"
READING = "reading"
BUSY = "busy"
CHOOSING = "choosing"
CONFIRM_QUIT = "confirm_quit"
EXITING = "exiting"

FORWARD = {Action.NEXT_WORD, Action.NEXT_LINE, Action.NEXT_PAGE}
BACKWARD = {Action.PREV_WORD, Action.PREV_LINE, Action.PREV_PAGE}

SETUP_PROMPT = (
    "Welcome to Talking Scanner. First, choose your keys. "
    "If your keyboard has a number pad, press the Enter key at the bottom right of the number pad. "
    "Otherwise, press the main Enter key."
)


class Controller:
    STILL_WORKING_SECONDS = 10
    EXIT_TIMEOUT_SECONDS = 8

    def __init__(self, speaker, scanners, ocr, session, settings, run_job,
                 on_change=None, on_exit=None, clock=time.monotonic, keyboard_tip=None):
        self.speaker = speaker
        self.scanners = scanners
        self.ocr = ocr
        self.session = session
        self.settings = settings
        self.run_job = run_job
        self.on_change = on_change or (lambda: None)
        self.on_exit = on_exit or (lambda: None)
        self.clock = clock
        # keyboard_tip(numpad_layout) -> extra spoken advice, e.g. when JAWS takes the number pad.
        self.keyboard_tip = keyboard_tip or (lambda numpad_layout: "")
        self.state = IDLE
        self.status = ""
        self.device = None
        self._choices = []
        self._choice = 0
        self._busy_label = ""
        self._busy_announced = 0.0
        self._run = None  # (page index, start char, prefix length) of the current reading
        self._exit_deadline = 0.0
        self._exited = False

    @property
    def book(self):
        return self.session.book

    # -- speech helpers ---------------------------------------------------
    def _say(self, text):
        self.status = text
        self.speaker.say(text)
        self.on_change()

    def _scan_key(self):
        return "number pad Enter" if self.settings["layout"] == LAYOUT_NUMPAD else "Enter"

    def _tip(self):
        tip = self.keyboard_tip(self.settings["layout"] == LAYOUT_NUMPAD)
        return f" {tip}" if tip else ""

    def _keys(self, numpad, laptop):
        return numpad if self.settings["layout"] == LAYOUT_NUMPAD else laptop

    # -- start ------------------------------------------------------------
    def start(self):
        if self.settings["layout"] is None:
            self.state = SETUP
            self._say(SETUP_PROMPT)
            return
        message = (
            f"Talking Scanner ready. Place a page face down on the scanner glass "
            f"and press {self._scan_key()}. Press F1 for help."
        )
        try:
            self.ocr.check()
        except OcrError as exc:
            message = exc.spoken + " " + message
        self._say(message + self._tip())

    # -- keys -------------------------------------------------------------
    def handle_key(self, key_name):
        """Handle a logical key.  Returns False if the key is not ours (let it pass)."""
        action = action_for(key_name)
        if action is None or self.state == EXITING:
            return action is not None
        if self.state == SETUP:
            return self._setup_key(key_name, action)
        if self.state == CONFIRM_QUIT:
            return self._confirm_key(action)
        if self.state == CHOOSING:
            return self._choose_key(action)
        if action in (Action.YES, Action.NO):
            return False
        if self.state == BUSY:
            self._say(f"Please wait. {self._busy_label.capitalize()}.")
            return True
        {
            Action.SCAN: self.scan,
            Action.PLAY_PAUSE: self.play_pause,
            Action.PREV_WORD: lambda: self._word(-1),
            Action.NEXT_WORD: lambda: self._word(1),
            Action.PREV_LINE: lambda: self._line(-1),
            Action.NEXT_LINE: lambda: self._line(1),
            Action.PREV_PAGE: lambda: self._page(-1),
            Action.NEXT_PAGE: lambda: self._page(1),
            Action.HELP: self.help,
            Action.QUIT: self.request_quit,
        }[action]()
        return True

    def _setup_key(self, key_name, action):
        if key_name in ("NUMPAD_ENTER", "ENTER"):
            layout = LAYOUT_NUMPAD if key_name == "NUMPAD_ENTER" else LAYOUT_LAPTOP
            self.settings["layout"] = layout
            self.state = IDLE
            chosen = "Number pad keys chosen. " if layout == LAYOUT_NUMPAD else "Main keyboard keys chosen. "
            self._say(
                chosen + help_text(layout)
                + f" Now place a page face down on the scanner glass and press {self._scan_key()}."
                + self._tip()
            )
        elif action == Action.QUIT:
            self.request_quit()
        else:
            self._say(SETUP_PROMPT)
        return True

    # -- reading ----------------------------------------------------------
    def _track(self):
        """Move the cursor to the word the speaker is currently saying."""
        if self.state != READING or self._run is None:
            return
        page_index, start, prefix = self._run
        pos = self.speaker.position()
        if pos is None or pos < prefix or page_index != self.book.page:
            return
        self.book.word = self.book.current.word_at_char(start + pos - prefix)

    def _stop_reading(self):
        if self.state == READING:
            self._track()
            self.speaker.stop()
            self.state = IDLE
            self._run = None
            self.session.save()

    def _read(self, prefix=""):
        page = self.book.current
        start = page.char_of_word(self.book.word)
        self._run = (self.book.page, start, len(prefix))
        self.state = READING
        self.status = f"Reading page {self.book.page + 1} of {len(self.book)}"
        self.speaker.say(prefix + page.text[start:])
        self.on_change()

    def _page_finished(self):
        self.book.word = len(self.book.current.words)
        self._run = None
        if self.book.next_page():
            self._read(f"Page {self.book.page + 1}. ")
        else:
            self.state = IDLE
            self.session.save()
            self._say(
                f"End of page {self.book.page + 1}, the last page. "
                f"To read more, place the next page on the glass and press {self._scan_key()}."
            )

    def play_pause(self):
        if self.state == READING:
            self._stop_reading()
            self._say("Paused.")
            return
        if not len(self.book):
            self._say(f"No pages yet. Place a page face down on the scanner glass and press {self._scan_key()}.")
            return
        if self.book.at_end_of_page():
            if self.book.next_page():
                self._read(f"Page {self.book.page + 1}. ")
            else:
                self._say(
                    f"End of the last page. Use {self._keys('number pad 7', 'Page up')} "
                    f"to go back, or press {self._scan_key()} to scan another page."
                )
            return
        self._read()

    def _need_pages(self):
        if not len(self.book):
            self._say(f"No pages yet. Place a page face down on the scanner glass and press {self._scan_key()}.")
            return True
        return False

    def _word(self, step):
        if self._need_pages():
            return
        self._stop_reading()
        moved = self.book.next_word() if step > 0 else self.book.prev_word()
        if moved:
            self._say(self.book.current.word_text(self.book.word))
        else:
            self._say("End of page." if step > 0 else "Top of page.")
        self.session.save()

    def _line(self, step):
        if self._need_pages():
            return
        was_reading = self.state == READING
        self._stop_reading()
        moved = self.book.next_line() if step > 0 else self.book.prev_line()
        if not moved:
            self._say("Last line of the page." if step > 0 else "First line of the page.")
        elif was_reading:
            self._read()
        else:
            self._say(self.book.current_line_text())
        self.session.save()

    def _page(self, step):
        if self._need_pages():
            return
        was_reading = self.state == READING
        self._stop_reading()
        moved = self.book.next_page() if step > 0 else self.book.prev_page()
        total = len(self.book)
        if not moved:
            self._say(f"This is the {'last' if step > 0 else 'first'} page, page {self.book.page + 1} of {total}.")
        elif was_reading:
            self._read(f"Page {self.book.page + 1} of {total}. ")
        else:
            self._say(f"Page {self.book.page + 1} of {total}.")
        self.session.save()

    def help(self):
        self._stop_reading()
        layout = self.settings["layout"] or LAYOUT_LAPTOP
        where = ""
        if len(self.book):
            where = f" You have {len(self.book)} pages and are on page {self.book.page + 1}."
        self._say(help_text(layout) + where + self._tip())

    # -- scanning ---------------------------------------------------------
    def _busy(self, label):
        self.state = BUSY
        self._busy_label = label
        self._busy_announced = self.clock()
        self._say(label.capitalize() + ".")

    def _pick_device(self, devices):
        if self.device and any(d.key == self.device.key for d in devices):
            return self.device
        saved = self.settings["scanner"]
        for d in devices:
            if d.key == saved:
                return d
        if len(devices) == 1:
            return devices[0]
        return None

    def scan(self):
        self._stop_reading()
        self._busy("scanning")
        out_path = self.session.new_image_path()
        dpi = self.settings["dpi"] or 300

        def job():
            devices = self.scanners.discover()
            if not devices:
                raise ScannerError(
                    f"No scanner was found. Check that the scanner is plugged in and switched on, "
                    f"then press {self._scan_key()} to try again.",
                    "not_found",
                )
            device = self._pick_device(devices)
            if device is None:
                return ("choose", devices)
            return ("scanned", device, self.scanners.scan(device, out_path, dpi))

        self.run_job(job, self._scan_done, self._job_failed)

    def _scan_with(self, device):
        self._busy("scanning")
        out_path = self.session.new_image_path()
        dpi = self.settings["dpi"] or 300
        self.run_job(
            lambda: ("scanned", device, self.scanners.scan(device, out_path, dpi)),
            self._scan_done,
            self._job_failed,
        )

    def _scan_done(self, result):
        if result[0] == "choose":
            self._start_choosing(result[1])
            return
        _, device, path = result
        self.device = device
        self._busy("recognizing text")
        self.run_job(lambda: self.ocr.recognize(path), lambda text: self._ocr_done(path, text), self._job_failed)

    def _ocr_done(self, path, text):
        page = Page(text, os.path.basename(path))
        if page.is_empty():
            try:
                os.remove(path)
            except OSError:
                pass
            self.state = IDLE
            self._say(
                "No text was found on this page. Check that the page is face down on the glass "
                f"and the lid is closed, then press {self._scan_key()} again."
            )
            return
        self.book.add_page(page)
        self.session.save()
        self._read(f"Reading page {len(self.book)}. ")

    def _job_failed(self, exc):
        self.state = IDLE
        if isinstance(exc, ScannerError):
            log.warning("Scanner error: %s %s", exc.kind, exc.detail)
            if exc.kind in ("disconnected", "not_found"):
                self.device = None
            self._say(exc.spoken)
        elif isinstance(exc, OcrError):
            log.warning("OCR error: %s", exc.detail)
            self._say(exc.spoken)
        else:
            log.exception("Unexpected error", exc_info=exc)
            self._say("Something went wrong while scanning. Please try again, or ask library staff for help.")

    # -- choosing a scanner -------------------------------------------------
    def _start_choosing(self, devices):
        self.state = CHOOSING
        self._choices = devices
        self._choice = 0
        self._say(
            f"{len(devices)} scanners found. Use the arrow keys to hear each one, "
            f"and press {self._scan_key()} to choose. " + self._choice_text()
        )

    def _choice_text(self):
        dev = self._choices[self._choice]
        return f"Scanner {self._choice + 1} of {len(self._choices)}: {dev.spoken()}."

    def _choose_key(self, action):
        if action in FORWARD or action in BACKWARD:
            step = 1 if action in FORWARD else -1
            self._choice = (self._choice + step) % len(self._choices)
            self._say(self._choice_text())
        elif action == Action.SCAN:
            device = self._choices[self._choice]
            self.settings["scanner"] = device.key
            self.device = device
            self._scan_with(device)
        elif action == Action.QUIT:
            self.state = IDLE
            self._say("No scanner chosen.")
        elif action in (Action.YES, Action.NO):
            return False
        else:
            self._say(self._choice_text() + f" Press {self._scan_key()} to choose it.")
        return True

    # -- quitting -----------------------------------------------------------
    def request_quit(self):
        """Ask before closing.  Returns True if the program may close now."""
        if self.state == EXITING:
            return True
        self._stop_reading()
        if self.state == BUSY:
            self._say(f"Please wait. {self._busy_label.capitalize()}.")
            return False
        if not len(self.book):
            self._exit("Goodbye.")
            return False
        self.state = CONFIRM_QUIT
        self._say(
            f"You have {len(self.book)} {'page' if len(self.book) == 1 else 'pages'}. "
            "Do you want to save them on this computer to read later? "
            "Press Y to save, or N to delete them. Press Escape to go back."
        )
        return False

    def _confirm_key(self, action):
        if action == Action.YES:
            try:
                self.session.save_book(self.settings["books_dir"])
            except OSError as exc:
                log.error("Saving failed: %s", exc)
                self._say("The book could not be saved. Press N to delete the pages, or Escape to go back.")
                return True
            self._exit(f"Saved {len(self.book)} pages in the Talking Scanner Books folder. Goodbye.")
        elif action == Action.NO:
            self._exit("Pages deleted. Goodbye.")
        elif action == Action.QUIT:
            self.state = IDLE
            self._say("Back to reading.")
        else:
            self._say("Press Y to save the pages, N to delete them, or Escape to go back.")
        return True

    def _exit(self, message):
        self.session.discard()
        self.state = EXITING
        self._exit_deadline = self.clock() + self.EXIT_TIMEOUT_SECONDS
        self._say(message)

    def shutdown(self):
        """Window or Windows is closing without the patron's answer: delete, never save."""
        self.speaker.stop()
        self.session.discard()

    # -- timer --------------------------------------------------------------
    def tick(self):
        if self.state == READING:
            self._track()
            if not self.speaker.is_busy():
                self._page_finished()
        elif self.state == BUSY:
            now = self.clock()
            if now - self._busy_announced >= self.STILL_WORKING_SECONDS and not self.speaker.is_busy():
                self._busy_announced = now
                self._say(f"Still {self._busy_label}.")
        elif self.state == EXITING and not self._exited:
            if not self.speaker.is_busy() or self.clock() >= self._exit_deadline:
                self._exited = True
                self.on_exit()
