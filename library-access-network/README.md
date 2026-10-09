# Library Access Network — prototype

An accessible social and training network for public libraries. A blind patron can walk into any participating library, get help setting up an accessible computer, learn JAWS skills, ask the community, and share what they know with patrons at other libraries.

It brings together three layers:

1. **JAWS**: pages built for screen readers, short lessons, and a searchable guide to keyboard commands, each linked to its source.
2. **Morphic**: official information and links, a record of the Morphic features each patron finds helpful, and a clearly marked place for future integration.
3. **Social network**: questions, answers, tips, trainer requests, and a shared knowledge base built from solved conversations, with the consent and credit of the people involved.

> **Demonstration only.** All libraries, people, and posts are fictional. Do not enter real patron information. The prototype does not yet have production authentication, permissions, security, or privacy protections. See [docs/PRIVACY.md](docs/PRIVACY.md).

## Start it (one command)

You need [Node.js](https://nodejs.org/) 18 or newer. Nothing else needs to be installed.

```sh
cd library-access-network
npm start
```

Then open **http://localhost:3000** in your web browser. Press Ctrl+C in the terminal to stop.

- Sample data is created on first run in `data/db.json`.
- To restore the sample data: `npm run reset`, or use **Reset demonstration data** on the `/demo` page.
- To use a different port: `PORT=8080 npm start`.

## Try the demonstration (about 5 minutes)

Every account uses the password **`demo-library`**. The sign-in page also has a one-click button for each account.

| Username | Who | Library |
|---|---|---|
| `maya` | Patron, new to JAWS | Downtown Demo Library, Washington DC |
| `harold` | Patron, first time using a computer | Downtown Demo Library, Washington DC |
| `jordan` | Patron, braille reader | Demo Branch Library, Prince George's County MD |
| `devon` | Patron, experienced JAWS user who leads a peer circle | Central Demo Library, Arlington VA |
| `andre` | Trainer, works across the network | Central Demo Library, Arlington VA |
| `lin` | Trainer, assistive technology specialist | Downtown Demo Library, Washington DC |
| `rosa` | Librarian | Downtown Demo Library, Washington DC |
| `sam` | Librarian | Demo Branch Library, Prince George's County MD |

**Scenario: "How do I use JAWS to read Gmail?"**

1. Sign in as **maya**. Choose **Learn a skill**, then **Read Gmail with JAWS**.
2. At the end of the lesson, choose **Ask a question about this lesson**. Ask "How do I use JAWS to read Gmail?" and post it to everyone in the network.
3. Sign out. Sign in as **andre** (a trainer in Arlington). Open **Staff dashboard**, open Maya's question, write an answer, and tick the box that allows it to be shared.
4. Sign in as **maya** again. Open the question (from **Discussions**). Choose **This answer solved my problem**, then **Share this solution with the network**. Edit the summary, agree to share, and publish.
5. Sign in as **jordan** (Prince George's County). Choose **Knowledge base** and search for **gmail**. Maya and Andre's solution is there, credited to both.

The same walkthrough is on the site at `/demo`.

## Test it

```sh
npm test            # 18 tests, no install needed: includes the full demonstration loop
npm install         # once, for the accessibility checker only (axe-core, playwright-core)
npm run test:a11y   # axe-core WCAG 2.2 AA checks on every page in a headless Chromium browser
```

`npm run test:a11y` needs a Chromium browser. It uses Playwright's browser folder if one exists, or set `CHROME_PATH` to a Chrome or Chromium executable.

## What works and what is planned

| Feature | Status |
|---|---|
| Welcome page: Get help, Learn a skill, Share a tip | Works |
| Library profiles (3 demo libraries), patron and staff profiles | Works |
| Accessibility preferences (screen reader, text size, contrast, input, learning style, Morphic features) | Works. Text size and contrast change this site right away |
| JAWS and Gmail keyboard-command guide (42 commands, each with a source) | Works |
| Lessons (4) and a practice page | Works |
| Morphic information and official links | Works |
| Discussions per library and network-wide | Works |
| Request a trainer; staff update status, assign a trainer, and leave a note | Works |
| Turn a solved question into an editable knowledge-base entry, with consent and credit | Works |
| Searchable shared knowledge base | Works |
| Librarian dashboard: requests, open questions, common problems | Works |
| Reading or applying a patron's Morphic settings | **Planned, not functional.** No documented public interface found |
| JAWS scripts or settings packages | **Planned, not functional.** Would be opt-in and staff-reviewed |
| Library card sign-in (library identity systems) | **Planned** |
| Accessible video and audio lessons | **Planned** |
| Opt-in AI summaries of solved threads | **Planned** |
| Paid peer-trainer network | **Planned** |

Details: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## How it is built

The app uses plain HTML, CSS, and Node.js, with **no runtime dependencies** and **no JavaScript in the browser**. Every page is ordinary server-rendered HTML with real forms. That is the most predictable approach for JAWS, braille displays, and older library computers.

```
server.js                 starts the app
src/app.js                router, sessions, CSRF checks, security headers
src/db.js                 JSON-file data store (swap for SQLite or a hosted database here)
src/auth.js               scrypt password hashing and sessions (swap for library sign-in here)
src/seed.js               fictional demonstration data
src/search.js             keyword search (swap for SQLite FTS or a search service here)
src/views.js, html.js     layout, accessible form components, and escaping
src/routes/               pages: core, learn, community (discussions, knowledge base, requests), libraries (and dashboard)
src/content/              JAWS commands with sources, and lessons
src/integrations/         Morphic, JAWS, and future integrations, each marked planned or available
public/styles.css         the only stylesheet: three themes and four text sizes
tests/                    node:test tests, plus tests/a11y/run-axe.js
docs/                     accessibility, integrations, and privacy notes
```

## Further reading

- [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md): what was tested and what still needs testing by JAWS users
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): JAWS and Morphic research and extension points
- [docs/PRIVACY.md](docs/PRIVACY.md): data collected, and what must change before real use
