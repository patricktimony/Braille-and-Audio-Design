"""Real Tesseract OCR on several simulated scans, and privacy checks."""

import os
import socket

import pytest
from conftest import HAVE_TESSERACT, SAMPLES, make_controller, real_ocr

from talking_scanner.scanners import SimulatedBackend
from talking_scanner.storage import AppLock, Session, delete_stale_sessions, is_sync_folder

needs_tesseract = pytest.mark.skipif(not HAVE_TESSERACT, reason="Tesseract not installed")

ALL_PAGES = [os.path.join(SAMPLES, f) for f in sorted(os.listdir(SAMPLES)) if f.endswith(".png")]


@needs_tesseract
def test_multi_page_ocr_through_the_whole_program(home, monkeypatch):
    # Any attempt to open a network connection fails the test.
    def no_network(*args, **kwargs):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(socket.socket, "connect", no_network)
    backend = SimulatedBackend(ALL_PAGES)
    c, sp, _ = make_controller(home, ocr=real_ocr(), backend=backend)
    for _ in range(4):
        c.handle_key("NUMPAD_ENTER")
    # page 4 is blank, so three pages are kept
    assert len(c.book) == 3
    assert "No text was found" in sp.last
    p1, p2, p3 = c.book.pages
    assert p1.lines[0] == "Chapter One"
    assert "The library opens at nine o'clock every morning." in p1.lines
    assert p2.lines[0] == "Chapter Two" and "braille" in p2.text
    assert p3.lines[0] == "Chapter Three"  # was upside down
    assert "This page was placed upside down on the glass." in p3.lines


def test_stale_sessions_deleted_and_single_instance(tmp_path):
    root = str(tmp_path)
    old = Session(root)
    open(os.path.join(old.dir, "scan-001.png"), "wb").close()
    lock = AppLock(root)
    assert lock.acquire()
    assert not AppLock(root).acquire()  # a second copy is refused
    delete_stale_sessions(root)
    assert not os.path.exists(old.dir)
    lock.release()


def test_sync_folders_detected():
    assert is_sync_folder(r"C:\Users\pat\OneDrive - Library\Documents")
    assert is_sync_folder("/home/pat/Dropbox/books")
    assert not is_sync_folder(r"C:\Users\pat\Talking Scanner Books")


def test_no_network_modules_used_by_app():
    root = os.path.join(os.path.dirname(__file__), "..", "talking_scanner")
    for dirpath, _, files in os.walk(root):
        for name in files:
            if name.endswith(".py"):
                src = open(os.path.join(dirpath, name), encoding="utf-8").read()
                for banned in ("import socket", "urllib", "requests", "http.client"):
                    assert banned not in src, f"{name} uses {banned}"
