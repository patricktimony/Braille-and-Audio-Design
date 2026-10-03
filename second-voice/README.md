# Second Voice

A browser app that listens to your conversation and has Claude cut in, out loud, to:

- **fact-check** what anyone says (with live web search),
- **cool things down** when tension rises,
- explain **what the other person may be feeling**, and
- suggest **exact phrases to try** that steer the talk toward getting along.

You can also talk to Claude directly at any time by starting a sentence with **"Claude, …"** (for example, "Claude, what is she actually upset about?"). It answers by voice.

## Run it

Browsers only allow the microphone on `https://` or `localhost`, so serve the folder locally:

```bash
cd second-voice
python3 -m http.server 8000
```

Then open <http://localhost:8000> in **Chrome or Edge** (best speech recognition; Safari also works).

1. Open **Settings** and paste your Anthropic API key (from <https://console.anthropic.com>).
2. Optionally describe the situation under "What should Claude know?".
3. Press **Start listening** and talk normally.

## Controls

| Control | What it does |
|---|---|
| How often Claude cuts in (1–5) | 5 ("Constantly", the default) interrupts after almost every exchange. 1 only cuts in for clear errors or hostility. |
| Thinking effort | Low = fastest interruptions. Max = deepest reasoning, but replies take longer. |
| Model | Claude Opus 5.5 by default; Sonnet 5.5 is faster, Fable 5.1 is the most capable. |
| Me / Them / Auto (or press `S`) | Tells Claude who is talking. On Auto, Claude infers it. |
| Hush (or `Esc`) | Stops Claude mid-sentence. |
| Speak aloud | Off = a soft chime and on-screen card only, for when you don't want the other person to hear. |

While Claude speaks, the mic pauses so it doesn't transcribe itself.

## Privacy and ethics

- Audio is turned into text by your browser's speech recognition (in Chrome this uses Google's service). The text is sent to Anthropic's API using your key.
- The key stays in your browser. It is saved only if you tick "Remember the key".
- **Tell the people you're talking with that the app is listening.** Recording people without consent is illegal in many places.
- The coach is told to steer you honestly: no manipulation of the other person. It is not a therapist.
