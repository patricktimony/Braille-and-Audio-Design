"""Print raw SAPI status values while speaking (Windows only), to check how
stream numbers and word positions behave on this computer."""

import os
import sys
import tempfile
import time

import win32com.client

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

TEXT = "One two three four five six seven eight nine ten. " * 20


import pythoncom

PUMP = False


def probe(label, voice):
    t0 = time.monotonic()
    stream = voice.Speak(TEXT, 1 | 2 | 16)
    print(f"--- {label}: Speak returned {stream!r} ({type(stream).__name__})")
    for _ in range(40):
        if PUMP:
            pythoncom.PumpWaitingMessages()
        st = voice.Status
        print(f"  t={time.monotonic() - t0:5.2f} done={voice.WaitUntilDone(0)} running={st.RunningState} "
              f"current={st.CurrentStreamNumber!r} lastqueued={st.LastStreamNumberQueued!r} "
              f"inputword={st.InputWordPosition!r} len={st.InputWordLength!r}")
        if voice.WaitUntilDone(0):
            break
        time.sleep(0.05)
    voice.WaitUntilDone(60000)
    st = voice.Status
    print(f"  finished after {time.monotonic() - t0:.2f}s: current={st.CurrentStreamNumber!r} "
          f"inputword={st.InputWordPosition!r}")


from talking_scanner.speech.sapi import SapiSpeaker  # noqa: E402

sp = SapiSpeaker(output_file=os.path.join(tempfile.gettempdir(), "probe2.wav"))
t0 = time.monotonic()
sp.say(TEXT)
while sp.is_busy() and time.monotonic() - t0 < 30:
    time.sleep(0.01)
for _ in range(20):
    sp.is_busy()
print(f"--- SapiSpeaker word events: heard {sp.voice.words_heard} of {len(TEXT.split())} words in "
      f"{time.monotonic() - t0:.2f}s; last word={sp.voice.last_word}; position()={sp.position()}")
sp.close()
sys.exit(0)
