import os
import shutil
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
SAMPLES = os.path.join(ROOT, "samples")

from talking_scanner.controller import Controller  # noqa: E402
from talking_scanner.ocr import OcrEngine  # noqa: E402
from talking_scanner.scanners import ScannerManager, SimulatedBackend  # noqa: E402
from talking_scanner.speech import Speaker  # noqa: E402
from talking_scanner.storage import Session, Settings  # noqa: E402

HAVE_TESSERACT = shutil.which("tesseract") is not None or bool(os.environ.get("TESSERACT_CMD"))
if not HAVE_TESSERACT:
    from talking_scanner.ocr import find_tesseract

    HAVE_TESSERACT = find_tesseract() is not None


class FakeSpeaker(Speaker):
    """Speaks instantly into a list; tests move the 'current word' by hand."""

    def __init__(self):
        self.spoken = []
        self.text = ""
        self.pos = None
        self.busy = False
        self.stops = 0

    def say(self, text):
        self.spoken.append(text)
        self.text, self.pos, self.busy = text, 0, True

    def stop(self):
        self.busy, self.pos = False, None
        self.stops += 1

    def is_busy(self):
        return self.busy

    def position(self):
        return self.pos

    # test helpers
    def speak_up_to(self, fragment):
        self.pos = self.text.index(fragment)

    def finish(self):
        self.busy = False

    @property
    def last(self):
        return self.spoken[-1] if self.spoken else ""


class FakeOcr:
    """Returns the text of a matching .txt file, for tests that do not need Tesseract."""

    def __init__(self, texts):
        self.texts = list(texts)
        self.calls = 0

    def check(self):
        return "fake"

    def recognize(self, path):
        text = self.texts[self.calls % len(self.texts)]
        self.calls += 1
        return text


def sync_jobs(fn, on_done, on_error):
    try:
        result = fn()
    except Exception as exc:
        on_error(exc)
    else:
        on_done(result)


class DeferredJobs:
    """Holds background jobs until the test runs them, to test the busy state."""

    def __init__(self):
        self.pending = []

    def __call__(self, fn, on_done, on_error):
        self.pending.append((fn, on_done, on_error))

    def run_next(self):
        sync_jobs(*self.pending.pop(0))


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("TALKING_SCANNER_HOME", str(tmp_path / "home"))
    return tmp_path


PAGE_TEXTS = [
    "Chapter One\n\nThe library opens at nine.\nPatrons may borrow twenty books.\nAsk at the desk.",
    "Chapter Two\nLarge print is upstairs.",
    "Chapter Three\nThe end.",
]


def make_controller(home, layout="numpad", ocr=None, backend=None, run_job=sync_jobs, clock=None):
    settings = Settings(str(home / "settings.json"))
    settings["layout"] = layout
    settings["books_dir"] = str(home / "books")
    speaker = FakeSpeaker()
    backend = backend or SimulatedBackend([os.path.join(SAMPLES, "page1.png")])
    exits = []
    c = Controller(
        speaker,
        ScannerManager([backend]),
        ocr or FakeOcr(PAGE_TEXTS),
        Session(str(home / "data")),
        settings,
        run_job,
        on_exit=lambda: exits.append(True),
        clock=clock or Clock(),
    )
    c.exits = exits
    return c, speaker, backend


def real_ocr():
    return OcrEngine()
