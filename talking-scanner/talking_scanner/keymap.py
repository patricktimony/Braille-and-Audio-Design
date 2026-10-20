"""Keyboard layouts.

Every key is a single key press; no key combinations are used for normal
operation.  Both layouts are active at the same time, because they never
conflict once number-pad keys are told apart from the separate arrow and
Page Up / Page Down keys (Windows marks the separate keys as "extended",
and wxPython reports number-pad keys as WXK_NUMPAD_*).

The layout the patron chooses on first run only decides which keys the
spoken help describes.

Num Lock: with Num Lock ON the number pad sends digits (NUMPAD8 ...).
With Num Lock OFF it sends navigation keys (NUMPAD_UP ...).  Both states
are mapped to the same actions, so Num Lock does not matter.  Numpad 5
with Num Lock off sends "Clear" (WXK_CLEAR / WXK_NUMPAD_BEGIN).
"""

from enum import Enum


class Action(Enum):
    SCAN = "scan"
    PLAY_PAUSE = "play_pause"
    PREV_WORD = "prev_word"
    NEXT_WORD = "next_word"
    PREV_LINE = "prev_line"
    NEXT_LINE = "next_line"
    PREV_PAGE = "prev_page"
    NEXT_PAGE = "next_page"
    HELP = "help"
    QUIT = "quit"
    YES = "yes"
    NO = "no"


LAYOUT_NUMPAD = "numpad"
LAYOUT_LAPTOP = "laptop"

# Logical key names are toolkit independent.  The UI translates its own
# key codes into these names (see WX_KEYS below).
NUMPAD_KEYS = {
    "NUMPAD_ENTER": Action.SCAN,
    # Numpad 5: Num Lock on / Num Lock off
    "NUMPAD5": Action.PLAY_PAUSE,
    "NUMPAD_CLEAR": Action.PLAY_PAUSE,
    "NUMPAD_BEGIN": Action.PLAY_PAUSE,
    "NUMPAD4": Action.PREV_WORD,
    "NUMPAD_LEFT": Action.PREV_WORD,
    "NUMPAD6": Action.NEXT_WORD,
    "NUMPAD_RIGHT": Action.NEXT_WORD,
    "NUMPAD8": Action.PREV_LINE,
    "NUMPAD_UP": Action.PREV_LINE,
    "NUMPAD2": Action.NEXT_LINE,
    "NUMPAD_DOWN": Action.NEXT_LINE,
    "NUMPAD7": Action.PREV_PAGE,
    "NUMPAD_HOME": Action.PREV_PAGE,
    "NUMPAD9": Action.NEXT_PAGE,
    "NUMPAD_PAGEUP": Action.NEXT_PAGE,
}

LAPTOP_KEYS = {
    "ENTER": Action.SCAN,
    "SPACE": Action.PLAY_PAUSE,
    "LEFT": Action.PREV_WORD,
    "RIGHT": Action.NEXT_WORD,
    "UP": Action.PREV_LINE,
    "DOWN": Action.NEXT_LINE,
    "PAGEUP": Action.PREV_PAGE,
    "PAGEDOWN": Action.NEXT_PAGE,
}

COMMON_KEYS = {
    "F1": Action.HELP,
    "ESCAPE": Action.QUIT,
    "Y": Action.YES,
    "N": Action.NO,
}

ALL_KEYS = {**NUMPAD_KEYS, **LAPTOP_KEYS, **COMMON_KEYS}

# wxPython key code attribute -> logical key name.  Built into a code table
# at runtime by ui_wx so that this module does not import wx.
WX_KEYS = {
    "WXK_NUMPAD_ENTER": "NUMPAD_ENTER",
    "WXK_NUMPAD5": "NUMPAD5",
    "WXK_CLEAR": "NUMPAD_CLEAR",
    "WXK_NUMPAD_BEGIN": "NUMPAD_BEGIN",
    "WXK_NUMPAD4": "NUMPAD4",
    "WXK_NUMPAD_LEFT": "NUMPAD_LEFT",
    "WXK_NUMPAD6": "NUMPAD6",
    "WXK_NUMPAD_RIGHT": "NUMPAD_RIGHT",
    "WXK_NUMPAD8": "NUMPAD8",
    "WXK_NUMPAD_UP": "NUMPAD_UP",
    "WXK_NUMPAD2": "NUMPAD2",
    "WXK_NUMPAD_DOWN": "NUMPAD_DOWN",
    "WXK_NUMPAD7": "NUMPAD7",
    "WXK_NUMPAD_HOME": "NUMPAD_HOME",
    "WXK_NUMPAD9": "NUMPAD9",
    "WXK_NUMPAD_PAGEUP": "NUMPAD_PAGEUP",
    "WXK_RETURN": "ENTER",
    "WXK_SPACE": "SPACE",
    "WXK_LEFT": "LEFT",
    "WXK_RIGHT": "RIGHT",
    "WXK_UP": "UP",
    "WXK_DOWN": "DOWN",
    "WXK_PAGEUP": "PAGEUP",
    "WXK_PAGEDOWN": "PAGEDOWN",
    "WXK_F1": "F1",
    "WXK_ESCAPE": "ESCAPE",
}


def action_for(key_name):
    """Return the Action for a logical key name, or None if unmapped."""
    return ALL_KEYS.get(key_name)


def help_text(layout):
    if layout == LAYOUT_NUMPAD:
        return (
            "Number pad keys. Number pad Enter: scan and read. "
            "5: play or pause. 4 and 6: previous and next word. "
            "8 and 2: previous and next line. 7 and 9: previous and next page. "
            "F1: help. Escape: quit."
        )
    return (
        "Enter: scan and read. Space: play or pause. "
        "Left and right arrows: previous and next word. "
        "Up and down arrows: previous and next line. "
        "Page up and page down: previous and next page. "
        "F1: help. Escape: quit."
    )
