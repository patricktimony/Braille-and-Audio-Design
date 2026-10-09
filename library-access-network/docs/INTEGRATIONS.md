# Integrations: research notes and extension points

Rule: **never claim control of a product we do not control.** Each integration is listed in `src/integrations/index.js` with a status. Pages read their labels from there, so the interface cannot say "works" until the code does.

## JAWS (Freedom Scientific / Vispero)

**Verified from public sources:**
- JAWS is proprietary Windows screen-reading software. Its keystrokes are documented in Freedom Scientific's [JAWS Keystrokes reference](https://www.freedomscientific.com/Content/Documents/Manuals/JAWS/Keystrokes.pdf) and in JAWS Help (Insert+J, then Help). The [Deque University list](https://dequeuniversity.com/screenreaders/jaws-keyboard-shortcuts) is a secondary reference.
- Google's [Gmail screen reader help](https://support.google.com/mail/answer/90559) recommends turning off the JAWS Virtual PC Cursor (Insert+Z) to use Gmail's own [keyboard shortcuts](https://support.google.com/mail/answer/6594), which must be turned on in Gmail settings.
- JAWS has its own scripting language and settings files. They run inside JAWS on the local computer.

**What the prototype does:** it works alongside JAWS as an accessible website. It offers lessons and a 42-command guide, each command linked to its source (`src/content/jaws-commands.js`). The commands use the desktop layout; versions and custom key maps can differ.

**What it never does:** read JAWS speech output, send keystrokes, read or change JAWS settings, or install scripts.

**Possible future step (not implemented):** a library of staff-reviewed JAWS settings or script packages that a patron chooses to download and install with permission, built with Freedom Scientific's documented scripting tools. This needs licensing review with Vispero.

## Morphic (Raising the Floor)

**Verified from public sources** ([morphic.org](https://morphic.org/), [Morphic FAQ](https://morphic.org/faq/)):
- Morphic is a free, open-source accessibility toolbar (the MorphicBar) for Windows 10 (1903 and later) and macOS (10.14 and later). It does not run on iOS or Android.
- It surfaces features already built into the operating system: text size, magnifier, read selected text, contrast, color vision filters, dark mode, night mode, and a snip button. There are Morphic, Morphic Plus (custom MorphicBars), and enterprise versions.
- Settings can be saved to a Morphic account and applied on other computers running Morphic.
- The Windows source code is at [github.com/raisingthefloor/morphic-windows](https://github.com/raisingthefloor/morphic-windows). It can be installed through WinGet (`RaisingTheFloor.Morphic`).

**Not found:** a documented public web API that a third-party site could use to read or apply a person's Morphic settings.

**What the prototype does:** it links to Morphic, explains setup at a library, and records which MorphicBar features a patron finds helpful. That record is stored only in this site, so staff can prepare a computer.

**Extension point:** `src/integrations/morphic.js` exports `adapter.readSettings()` and `adapter.applySettings()`. Both throw `NotAvailableError`. To implement them:
1. obtain a documented interface and agreement from Raising the Floor;
2. design explicit, revocable per-patron consent;
3. implement the methods and change `status` to `'available'`.

## Library identity

`src/auth.js` uses local accounts with scrypt-hashed passwords and in-memory sessions. Replace `signIn` with the library's own system, for example SAML or OpenID Connect through the library's identity provider, or library card plus PIN checked against the ILS (SIP2 or NCIP). Keep storing as little as possible: an opaque ID, not the card number.

## Accessible video and audio

Lessons in `src/content/lessons.js` are text-first. A future `media` field could attach recordings, but only with captions, a transcript, and audio description. The "audio or video" learning-style preference is already collected and labeled as planned.

## Opt-in AI summaries

Planned. A summary could draft the knowledge-base entry from a solved thread, but only if every participant opts in, and a person must edit and approve it before publishing. It would need a self-hosted or contracted model with no training on patron data. Nothing is implemented, and no data leaves the machine.

## Paid peer-trainer network

Planned. Trainer profiles already mark `networkTrainer`, and requests can be assigned to trainers at any library. Scheduling, vetting, payment, and payroll or tax handling need library-system partners.

## Data store

`src/db.js` is the only module that reads or writes data. Replace it with SQLite (Node's built-in `node:sqlite`, or `better-sqlite3`) or a hosted database without changing the routes. `src/search.js` is the place to add full-text search.
