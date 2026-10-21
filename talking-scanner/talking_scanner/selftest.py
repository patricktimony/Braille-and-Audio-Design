"""--self-test: checks this copy of Talking Scanner works, without a scanner.

Reads the bundled sample pages with Tesseract, checks the recognized text,
and checks that a Windows voice can speak.  The result is spoken, printed and
saved to self-test.txt in the data folder.  Exit code 0 means every check passed.
"""

import os
import sys

from . import APP_NAME, __version__

# Text that must be recognized on each sample page (page 3 is upside down).
EXPECTED = {
    "page1.png": "The library opens at nine o'clock every morning.",
    "page2.png": "Chapter Two",
    "page3_upside_down.png": "This page was placed upside down on the glass.",
}


def samples_dir():
    """The sample pages folder: next to TalkingScanner.exe, or in the source tree."""
    if getattr(sys, "frozen", False):
        return os.path.join(os.path.dirname(sys.executable), "samples")
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples")


def _check_ocr(results):
    from .ocr import OcrEngine

    engine = OcrEngine()
    results.append((True, f"Tesseract {engine.check()} at {engine.cmd}"))
    folder = samples_dir()
    for name, expected in EXPECTED.items():
        text = engine.recognize(os.path.join(folder, name))
        lines = [" ".join(line.split()) for line in text.splitlines()]
        ok = expected in lines
        results.append((ok, f"{name}: {'recognized' if ok else 'expected text not found'}"))


def _check_speech(results):
    if sys.platform != "win32":
        results.append((True, "speech: skipped (not Windows)"))
        return
    import tempfile

    from .speech.sapi import SapiSpeaker

    # Speak into a sound file, so the check also works without speakers.
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "voice.wav")
        speaker = SapiSpeaker(output_file=wav)
        voices = [v.GetDescription() for v in speaker.voices()]
        results.append((bool(voices), f"Windows voices: {', '.join(voices) or 'none found'}"))
        speaker.say("Talking Scanner self test.")
        speaker.voice.WaitUntilDone(10000)
        speaker.close()
        size = os.path.getsize(wav)
        results.append((size > 10000, f"voice produced {size} bytes of sound"))


def run(speak=True):
    from .storage import data_dir

    results = []
    for check in (_check_ocr, _check_speech):
        try:
            check(results)
        except Exception as exc:
            results.append((False, f"{check.__name__[7:]}: {type(exc).__name__}: {exc}"))
    passed = all(ok for ok, _ in results)
    lines = [f"{APP_NAME} {__version__} self test: {'PASSED' if passed else 'FAILED'}"]
    lines += [f"  {'ok  ' if ok else 'FAIL'} {msg}" for ok, msg in results]
    report = "\n".join(lines)
    path = os.path.join(data_dir(), "self-test.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(report + "\n")
    print(report)
    print(f"\nSaved to {path}")
    if speak:
        _speak("Self test passed. Talking Scanner is working." if passed else
               "Self test failed. Please ask for help, and share the file self-test dot t x t.")
    return 0 if passed else 1


def _speak(text):
    import time

    from .speech import default_speaker

    try:
        speaker = default_speaker()
        speaker.say(text)
        end = time.monotonic() + 15
        while speaker.is_busy() and time.monotonic() < end:
            time.sleep(0.1)
        speaker.close()
    except Exception:
        pass
