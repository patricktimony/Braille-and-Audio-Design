"""Interrupting real speech engines.

On Linux this uses espeak-ng.  On Windows (CI) it uses SAPI 5, the voices
built into Windows, writing to a WAV file so no speakers are needed.
"""

import os
import shutil
import sys
import time

import pytest

from talking_scanner.speech import EspeakSpeaker

LONG = "This is a long sentence that keeps going so that it can be interrupted. " * 5


def wait(cond, seconds=5.0):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.05)
    return cond()


@pytest.mark.skipif(not (shutil.which("espeak-ng") or shutil.which("espeak")), reason="espeak not installed")
def test_espeak_interrupt_and_progress():
    sp = EspeakSpeaker()
    sp.say(LONG)
    assert sp.is_busy()
    time.sleep(0.6)
    assert sp.position() > 0
    sp.stop()
    assert wait(lambda: not sp.is_busy(), 1.0)
    sp.say("Second")  # a new utterance after an interruption works
    assert wait(lambda: not sp.is_busy(), 5.0)


@pytest.mark.skipif(sys.platform != "win32", reason="SAPI is Windows only")
def test_sapi_interrupt_and_word_position(tmp_path):
    from talking_scanner.speech.sapi import SapiSpeaker

    wav = str(tmp_path / "out.wav")
    sp = SapiSpeaker(output_file=wav)
    sp.say(LONG)
    seen = set()

    def progressed():
        pos = sp.position()
        if pos is not None:
            seen.add(pos)
        return len(seen) > 2 or not sp.is_busy()

    assert wait(progressed, 10)
    assert max(seen) > 0
    # positions are character offsets of word starts in the text we gave
    assert all(p == 0 or LONG[p - 1] == " " for p in seen)
    sp.say("Interrupted.")
    assert wait(lambda: not sp.is_busy(), 10)
    sp.close()
    assert os.path.getsize(wav) > 1000


@pytest.mark.skipif(sys.platform != "win32", reason="SAPI is Windows only")
def test_sapi_pause_resume_inside_the_controller(home, tmp_path):
    from conftest import FakeOcr, make_controller

    from talking_scanner.speech.sapi import SapiSpeaker

    c, _, _ = make_controller(home, ocr=FakeOcr([LONG]))
    c.speaker = SapiSpeaker(output_file=str(tmp_path / "out.wav"))
    c.handle_key("NUMPAD_ENTER")

    def mid_page():
        c.tick()
        return c.book.word > 3

    assert wait(mid_page, 10), "SAPI never reported a word position"
    c.handle_key("NUMPAD5")  # pause
    paused_at = c.book.word
    assert c.state == "idle" and 3 < paused_at < len(c.book.current.words)
    c.handle_key("NUMPAD5")  # resume from the same word
    assert c.state == "reading" and c.book.word == paused_at
    c.speaker.close()
