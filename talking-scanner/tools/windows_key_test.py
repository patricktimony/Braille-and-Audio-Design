"""Automated Windows keyboard test (Windows only).

Opens the real Talking Scanner window and types into it with SendInput,
using keyboard scan codes exactly as a physical keyboard sends them, with
Num Lock ON and then OFF.  Checks which key each press arrives as.

Usage:  python tools/windows_key_test.py      (do not touch the keyboard while it runs)
Exit code 0 = every key arrived as expected.
"""

import ctypes
import json
import os
import sys
import threading
import time
from ctypes import wintypes

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import wx  # noqa: E402

from talking_scanner.ui_wx import MainFrame  # noqa: E402

user32 = ctypes.WinDLL("user32", use_last_error=True)
ULONG_PTR = ctypes.c_size_t
KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE = 0x1, 0x2, 0x8
VK_NUMLOCK = 0x90


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD), ("wParamH", wintypes.WORD)]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _anonymous_ = ("u",)
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]


def _send(vk, scan, flags):
    inp = INPUT(type=1, ki=KEYBDINPUT(vk, scan, flags, 0, 0))
    if user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT)) != 1:
        raise OSError(ctypes.get_last_error(), "SendInput failed")


def press_scan(scan, extended=False):
    flags = KEYEVENTF_SCANCODE | (KEYEVENTF_EXTENDEDKEY if extended else 0)
    _send(0, scan, flags)
    _send(0, scan, flags | KEYEVENTF_KEYUP)


def num_lock_on():
    return bool(user32.GetKeyState(VK_NUMLOCK) & 1)


def set_num_lock(on):
    if num_lock_on() != on:
        _send(VK_NUMLOCK, 0x45, KEYEVENTF_EXTENDEDKEY)
        _send(VK_NUMLOCK, 0x45, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP)
        time.sleep(0.3)


# (label, scan code, extended, expected with Num Lock ON, expected with Num Lock OFF)
KEYS = [
    ("Numpad Enter", 0x1C, True, "NUMPAD_ENTER", "NUMPAD_ENTER"),
    ("Numpad 5", 0x4C, False, "NUMPAD5", ("NUMPAD_CLEAR", "NUMPAD_BEGIN")),
    ("Numpad 4", 0x4B, False, "NUMPAD4", "NUMPAD_LEFT"),
    ("Numpad 6", 0x4D, False, "NUMPAD6", "NUMPAD_RIGHT"),
    ("Numpad 8", 0x48, False, "NUMPAD8", "NUMPAD_UP"),
    ("Numpad 2", 0x50, False, "NUMPAD2", "NUMPAD_DOWN"),
    ("Numpad 7", 0x47, False, "NUMPAD7", "NUMPAD_HOME"),
    ("Numpad 9", 0x49, False, "NUMPAD9", "NUMPAD_PAGEUP"),
    ("Enter", 0x1C, False, "ENTER", "ENTER"),
    ("Space", 0x39, False, "SPACE", "SPACE"),
    ("Left arrow", 0x4B, True, "LEFT", "LEFT"),
    ("Right arrow", 0x4D, True, "RIGHT", "RIGHT"),
    ("Up arrow", 0x48, True, "UP", "UP"),
    ("Down arrow", 0x50, True, "DOWN", "DOWN"),
    ("Page Up", 0x49, True, "PAGEUP", "PAGEUP"),
    ("Page Down", 0x51, True, "PAGEDOWN", "PAGEDOWN"),
    ("F1", 0x3B, False, "F1", "F1"),
    ("Y", 0x15, False, "Y", "Y"),
    ("N", 0x31, False, "N", "N"),
]


class Recorder:
    status = ""
    book = None

    def __init__(self):
        self.received = []

    def start(self):
        pass

    def tick(self):
        pass

    def handle_key(self, name):
        self.received.append(name)
        return True

    def request_quit(self):
        return True

    def shutdown(self):
        pass


def main():
    app = wx.App(False)
    rec = Recorder()
    results = {"rows": [], "foreground": None}
    frame = MainFrame(lambda run_job, on_change, on_exit: rec, on_finish=lambda: None)

    def drive():
        time.sleep(1.5)
        hwnd = frame.GetHandle()
        user32.SetForegroundWindow(hwnd)
        time.sleep(0.5)
        results["foreground"] = user32.GetForegroundWindow() == hwnd
        original = num_lock_on()
        for state in (True, False):
            set_num_lock(state)
            for label, scan, ext, on, off in KEYS:
                before = len(rec.received)
                press_scan(scan, ext)
                time.sleep(0.25)
                got = rec.received[before:] if len(rec.received) > before else ["(nothing)"]
                expected = on if state else off
                ok = got[0] in (expected if isinstance(expected, tuple) else (expected,))
                results["rows"].append({"num_lock": state, "key": label, "received": got[0],
                                        "expected": expected, "ok": ok})
        set_num_lock(original)
        wx.CallAfter(frame.finish)

    threading.Thread(target=drive, daemon=True).start()
    app.MainLoop()

    print(f"Window had keyboard focus: {results['foreground']}")
    print(f"{'Num Lock':9}{'Key':14}{'Received':16}{'Expected':28}Result")
    for r in results["rows"]:
        print(f"{'ON' if r['num_lock'] else 'OFF':9}{r['key']:14}{r['received']:16}"
              f"{str(r['expected']):28}{'ok' if r['ok'] else 'FAIL'}")
    with open("key_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    failed = [r for r in results["rows"] if not r["ok"]]
    print(f"\n{len(results['rows']) - len(failed)} of {len(results['rows'])} key presses as expected")
    return 1 if failed or not results["rows"] else 0


if __name__ == "__main__":
    sys.exit(main())
