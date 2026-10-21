"""End-to-end behaviour through the keyboard, with a simulated scanner."""

import os

from conftest import SAMPLES, Clock, DeferredJobs, make_controller

from talking_scanner.controller import BUSY, CHOOSING, CONFIRM_QUIT, EXITING, IDLE, READING, SETUP
from talking_scanner.scanners import ScannerError, SimulatedBackend


def scan(c, key="NUMPAD_ENTER"):
    assert c.handle_key(key)


# -- first run --------------------------------------------------------------
def test_first_run_layout_choice_by_numpad_enter(home):
    c, sp, _ = make_controller(home, layout=None)
    c.start()
    assert c.state == SETUP and "number pad" in sp.last
    c.handle_key("SPACE")  # wrong key: prompt repeated, nothing else happens
    assert c.state == SETUP
    c.handle_key("NUMPAD_ENTER")
    assert c.settings["layout"] == "numpad" and c.state == IDLE
    assert "Number pad keys chosen" in sp.last and "number pad Enter" in sp.last
    assert len(c.book) == 0  # choosing keys does not scan


def test_first_run_layout_choice_by_main_enter(home):
    c, sp, _ = make_controller(home, layout=None)
    c.start()
    c.handle_key("ENTER")
    assert c.settings["layout"] == "laptop"
    assert "Space: play or pause" in sp.last


# -- scanning and announcements ----------------------------------------------
def test_scan_announces_scanning_recognizing_reading(home):
    c, sp, _ = make_controller(home)
    scan(c)
    assert sp.spoken[0] == "Scanning."
    assert sp.spoken[1] == "Recognizing text."
    assert sp.spoken[2].startswith("Reading page 1. Chapter One")
    assert c.state == READING


def test_pages_kept_in_order_and_saved_to_session(home):
    c, sp, _ = make_controller(home)
    for _ in range(3):
        scan(c)
    assert [p.lines[0] for p in c.book.pages] == ["Chapter One", "Chapter Two", "Chapter Three"]
    assert os.path.exists(os.path.join(c.session.dir, "session.json"))
    images = sorted(f for f in os.listdir(c.session.dir) if f.endswith(".png"))
    assert images == ["scan-001.png", "scan-002.png", "scan-003.png"]


def test_blank_page_is_reported_and_not_added(home):
    from conftest import FakeOcr

    c, sp, _ = make_controller(home, ocr=FakeOcr(["   \n  "]))
    scan(c)
    assert "No text was found" in sp.last
    assert len(c.book) == 0 and c.state == IDLE


# -- pause, resume, interruption -----------------------------------------------
def test_pause_remembers_word_and_resume_continues_there(home):
    c, sp, _ = make_controller(home)
    scan(c)
    sp.speak_up_to("borrow")
    c.tick()
    assert c.handle_key("NUMPAD5")  # pause, Num Lock on
    assert sp.last == "Paused." and c.state == IDLE
    assert c.book.current.word_text(c.book.word) == "borrow"
    c.handle_key("NUMPAD_CLEAR")  # resume, Num Lock off
    assert c.state == READING
    assert sp.last.startswith("borrow twenty books.")


def test_pause_without_tick_still_captures_position(home):
    c, sp, _ = make_controller(home)
    scan(c, "ENTER")
    sp.speak_up_to("desk")
    c.handle_key("SPACE")
    assert c.book.current.word_text(c.book.word) == "desk."


def test_word_navigation_interrupts_and_speaks_word(home):
    c, sp, _ = make_controller(home)
    scan(c)
    sp.speak_up_to("opens")
    stops = sp.stops
    c.handle_key("NUMPAD6")
    assert sp.stops > stops and c.state == IDLE
    assert sp.last == "at"
    c.handle_key("NUMPAD_LEFT")
    c.handle_key("LEFT")
    assert sp.last == "library"


def test_line_navigation_while_reading_keeps_reading(home):
    c, sp, _ = make_controller(home)
    scan(c)
    sp.speak_up_to("opens")
    c.handle_key("NUMPAD2")
    assert c.state == READING and sp.last.startswith("Patrons may borrow")
    c.handle_key("NUMPAD_UP")
    assert c.state == READING and sp.last.startswith("The library opens")


