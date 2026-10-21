"""JAWS keyboard advice, and the --self-test used to check an installed copy."""

import pytest
from conftest import HAVE_TESSERACT, make_controller

from talking_scanner import selftest
from talking_scanner.screenreaders import jaws_numpad_tip


def test_jaws_tip_only_when_jaws_would_take_the_number_pad():
    assert "Num Lock" in jaws_numpad_tip(["JAWS"], numpad_layout=True, numlock=False)
    assert jaws_numpad_tip(["JAWS"], numpad_layout=True, numlock=True) == ""
    assert jaws_numpad_tip(["JAWS"], numpad_layout=False, numlock=False) == ""
    assert jaws_numpad_tip(["Narrator"], numpad_layout=True, numlock=False) == ""


def test_controller_speaks_keyboard_tip_at_start_setup_and_help(home):
    c, sp, _ = make_controller(home, layout=None)
    c.keyboard_tip = lambda numpad: "JAWS tip." if numpad else ""
    c.start()
    assert "JAWS tip" not in sp.last  # setup prompt is unchanged
    c.handle_key("NUMPAD_ENTER")
    assert sp.last.endswith("JAWS tip.")
    c.handle_key("F1")
    assert sp.last.endswith("JAWS tip.")
    c.start()
    assert sp.last.endswith("JAWS tip.")


def test_no_tip_with_main_keyboard_layout(home):
    c, sp, _ = make_controller(home, layout="laptop")
    c.keyboard_tip = lambda numpad: "JAWS tip." if numpad else ""
    c.start()
    assert "JAWS tip" not in sp.last


@pytest.mark.skipif(not HAVE_TESSERACT, reason="Tesseract not installed")
def test_self_test_passes_on_sample_pages(monkeypatch, tmp_path):
    monkeypatch.setenv("TALKING_SCANNER_HOME", str(tmp_path))
    assert selftest.run(speak=False) == 0
    assert "PASSED" in (tmp_path / "self-test.txt").read_text(encoding="utf-8")


def test_self_test_fails_when_tesseract_is_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("TALKING_SCANNER_HOME", str(tmp_path))
    monkeypatch.setattr("talking_scanner.ocr.find_tesseract", lambda: "/nonexistent/tesseract")
    assert selftest.run(speak=False) == 1
    assert "FAILED" in (tmp_path / "self-test.txt").read_text(encoding="utf-8")
