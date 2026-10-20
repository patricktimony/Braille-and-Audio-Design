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


# These run on Windows CI, which has no sound card: SAPI writes to a WAV
# file far faster than real time (a page takes about 0.2 seconds), so
# pausing mid-sentence cannot be observed here.  They check that SAPI's word
# events give correct positions, that speech can be interrupted, and that
# the reader moves through pages with real SAPI.  Pausing in real time must
# be checked by ear on a PC with speakers.
VERY_LONG = LONG * 40


def _sapi(tmp_path, name="out.wav"):
    from talking_scanner.speech.sapi import SapiSpeaker

    return SapiSpeaker(output_file=str(tmp_path / name))


@pytest.mark.skipif(sys.platform != "win32", reason="SAPI is Windows only")
def test_sapi_word_events_give_word_offsets(tmp_path):
    sp = _sapi(tmp_path)
    sp.say(LONG)
    assert wait(lambda: not sp.is_busy(), 30)
    for _ in range(20):  # let the last events arrive
        sp.is_busy()
    assert sp.voice.words_heard >= len(LONG.split()) - 2, sp.voice.words_heard
    pos = sp.position()  # offset of the last word spoken, in the text we gave
    assert pos is not None, "SAPI word position not reported"
    assert pos > len(LONG) // 2 and LONG[pos - 1] == " "
    sp.close()


@pytest.mark.skipif(sys.platform != "win32", reason="SAPI is Windows only")
def test_sapi_interrupt(tmp_path):
    sp = _sapi(tmp_path)
    sp.say(VERY_LONG)
    sp.say("Interrupted.")  # purges the long text
    assert wait(lambda: not sp.is_busy(), 30)
    for _ in range(20):
        sp.is_busy()
    pos = sp.position()
    assert pos is not None and pos <= len("Interrupted."), pos
    sp.stop()
    assert not sp.is_busy()
    sp.close()
    assert os.path.getsize(str(tmp_path / "out.wav")) > 1000


@pytest.mark.skipif(sys.platform != "win32", reason="SAPI is Windows only")
def test_sapi_reader_moves_through_pages(home, tmp_path):
    from conftest import FakeOcr, make_controller

    c, _, _ = make_controller(home, ocr=FakeOcr(["Page one has a few words.", "Page two follows on."]))
    c.speaker = _sapi(tmp_path)
    c.handle_key("NUMPAD_ENTER")
    c.handle_key("NUMPAD_ENTER")
    c.handle_key("NUMPAD7")  # back to page 1 while reading
    assert c.state == "reading" and c.book.page == 0

    def finished():
        c.tick()
        return c.state == "idle"

    assert wait(finished, 30)
    assert c.book.page == 1 and c.book.at_end_of_page()
    assert "the last page" in c.status
    c.speaker.close()