def test_line_navigation_while_paused_speaks_one_line(home):
    c, sp, _ = make_controller(home)
    scan(c)
    c.handle_key("SPACE")  # pause
    c.handle_key("DOWN")
    assert sp.last == "The library opens at nine." and c.state == IDLE
    c.handle_key("DOWN")
    c.handle_key("DOWN")
    c.handle_key("DOWN")
    assert sp.last == "Last line of the page."


def test_page_navigation(home):
    c, sp, _ = make_controller(home)
    for _ in range(3):
        scan(c)
    c.handle_key("NUMPAD5")  # pause on page 3
    c.handle_key("NUMPAD7")
    assert sp.last == "Page 2 of 3." and c.book.page == 1
    c.handle_key("NUMPAD_HOME")
    assert sp.last == "Page 1 of 3."
    c.handle_key("PAGEUP")
    assert "first page" in sp.last
    c.handle_key("NUMPAD9")
    c.handle_key("NUMPAD_PAGEUP")
    c.handle_key("PAGEDOWN")
    assert "last page" in sp.last and c.book.page == 2
    # while reading, page keys keep reading on the new page
    c.handle_key("SPACE")
    c.handle_key("PAGEUP")
    assert c.state == READING and sp.last.startswith("Page 2 of 3. Chapter Two")


def test_reading_continues_to_next_page_then_stops_at_last(home):
    c, sp, _ = make_controller(home)
    scan(c)
    scan(c)
    c.handle_key("PAGEUP")  # back to page 1, still reading
    assert c.state == READING and sp.last.startswith("Page 1 of 2. Chapter One")
    sp.finish()
    c.tick()
    assert c.book.page == 1 and sp.last.startswith("Page 2. Chapter Two")
    sp.finish()
    c.tick()
    assert c.state == IDLE and "the last page" in sp.last
    c.handle_key("SPACE")
    assert "End of the last page" in sp.last


def test_keys_before_any_scan_explain_what_to_do(home):
    c, sp, _ = make_controller(home)
    for key in ("NUMPAD5", "NUMPAD6", "NUMPAD8", "NUMPAD9"):
        c.handle_key(key)
        assert "No pages yet" in sp.last


def test_unmapped_keys_and_y_n_pass_through(home):
    c, sp, _ = make_controller(home)
    assert not c.handle_key("TAB")
    assert not c.handle_key("Y")
    assert not c.handle_key("N")


def test_help(home):
    c, sp, _ = make_controller(home)
    c.handle_key("F1")
    assert "Number pad Enter: scan and read" in sp.last


# -- busy state and progress announcements ---------------------------------------
def test_keys_during_scan_say_please_wait_and_progress_is_announced(home):
    jobs, clock = DeferredJobs(), Clock()
    c, sp, _ = make_controller(home, run_job=jobs, clock=clock)
    scan(c)
    assert c.state == BUSY
    c.handle_key("NUMPAD5")
    assert sp.last == "Please wait. Scanning."
    sp.finish()
    clock.now += 11
    c.tick()
    assert sp.last == "Still scanning."
    jobs.run_next()
    assert sp.last == "Recognizing text."
    sp.finish()
    clock.now += 11
    c.tick()
    assert sp.last == "Still recognizing text."
    jobs.run_next()
    assert c.state == READING


# -- scanner errors and selection ------------------------------------------------
def test_no_scanner_found(home):
    backend = SimulatedBackend([os.path.join(SAMPLES, "page1.png")])
    backend.connected = False
    c, sp, _ = make_controller(home, backend=backend)
    scan(c)
    assert sp.last.startswith("No scanner was found") and c.state == IDLE


def test_disconnect_is_reported_and_reconnect_works(home):
    c, sp, backend = make_controller(home)
    scan(c)
    assert c.device is not None
    backend.connected = False
    scan(c)
    assert "not connected" in sp.last or "No scanner was found" in sp.last
    assert c.device is None and len(c.book) == 1
    backend.connected = True
    scan(c)
    assert len(c.book) == 2


