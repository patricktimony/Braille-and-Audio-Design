# Common Ground

A conversation coach for two people. It listens, keeps a working psychological
theory of what is happening between them, and gently interrupts (on screen and
out loud) when the conversation stops helping either of them.

## What it does

- **Listens** with the browser's built-in speech recognition. Tap a name (or
  press `1` / `2`) when the other person starts talking. Tap a name in the
  transcript to reassign a line. You can also type lines.
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
