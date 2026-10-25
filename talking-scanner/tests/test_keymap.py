"""Keyboard layouts, including Num Lock on and off."""

import pytest

from talking_scanner.keymap import ALL_KEYS, WX_KEYS, Action, action_for

# (key, Num Lock ON name, Num Lock OFF name, action) for the number pad
NUMPAD = [
    ("Numpad Enter", "NUMPAD_ENTER", "NUMPAD_ENTER", Action.SCAN),
    ("Numpad 5", "NUMPAD5", "NUMPAD_CLEAR", Action.PLAY_PAUSE),
    ("Numpad 4", "NUMPAD4", "NUMPAD_LEFT", Action.PREV_WORD),
    ("Numpad 6", "NUMPAD6", "NUMPAD_RIGHT", Action.NEXT_WORD),
    ("Numpad 8", "NUMPAD8", "NUMPAD_UP", Action.PREV_LINE),
    ("Numpad 2", "NUMPAD2", "NUMPAD_DOWN", Action.NEXT_LINE),
    ("Numpad 7", "NUMPAD7", "NUMPAD_HOME", Action.PREV_PAGE),
    ("Numpad 9", "NUMPAD9", "NUMPAD_PAGEUP", Action.NEXT_PAGE),
]

LAPTOP = [
    ("ENTER", Action.SCAN),
    ("SPACE", Action.PLAY_PAUSE),
    ("LEFT", Action.PREV_WORD),
    ("RIGHT", Action.NEXT_WORD),
    ("UP", Action.PREV_LINE),
    ("DOWN", Action.NEXT_LINE),
    ("PAGEUP", Action.PREV_PAGE),
    ("PAGEDOWN", Action.NEXT_PAGE),
]


@pytest.mark.parametrize("label,on,off,action", NUMPAD)
def test_numpad_same_action_with_num_lock_on_and_off(label, on, off, action):
    assert action_for(on) == action, label
    assert action_for(off) == action, label


def test_numpad5_num_lock_off_alternative_code():
    # Some keyboards/drivers report Numpad 5 with Num Lock off as "Begin".
    assert action_for("NUMPAD_BEGIN") == Action.PLAY_PAUSE


@pytest.mark.parametrize("key,action", LAPTOP)
def test_laptop_layout(key, action):
    assert action_for(key) == action


def test_numpad9_with_num_lock_off_is_not_confused_with_page_up():
    # Numpad 9 with Num Lock off sends a Page Up code.  It must still mean
    # "next page", while the separate Page Up key means "previous page".
    assert action_for("NUMPAD_PAGEUP") == Action.NEXT_PAGE
    assert action_for("PAGEUP") == Action.PREV_PAGE
    assert action_for("NUMPAD_HOME") == Action.PREV_PAGE


def test_unused_numpad_keys_and_other_keys_are_not_taken():
    for key in ("NUMPAD1", "NUMPAD3", "NUMPAD_END", "NUMPAD_PAGEDOWN", "NUMPAD0", "TAB", "A", "HOME"):
        assert action_for(key) is None, key


def test_every_wx_key_maps_to_an_action():
    for attr, name in WX_KEYS.items():
        assert name in ALL_KEYS, attr


def test_layouts_never_conflict():
    names = list(ALL_KEYS)
    assert len(names) == len(set(names))
