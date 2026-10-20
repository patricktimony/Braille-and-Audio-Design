"""Windows built-in offline speech (SAPI 5) through pywin32.

Speech is asynchronous.  The controller polls position() a few times a
second; SAPI reports the character offset of the word it is speaking, which
is how the reading position is remembered when the patron pauses.
"""

from . import Speaker

SVSF_ASYNC = 1
SVSF_PURGE_BEFORE_SPEAK = 2
SVSF_IS_NOT_XML = 16
SSFM_CREATE_FOR_WRITE = 3


class SapiSpeaker(Speaker):
    def __init__(self, rate=0, voice_name=None, output_file=None):
        import win32com.client

        self.voice = win32com.client.Dispatch("SAPI.SpVoice")
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

    def voices(self):
        tokens = self.voice.GetVoices()
        return [tokens.Item(i) for i in range(tokens.Count)]

    def say(self, text):
        self._stream = self.voice.Speak(text, SVSF_ASYNC | SVSF_PURGE_BEFORE_SPEAK | SVSF_IS_NOT_XML)

    def stop(self):
        self.voice.Speak("", SVSF_ASYNC | SVSF_PURGE_BEFORE_SPEAK)
        self._stream = None

    def is_busy(self):
        return not self.voice.WaitUntilDone(0)

    def position(self):
        if self._stream is None:
            return None
        status = self.voice.Status
        if status.CurrentStreamNumber != self._stream:
            return None
        return int(status.InputWordPosition)

    def close(self):
        self.stop()
        if self._file is not None:
            self.voice.WaitUntilDone(5000)
            self._file.Close()
            self._file = None