def test_driver_errors_are_spoken(home):
    c, sp, backend = make_controller(home)
    scan(c)
    backend.fail_next = ScannerError("The scanner lid is open. Close the lid, then press scan again.", "cover_open")
    scan(c)
    assert sp.last.startswith("The scanner lid is open")
    assert c.device is not None  # not forgotten for a lid error


def test_unexpected_errors_are_spoken(home):
    class Broken:
        def check(self):
            return "x"

        def recognize(self, path):
            raise RuntimeError("boom")

    c, sp, _ = make_controller(home, ocr=Broken())
    scan(c)
    assert "Something went wrong" in sp.last and c.state == IDLE


def test_multiple_scanners_spoken_choice_is_remembered(home):
    backend = SimulatedBackend([os.path.join(SAMPLES, "page1.png")], device_names=("Epson V39", "HP ScanJet"))
    c, sp, _ = make_controller(home, backend=backend)
    scan(c)
    assert c.state == CHOOSING
    assert "2 scanners found" in sp.last and "Scanner 1 of 2: Epson V39, USB" in sp.last
    c.handle_key("NUMPAD2")
    assert sp.last == "Scanner 2 of 2: HP ScanJet, USB."
    c.handle_key("DOWN")
    assert sp.last.startswith("Scanner 1 of 2")
    c.handle_key("UP")
    c.handle_key("NUMPAD_ENTER")
    assert c.settings["scanner"] == "Simulated:sim1"
    assert len(c.book) == 1
    # a new run of the program remembers the choice
    c2, sp2, _ = make_controller(home, backend=backend)
    c2.settings["scanner"] = "Simulated:sim1"
    scan(c2)
    assert c2.state == READING and c2.device.name == "HP ScanJet"


# -- quitting and consent ----------------------------------------------------------
def test_quit_without_pages(home):
    c, sp, _ = make_controller(home)
    session_dir = c.session.dir
    c.handle_key("ESCAPE")
    assert c.state == EXITING and sp.last == "Goodbye."
    assert not os.path.exists(session_dir)
    sp.finish()
    c.tick()
    assert c.exits == [True]


def test_quit_and_delete(home):
    c, sp, _ = make_controller(home)
    scan(c)
    session_dir = c.session.dir
    c.handle_key("ESCAPE")
    assert c.state == CONFIRM_QUIT and "Press Y to save" in sp.last
    c.handle_key("NUMPAD5")
    assert sp.last.startswith("Press Y to save")
    c.handle_key("N")
    assert sp.last == "Pages deleted. Goodbye."
    assert not os.path.exists(session_dir)
    assert not os.path.exists(home / "books")


def test_quit_and_save(home):
    c, sp, _ = make_controller(home)
    scan(c)
    scan(c)
    c.handle_key("ESCAPE")
    c.handle_key("Y")
    assert "Saved 2 pages" in sp.last
    (book,) = os.listdir(home / "books")
    folder = home / "books" / book
    text = (folder / "book.txt").read_text(encoding="utf-8")
    assert text.index("Chapter One") < text.index("Chapter Two")
    assert (folder / "scan-001.png").exists() and (folder / "session.json").exists()
    assert not os.path.exists(c.session.dir)


def test_escape_goes_back_from_quit_question(home):
    c, sp, _ = make_controller(home)
    scan(c)
    c.handle_key("ESCAPE")
    c.handle_key("ESCAPE")
    assert c.state == IDLE and sp.last == "Back to reading."


def test_refuses_to_save_into_onedrive(home):
    c, sp, _ = make_controller(home)
    c.settings["books_dir"] = str(home / "OneDrive" / "Documents")
    scan(c)
    c.handle_key("ESCAPE")
    c.handle_key("Y")
    assert "could not be saved" in sp.last and c.state == CONFIRM_QUIT
    assert not os.path.exists(home / "OneDrive")


def test_window_closed_by_windows_deletes_without_saving(home):
    c, sp, _ = make_controller(home)
    scan(c)
    c.shutdown()
    assert not os.path.exists(c.session.dir)
    assert not os.path.exists(home / "books")
