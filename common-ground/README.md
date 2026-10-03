# Common Ground

A conversation coach for two people. It listens, keeps a working psychological
theory of what is happening between them, and gently interrupts (on screen and
out loud) when the conversation stops helping either of them.

## What it does

- **Listens** with the browser's built-in speech recognition. Browser
  transcription can't tell voices apart, so the app also tracks voice pitch on
  the same microphone and matches each line to the closer of two learned
  voices. Press **Teach voices** once so each person says a couple of
  sentences. Tapping a name in the transcript fixes a line and teaches the app.
  Claude also fixes obvious mix-ups from context. Choose "I'll tap names" to
  assign speakers by hand instead.
- **Fact-checks**: Claude picks out checkable factual claims, verifies them
  with Anthropic's web search tool, and interrupts with a short, friendly
  correction and its sources when something important is wrong. Searches cost
  about 1 cent each. In the claude.ai artifact version there is no web search,
  so checks use Claude's own knowledge.
- **Builds a theory** with Claude: a plain-language summary, tension and
  "productive" gauges, the conversation's phase, each person's stated position
  versus their underlying need, and the patterns it sees, each tied to a quote
  and a framework (Gottman's Four Horsemen and repair attempts, Fisher & Ury's
  interests vs. positions, Nonviolent Communication, demand-withdraw cycles).
- **Interrupts gently**: a chime, then a short spoken suggestion addressed to
  one person or both, with one concrete thing to try. It also reinforces good
  moves. A cooldown keeps it from nagging: Light touch (2 min), Balanced
  (1 min), Active (30 s).
- **Safety**: if the conversation suggests threats or abuse, it suggests
  pausing and getting support rather than coaching cooperation.

## Run it

Speech recognition needs Chrome, Edge or Safari, and works best from a local
server rather than `file://`:

```sh
cd common-ground
python3 -m http.server 8000
# open http://localhost:8000
```

Open **Connection** and paste an Anthropic API key. The key goes only from your
browser to `api.anthropic.com`. Use a key with a spending limit. The app
analyzes after every couple of new lines (at most every ~8 seconds), using
`claude-opus-5-5` at low effort to stay responsive.

## Files

- `app.html` – the app (page body; also what gets published as a claude.ai artifact)
- `index.html` – standalone page generated from `app.html` by `./build.sh`

Everyone in the conversation should know the app is listening.
