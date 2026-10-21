"""Which screen readers are running, and the keyboard advice that follows.

JAWS uses the number pad for its own commands while Num Lock is off (for
example number pad 5 says the current character), so those keys never
reach Talking Scanner.  With Num Lock on, or with the main keyboard keys,
every Talking Scanner key gets through.
"""

import subprocess
import sys

SCREEN_READERS = {"jfw.exe": "JAWS", "narrator.exe": "Narrator", "nvda.exe": "NVDA"}


def running_screen_readers():
    """Names of the screen readers running now, e.g. ["JAWS"].  Empty off Windows."""
    if sys.platform != "win32":
        return []
    try:
        flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        out = subprocess.run(["tasklist", "/FO", "CSV", "/NH"], capture_output=True, text=True,
                             timeout=10, creationflags=flags).stdout.lower()
    except Exception:
        return []
    return [name for exe, name in SCREEN_READERS.items() if f'"{exe}"' in out]


def num_lock_on():
    if sys.platform != "win32":
        return True
    import ctypes

    return bool(ctypes.windll.user32.GetKeyState(0x90) & 1)


def jaws_numpad_tip(readers, numpad_layout, numlock):
    """Spoken advice when JAWS would take the number pad keys, else ""."""
    if "JAWS" in readers and numpad_layout and not numlock:
        return ("JAWS is running and Num Lock is off, so JAWS uses the number pad keys. "
                "Press Num Lock to turn it on, or use the arrow keys, Space and Enter instead.")
    return ""
