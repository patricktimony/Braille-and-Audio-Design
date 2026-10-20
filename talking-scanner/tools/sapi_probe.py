"""Print raw SAPI status values while speaking (Windows only), to check how
stream numbers and word positions behave on this computer."""

import os
import sys
import tempfile
import time

import win32com.client

TEXT = "One two three four five six seven eight nine ten. " * 20


def probe(label, voice):
    t0 = time.monotonic()
    stream = voice.Speak(TEXT, 1 | 2 | 16)
    print(f"--- {label}: Speak returned {stream!r} ({type(stream).__name__})")
    for _ in range(40):
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


voice = win32com.client.Dispatch("SAPI.SpVoice")
try:
    probe("default audio output", voice)
except Exception as exc:
    print("default audio output failed:", exc)
f = win32com.client.Dispatch("SAPI.SpFileStream")
path = os.path.join(tempfile.gettempdir(), "probe.wav")
f.Open(path, 3)
voice.AudioOutputStream = f
probe("file output", voice)
f.Close()
sys.exit(0)
