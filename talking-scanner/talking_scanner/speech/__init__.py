"""Speech output.

Why not Narrator?  Windows Narrator has no public programming interface that
lets another application start continuous reading at a chosen word, pause it,
resume it, or ask which word is being spoken.  An application can only hand
Narrator one-off notifications, which it may drop or cut short when the user
presses a key.  Reading a book with word, line and page navigation needs all
of those, so Talking Scanner speaks with Windows' own built-in offline voices
(SAPI 5, the same voices Narrator can use) and leaves Narrator running for
everything else.  Nothing is sent to the internet.
"""

import shutil
import subprocess
import sys
import time


class Speaker:
    """Interface used by the controller.  say() always interrupts."""

    def say(self, text):
        raise NotImplementedError

    def stop(self):
        raise NotImplementedError

    def is_busy(self):
        raise NotImplementedError

    def position(self):
        """Character offset (into the last text passed to say) of the word being spoken, or None."""
        return None

    def close(self):
        self.stop()


class TimedSpeaker(Speaker):
    """Estimates progress from elapsed time.  Base for the development speakers."""

    chars_per_second = 15.0

    def __init__(self):
        self._text = ""
        self._started = 0.0

    def _elapsed_chars(self):
        return (time.monotonic() - self._started) * self.chars_per_second

    def say(self, text):
        self.stop()
        self._text = text
        self._started = time.monotonic()

    def stop(self):
        self._text = ""

    def is_busy(self):
        return bool(self._text) and self._elapsed_chars() < len(self._text)

    def position(self):
        if not self._text:
            return None
        return min(int(self._elapsed_chars()), len(self._text))


class ConsoleSpeaker(TimedSpeaker):
    """Prints instead of speaking (for --no-speech and debugging)."""

    def say(self, text):
        super().say(text)
        print(f"[speech] {text}", flush=True)


class EspeakSpeaker(TimedSpeaker):
    """Development speaker for Linux using espeak-ng."""

    def __init__(self, wpm=175):
        super().__init__()
        self.exe = shutil.which("espeak-ng") or shutil.which("espeak")
        self.wpm = wpm
        self.chars_per_second = wpm * 6 / 60
        self._proc = None

    def say(self, text):
        super().say(text)
        self._proc = subprocess.Popen(
            [self.exe, "-s", str(self.wpm), "--", text],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def stop(self):
        super().stop()
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
        self._proc = None

    def is_busy(self):
        return self._proc is not None and self._proc.poll() is None


def default_speaker(rate=0, voice=None):
    if sys.platform == "win32":
        from .sapi import SapiSpeaker

        return SapiSpeaker(rate=rate, voice_name=voice)
    if shutil.which("espeak-ng") or shutil.which("espeak"):
        return EspeakSpeaker()
    return ConsoleSpeaker()
