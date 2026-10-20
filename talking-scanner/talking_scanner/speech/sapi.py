"""Windows built-in offline speech (SAPI 5) through pywin32.

Speech is asynchronous.  SAPI raises an OnWord event as it starts each word,
carrying the word's character offset in the text it was given.  The
controller polls position() a few times a second, which is how the reading
position is remembered when the patron pauses.

Events arrive as Windows messages, so waiting messages are pumped before the
position is read (the window's message loop also pumps them).

Tested on Windows Server 2025 with NO sound card (GitHub Actions), speaking
into a WAV file: neither word events nor SpVoice.Status reported any
progress.  Whether they do on a PC with speakers must be checked with
`run.bat --speech-test`.  So the position comes from, in order:
  1. SAPI word events, 2. SpVoice.Status, 3. an estimate from elapsed time
and speaking rate, so a pause always resumes near the right word.
position_source records which one was last used.
"""

import time

import win32com.client

from . import Speaker

SVSF_ASYNC = 1
SVSF_PURGE_BEFORE_SPEAK = 2
SVSF_IS_NOT_XML = 16
SSFM_CREATE_FOR_WRITE = 3
# SpeechVoiceEvents: start and end of stream, word boundary
SVE_START_INPUT_STREAM = 2
SVE_END_INPUT_STREAM = 4
SVE_WORD_BOUNDARY = 32


def _pump():
    import pythoncom

    pythoncom.PumpWaitingMessages()


class _VoiceEvents:
    """SAPI event sink; DispatchWithEvents mixes this into the voice object."""

    def OnWord(self, StreamNumber, StreamPosition, CharacterPosition, Length):
        self.last_word = (int(StreamNumber), int(CharacterPosition))
        self.words_heard += 1

    def OnEndStream(self, StreamNumber, StreamPosition):
        self.ended_stream = int(StreamNumber)


class SapiSpeaker(Speaker):
    def __init__(self, rate=0, voice_name=None, output_file=None):
        self.voice = win32com.client.DispatchWithEvents("SAPI.SpVoice", _VoiceEvents)
        self.voice.last_word = None
        self.voice.words_heard = 0
        self.voice.ended_stream = None
        self.voice.EventInterests = SVE_START_INPUT_STREAM | SVE_END_INPUT_STREAM | SVE_WORD_BOUNDARY
        self.voice.Rate = max(-10, min(10, int(rate)))
        if voice_name:
            for v in self.voices():
                if voice_name.lower() in v.GetDescription().lower():
                    self.voice.Voice = v
                    break
        self._file = None
        if output_file:  # used by automated tests on machines without speakers
            self._file = win32com.client.Dispatch("SAPI.SpFileStream")
            self._file.Open(output_file, SSFM_CREATE_FOR_WRITE)
            self.voice.AudioOutputStream = self._file
        self._stream = None
        self._started = 0.0
        self._text_len = 0
        # about 15 characters a second at rate 0; SAPI rate +10 is 3x, -10 is 1/3
        self._chars_per_second = 15.0 * 3 ** (self.voice.Rate / 10)
        self.position_source = None

    def voices(self):
        tokens = self.voice.GetVoices()
        return [tokens.Item(i) for i in range(tokens.Count)]

    def say(self, text):
        self._stream = self.voice.Speak(text, SVSF_ASYNC | SVSF_PURGE_BEFORE_SPEAK | SVSF_IS_NOT_XML)
        self._started = time.monotonic()
        self._text_len = len(text)

    def stop(self):
        self.voice.Speak("", SVSF_ASYNC | SVSF_PURGE_BEFORE_SPEAK)
        self._stream = None

    def is_busy(self):
        _pump()
        return not self.voice.WaitUntilDone(0)

    def position(self):
        if self._stream is None:
            return None
        _pump()
        word = self.voice.last_word
        if word is not None and word[0] == self._stream:
            self.position_source = "word events"
            return word[1]
        status = self.voice.Status
        if status.CurrentStreamNumber == self._stream and status.InputWordPosition:
            self.position_source = "status"
            return int(status.InputWordPosition)
        self.position_source = "estimate"
        elapsed = time.monotonic() - self._started
        return min(int(elapsed * self._chars_per_second), self._text_len)

    def close(self):
        self.stop()
        if self._file is not None:
            self.voice.WaitUntilDone(5000)
            self._file.Close()
            self._file = None
