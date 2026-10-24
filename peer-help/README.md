# Peer Tech Help

An open-source, accessible, peer-to-peer network for learning assistive technology. It connects blind and
low-vision people who want help with their technology with people who can teach them.

> **This is a working prototype.** The trainers, their messages, the example requests, and the example
> library entries are **demonstrations**, labelled "(demo)" and "simulated" in the app. There is **no
> sign-in**. Everything you enter stays in your browser on your device. Nothing here should be deployed as
> a real service until real authentication and a server are added (see `docs/architecture.md`).

## What works

| Feature | Status |
|---|---|
| Home page with three actions: **Get Help**, **Help Someone**, **My Instructions** | Works |
| Say or type a request, for example "I need someone to teach me JAWS" | Works (speech is optional) |
| Matching trainers by skill, with a "volunteers only" filter | Works, against demo trainers |
| Trainer profile: skills, availability, volunteer or paid | Works, stored on this device |
| Learner profile; a person can be both learner and trainer | Works, stored on this device |
| Text messaging in a session | **Simulated**: the demo trainer's replies are scripted |
| Link to a live voice call (Jitsi Meet, an external service) | Real link, but demo trainers will not join |
| Turn a session or pasted transcript into steps, with consent | Works, using simple on-device rules (**not AI**) |
| My Instructions: save, read aloud, download, delete | Works |
| Shared Library, with explicit opt-in and a personal-information check | Works, on this device only |
| Opening from the MorphicBar | Config files ready, see `morphic/README.md` |

## Run it

You need [Node.js](https://nodejs.org/) 20 or newer.

```sh
cd peer-help
npm install
npm run dev
```

Open the address shown, usually http://localhost:5173.

## Test it

```sh
npm test            # unit tests: skill detection, matching, step extraction, storage, messaging
npm run test:a11y   # builds the site, then runs axe-core WCAG 2.2 AA checks and keyboard-only journeys
npm run test:all    # type check + unit tests + build + accessibility tests
```

The accessibility tests run every page through axe-core (WCAG 2.0, 2.1, and 2.2 A/AA rules) at desktop and
iPhone screen sizes. They also check, for every page, the skip link, one main heading, landmarks, and
320-pixel reflow. Finally they run whole journeys using **only the keyboard**: asking for help, taking a
session, consenting, and saving instructions. Error messages, consent, and privacy rules are tested too.
The first run needs the Playwright browser. In most setups this is `npx playwright install chromium`.

Automated tests cannot judge how the app sounds. **Manual testing with VoiceOver, JAWS, NVDA, and Narrator
is required**, following [`docs/manual-testing.md`](docs/manual-testing.md).

## Try it on an iPhone

**Easiest: use a deployed copy** (see Deploy below). Speech input needs HTTPS, and a deployed site has it.

**Testing your local copy on the same Wi-Fi:**
1. Run `npm run dev`. Vite prints a "Network" address such as `http://192.168.1.20:5173`.
2. Open that address in Safari on the iPhone.
3. Everything except speech input works. Safari only allows the microphone on HTTPS pages. On plain HTTP the
   app says that speech input is not available, and you can use the microphone key on the iPhone keyboard
   instead.
4. Turn on VoiceOver (Settings, Accessibility, VoiceOver, or ask Siri) and follow
   `docs/manual-testing.md`.

## Deploy (free)

`npm run build` produces a folder of static files, `dist/`. Any static host works, and none needs a server or
paid API.

- **GitHub Pages:** in the repository settings, under Pages, choose "GitHub Actions". Then add a workflow that
  runs `npm ci && npm run build` in `peer-help/` and uploads `peer-help/dist` with
  `actions/upload-pages-artifact` and `actions/deploy-pages`. The site uses relative paths, so it works under
  `https://USER.github.io/REPO/`.
- **Netlify or Cloudflare Pages:** set the base directory to `peer-help`, the build command to
  `npm run build`, and the publish directory to `dist`.

Optional: set `VITE_CALL_BASE_URL` at build time, for example `https://jitsi.example.org/`, to use your own
Jitsi server for voice calls. The public `meet.jit.si` may ask the first person in a call to sign in.

Before a public deployment, remember that this prototype has **no authentication** and stores data only in
each visitor's browser. That is safe, because nothing is collected, but it is not yet a working network
between people.

## Connect it to Morphic

Morphic has no plugin API. It does let an administrator add up to three web-link buttons to the MorphicBar
through a `config.json` file, with no changes to Morphic itself. Ready-made files and step-by-step
instructions for Windows and macOS, with references to the Morphic source code, are in
[`morphic/README.md`](morphic/README.md).

## How it is built

Read [`docs/architecture.md`](docs/architecture.md). In short:
- **Separate pages, plain TypeScript, no UI framework**: the simplest thing that works well with screen
  readers and costs nothing to host.
- **Every outside service sits behind an interface** (`src/services/`): auth, storage, messaging, the
  instruction generator, and calls. Each has a local demonstration version today and can be replaced later
  without changing the pages.

```
peer-help/
  *.html                pages (header and footer come from partials/)
  src/pages/            one script per page
  src/services/         replaceable services (auth, storage, messaging, instructions, calls)
  src/skills.ts         skill list and request understanding
  src/matching.ts       trainer matching
  src/demo-data.ts      demonstration trainers, lessons, requests, library entries
  src/speech.ts         optional speech input and read-aloud
  tests/unit/           Vitest unit tests
  tests/a11y/           Playwright + axe-core accessibility and keyboard tests
  morphic/              MorphicBar configuration files and instructions
  docs/                 architecture and manual testing guide
```

## Licence

BSD 3-Clause (the same licence family as Morphic). See [`LICENSE`](LICENSE).
