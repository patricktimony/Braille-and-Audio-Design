# SimpleGit

**A very simple, accessible way to use GitHub, for people who have never programmed.**

> GitHub should adapt to human beings. Human beings should not have to adapt to GitHub.

SimpleGit has seven big buttons:

1. **My Projects**: see all your projects, with their descriptions.
2. **Start a Project**: make a new project, one question at a time.
3. **Open a Project**: look through folders and read files, with a plain-English note about what each file is.
4. **Change a Project**: add, edit, replace, rename or delete files, and create folders. One big **Save Changes** button. Warnings before anything is deleted or overwritten. **Undo** after every change.
5. **Share a Project**: copy or send a link, or invite someone to help.
6. **Download a Project**: one button gives you the whole project as a ZIP file.
7. **Try My Project**: open your project as a working website, or publish it for free with GitHub Pages, then send the link to someone.

It never uses words like repository, commit, branch, merge, fork, pull request, clone, push or deployment.

**To set it up, follow [SETUP.md](SETUP.md).** It is written in plain English, one step at a time.

---

## From Claude Code to "try my app"

1. Make an app with Claude Code and let it save the app to GitHub.
2. Open SimpleGit → **My Projects** → choose the app.
3. **Open this project** to look at it, or **Change this project** to fix a word or swap a picture. Press **Save Changes**.
4. **Try this project** → **Publish My Project** (if it can be published) → confirm.
5. When it says the website is working, press **Copy Website Link** or **Share Website** and send it.

Try My Project decides honestly what can be published:

| What is in the project | What SimpleGit does |
| --- | --- |
| Plain web pages (`index.html`, or other `.html` pages) | Publishes it with GitHub Pages from the main folder |
| Web pages in a `docs` folder | Publishes the `docs` folder |
| A Vite or Create React App project | Adds a small GitHub Actions file that builds the app and publishes it on every save |
| A finished site in `dist`, `build`, `public`… | Publishes that folder |
| Mostly writing (Markdown) | Publishes it as a simple website |
| An app that needs a server (Express, Flask, Next.js, PHP, databases…) | Explains why GitHub Pages can't run it, lists other hosting options with their costs, and **never connects to any of them**. Offers a request you can paste into Claude Code. |

Before publishing, or before making a project public, SimpleGit checks the files
for passwords, keys and private settings files (`.env`, private keys, `sk-…`,
`ghp_…`, `AKIA…` and so on). If it finds one, it refuses. Possible matches
must be confirmed by the person first. Private projects are never made public
without a separate, explicit confirmation.

---

## How it works (for helpers and developers)

```
Browser (plain HTML/CSS/JS, no build step)
   │  same-origin requests only, with an X-SimpleGit header
   ▼
SimpleGit server (Node.js + Express)          ← keeps the GitHub token here
   │  GitHub REST API, as the signed-in person
   ▼
GitHub (GitHub App user-to-server tokens)
```

- **Sign-in:** GitHub App OAuth (web flow with a `state` check). The access
  token and refresh token live only inside an encrypted, `HttpOnly`,
  `SameSite=Lax` cookie ([iron-session](https://github.com/vvo/iron-session)).
  Browser code never sees them. Tokens that expire are refreshed automatically.
- **One-click setup:** the setup page uses GitHub's
  [App Manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
  to create a private GitHub App with narrow permissions, and stores its
  client ID and secret in `.env` (file mode 600). The app's private key is
  thrown away. Setup only works from the computer running SimpleGit, unless
  `ALLOW_REMOTE_SETUP=1` is set.
- **GitHub App permissions:** Contents (read and write), Metadata (read),
  Administration (read and write: create projects, invite helpers, change
  public/private), Pages (read and write), Workflows (read and write: only
  for publishing apps that need building), Actions (read: build progress).
- **Saving:** single-file changes use the Contents API with the file's `sha`.
  If the file changed since it was opened, GitHub rejects the save, and
  SimpleGit asks the person what to do. Rename, folder delete and Undo use the
  Git Data API (tree, then commit, then a non-forced ref update), so each is
  one change that fails safely if something else was saved at the same moment.
  Everything happens on the default branch, so people never see branches.
- **Security:** Helmet with a strict Content Security Policy (`script-src
  'self'`, no inline scripts, `frame-ancestors 'none'`). State-changing
  requests need a custom header, which blocks cross-site forgery. File paths
  are checked. Files that aren't pictures are always sent as sandboxed
  downloads. The website checker refuses private network addresses (SSRF
  protection). By default the server listens only on `127.0.0.1`.
- **Errors:** every GitHub error, including rate limits (with the time to
  wait), is turned into a title, a plain-English message and "What you can do".
- **Dependencies:** `express`, `helmet`, `iron-session`. Tests use
  `playwright` and `@axe-core/playwright`. No paid services.

### Folder layout

```
server/        index.js (start), routes.js (API, sign-in, setup),
               github.js (API client, friendly errors), analyze.js
               (Try My Project detection, secret scan, website check),
               config.js
public/        index.html, styles.css, js/ (app.js router, core.js layout,
               ui.js helpers, speech.js, explain.js, screens-*.js)
test/          e2e.test.js (browser + axe), server.test.js,
               mock-github.js (fake GitHub API), harness.js, demo.js
```

### Commands

```bash
npm install          # first time
npm start            # run on http://localhost:3000
npm test             # 43 automated tests, including axe accessibility checks
node test/demo.js    # try SimpleGit with made-up projects (no GitHub account needed)
```

## Known limits of this first version

- Changes always go to the project's main copy (default branch). Projects that
  require reviews before changes ("branch protection") get a clear message,
  but can't be changed through SimpleGit.
- Files up to 25 MB can be uploaded. Files up to 1 MB can be shown and edited.
- Try My Project can build Vite and Create React App projects automatically.
  Other build tools (Astro, Next.js, Angular…) are explained, not built.
- Publishing a private project needs a paid GitHub plan. SimpleGit explains
  this and offers to make the project public (after a safety check). It never
  signs anyone up for anything.
- Tested automatically in Chromium. Manual testing with JAWS, NVDA and
  VoiceOver is still needed. See [ACCESSIBILITY.md](ACCESSIBILITY.md).
