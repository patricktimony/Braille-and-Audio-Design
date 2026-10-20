"""The window: native Windows controls (via wxPython) so Narrator can read it.

Keys are only received while this window has focus.  No global keyboard
hooks are installed, so other programs' shortcuts are never taken.  Keys
held with Ctrl, Alt, Shift or Windows are passed on untouched, and Narrator's
own keys (Caps Lock or Insert combinations) never reach the program.

The status line and the window title always show the last announcement,
so a Narrator user can press Narrator + T to hear it again.
"""

import sys
import threading

import wx

from . import APP_NAME
from .keymap import WX_KEYS, action_for


class KeyTester:
    """--key-test: speaks the name and action of every key pressed."""

    def __init__(self, speaker, on_change, on_exit):
        self.speaker, self.on_change, self.on_exit = speaker, on_change, on_exit
        self.status = ""
        self.book = None
        self.escapes = 0

    def _say(self, text):
        self.status = text
        self.speaker.say(text)
        self.on_change()

    def start(self):
        self._say("Key test. Press any key to hear its name and what it does. Press Escape twice to finish.")

    def handle_key(self, name):
        action = action_for(name)
        self.escapes = self.escapes + 1 if name == "ESCAPE" else 0
        if self.escapes >= 2:
            self.on_exit()
            return True
        spoken = name.replace("_", " ").lower()
        self._say(f"{spoken}: {action.value.replace('_', ' ') if action else 'not used'}")
        return action is not None

    def unknown_key(self, code):
        self._say(f"Key code {code}: not used")

    def tick(self):
        pass

    def request_quit(self):
        return True

    def shutdown(self):
        self.speaker.stop()


class MainFrame(wx.Frame):
    def __init__(self, build_controller, on_finish):
        super().__init__(None, title=APP_NAME, size=(900, 650))
        self._on_finish = on_finish
        self._closing = False
        self._shown_page = None
        self._codes = {getattr(wx, attr): name for attr, name in WX_KEYS.items() if hasattr(wx, attr)}

        panel = wx.Panel(self, style=wx.WANTS_CHARS, name=APP_NAME)
        big = wx.Font(wx.FontInfo(20))
        self.status = wx.StaticText(panel, label="Starting", name="Status")
        self.status.SetFont(big.Bold())
        self.text = wx.TextCtrl(panel, style=wx.TE_MULTILINE | wx.TE_READONLY, name="Page text")
        self.text.SetFont(big)
        sizer = wx.BoxSizer(wx.VERTICAL)
        sizer.Add(self.status, 0, wx.ALL | wx.EXPAND, 12)
        sizer.Add(self.text, 1, wx.ALL | wx.EXPAND, 12)
        panel.SetSizer(sizer)
        self.panel = panel

        self.controller = build_controller(run_job=self.run_job, on_change=self.refresh, on_exit=self.finish)
        self.Bind(wx.EVT_CHAR_HOOK, self.on_key)
        self.Bind(wx.EVT_CLOSE, self.on_close)
        self.Bind(wx.EVT_END_SESSION, self.on_end_session)
        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, lambda evt: self.controller.tick(), self.timer)
        self.timer.Start(100)
        self.Show()
        self.Raise()
        panel.SetFocus()
        wx.CallAfter(self.controller.start)

    # -- keyboard ---------------------------------------------------------
    def on_key(self, evt):
        if evt.ControlDown() or evt.AltDown() or evt.ShiftDown() or evt.MetaDown() or evt.RawControlDown():
            evt.Skip()
            return
        code = evt.GetKeyCode()
        name = self._codes.get(code)
        if name is None and code in (ord("Y"), ord("N")):
            name = chr(code)
        if name is not None and self.controller.handle_key(name):
            return
        if name is None and isinstance(self.controller, KeyTester):
            self.controller.unknown_key(code)
        evt.Skip()

    # -- background work ----------------------------------------------------
    def run_job(self, fn, on_done, on_error):
        def deliver(callback, value):
            if not self._closing:
                callback(value)

        def worker():
            com = None
            if sys.platform == "win32":
                import pythoncom

                pythoncom.CoInitialize()
                com = pythoncom
            try:
                result = fn()
            except Exception as exc:  # reported to the patron by on_error
                wx.CallAfter(deliver, on_error, exc)
            else:
                wx.CallAfter(deliver, on_done, result)
            finally:
                if com:
                    com.CoUninitialize()

        threading.Thread(target=worker, daemon=True).start()

    # -- display ------------------------------------------------------------
    def refresh(self):
        status = self.controller.status
        self.status.SetLabel(status)
        self.status.Wrap(self.panel.GetClientSize().width - 24)
        self.SetTitle(f"{APP_NAME}: {status[:100]}")
        book = self.controller.book
        if book is not None and len(book) and self._shown_page != (book.page, len(book)):
            self._shown_page = (book.page, len(book))
            self.text.SetValue(f"Page {book.page + 1} of {len(book)}\n\n{book.current.text}")
        self.panel.Layout()

    # -- closing --------------------------------------------------------------
    def on_close(self, evt):
        if self._closing or not evt.CanVeto():
            if not self._closing:
                self.controller.shutdown()
                self._closing = True
                self.timer.Stop()
                self._on_finish()
            evt.Skip()
            return
        if self.controller.request_quit():
            self.finish()
        else:
            evt.Veto()

    def on_end_session(self, evt):
        self.controller.shutdown()
        evt.Skip()

    def finish(self):
        if self._closing:
            return
        self._closing = True
        self.timer.Stop()
        self._on_finish()
        self.Destroy()


def run_app(build_controller, on_finish):
    app = wx.App(False)
    MainFrame(build_controller, on_finish)
    app.MainLoop()
