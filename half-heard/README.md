# Half-Heard Genius Engine

People mishear each other all the time, and sometimes the mistake is more interesting than what was actually said. This website mishears you on purpose.

You say or type a short phrase. The site shows what the computer heard, then gives you five misunderstandings of it. Each one comes with an invention, a philosophical observation, a joke, or an art idea or poem.

> “I scream” → **Ice cream**: *a freezer that only opens when you shout.*
> “Recognize speech” → **Wreck a nice beach**
> “The human condition” → **The humid condition**: *we are 60 percent water, worried about the weather inside ourselves.*

It works on iPhone Safari and on desktop browsers. You don't need an API key, an account or a build step.

---

## How to use it

1. Press the big **Listen** button. When you hear a short beep, say a short phrase. A second, lower beep means it has stopped listening.
   You can also type a phrase in the box and press **Misunderstand It** (or Enter).
2. Read **What the computer heard**, then the five **Misunderstandings** below it.
3. Use the buttons under the results:
   - **More Misunderstandings** adds five new ones and never repeats one you've already seen.
   - **Read Aloud** reads out what was heard and the newest five results. Press it again (it then says **Stop Reading**) to stop.
   - **Save** keeps the results on this device. Saved items appear in the **Saved** list, and each one has **Copy** and **Delete** buttons.
   - **Copy as Text** copies everything as plain text, ready to paste into a message, document or braille display.

### If voice input isn't available

Some browsers, such as Firefox, have no speech recognition. In that case the page says so straight away, and pressing Listen takes you to the typing box. It never pretends to be listening.

- **iPhone and iPad:** voice input uses Apple's dictation. If you get an error, turn on **Settings → General → Keyboard → Enable Dictation**, then allow microphone access when Safari asks.
- **Chrome and Edge:** voice input works, but the browser sends the audio to its own speech service, so it needs an internet connection.
- Voice input only works on a secure page: an address that starts with `https://` or `http://localhost`.

---

## Accessibility

- It works with VoiceOver (iPhone and Mac), JAWS and NVDA. Every result has a heading, so you can jump between them with your screen reader's heading navigation (the H key on Windows, or the Headings rotor on iPhone).
- Status messages such as "Listening", "5 misunderstandings are ready below" and "Saved" are announced automatically through a polite live region. They're also shown on screen.
- Beeps tell you when listening starts and stops.
- Everything works from the keyboard. Press Tab to move and Enter or Space to press a button. The first Tab stop is a "Skip to results" link.
- Buttons are large: the Listen button is at least 140 pixels tall and the others at least 60.
- Colours are black and white with very high contrast. Dark mode follows your device setting, and Windows High Contrast mode is supported. Focus is shown with a thick outline.
- Nothing depends on colour alone. Every result has written labels such as "How:", "Joke:" and "Invention:", and the Listen button's text changes to "Listening… press to stop".
- There are no menus, pop-ups or hidden gestures.
- **Tip for screen reader users:** when you press Listen, your screen reader may speak at the same moment, and the microphone can pick that up. If that happens, wait for the beep before you speak, or use the typing box.

---

## Running it on your own computer

It is plain HTML, CSS and JavaScript, so any simple web server will do. Open a terminal in the `half-heard` folder and run **one** of these:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open **http://localhost:8000** in your browser.

You can also double-click `index.html` to open it directly. Typing, saving and Read Aloud work that way, but most browsers only allow voice input on `http://localhost` or `https://` pages.

### Testing it without an API key

The built-in engine needs no key at all, so the site works fully as soon as you open it. To check it yourself:

- **By hand:** type `I scream`, `recognize speech`, `break a leg` or `good morning` and press Enter. Then try More, Read Aloud, Save and Copy.
- **Engine tests** (need Node.js 18 or later and nothing else):
  ```bash
  node --test tests/engine.test.js
  ```
- **Browser tests** (Chromium through Playwright, with simulated speech input):
  ```bash
  npm install playwright && npx playwright install chromium
  node tests/browser.test.mjs
  ```
  These check the typed and spoken flows, More, Save and reload, Delete, Copy, Read Aloud, the missing-microphone and denied-permission messages, keyboard reach, the iPhone-width layout, and falling back when a language-model server fails.

---

## Publishing it for free with GitHub Pages

1. Put the `half-heard` folder in a GitHub repository. It is already in this one.
2. On GitHub, open the repository and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose your branch (usually `main`) and the `/ (root)` folder, then press **Save**.
4. Wait a minute or two. The site will be at:
   `https://YOUR-USER-NAME.github.io/YOUR-REPO-NAME/half-heard/`

GitHub Pages uses `https`, so voice input works there, including on iPhone. Nothing else is needed: no build step and no secrets. The `server/` folder is ignored on GitHub Pages, which is fine.

---

## How the engine works

`engine.js` runs entirely in the browser. It collects candidate mishearings using several methods, then mixes them so that each batch of five uses different methods:

| Method | Example |
|---|---|
| Famous mishearing (mondegreens and other well-known slips) | i scream → ice cream, kiss the sky → kiss this guy |
| Homophone | morning → mourning, weather → whether |
| Similar-sounding word | condition → confection, coffee → coffin |
| Sound substitution (a rough sound-alike key matched against a word list) | break → brick, cat → cut |
| Shifted word boundary | a nice → an ice, carpet → car pet, nowhere → now here |
| Taken literally | break a leg → *a request to snap a limb* |
| Double meaning combined | bank → a place for money *and* the side of a river |
| The computer's second guess | other phrases the speech recogniser thought you might have said |
| Double mishearing | two mishearings in the same phrase |
| Heard as an invention | the phrase becomes a product name, e.g. "The Hello 3000" |

Each misunderstanding then gets one idea: an invention, an observation, a joke, or an art concept or poem. Many famous mishearings and idioms have hand-written ideas. The others are filled into templates, and each template is used only once per phrase until the supply runs out. "More Misunderstandings" changes the random seed and leaves out anything already shown.

To make it richer, add entries to the `FAMOUS`, `IDIOMS`, `HOMOPHONE_GROUPS`, `NEAR` or `DOUBLE` lists, or add more `TEMPLATES`, in `engine.js`.

---

## Adding a real language model later

The page is already set up for this, and it keeps the API key safely off the browser.

- `app.js` has two **providers**: the built-in engine and a remote one. The remote one is used only when `llmEndpoint` is set in `index.html`. If it fails or is slow, the page says so and uses the built-in engine instead.
- The remote provider sends `{ phrase, count, avoid, alternatives }` to your server and expects back
  `{ "interpretations": [ { "text", "methodLabel", "explanation", "kindLabel", "idea" } ] }`.
- `server/server.mjs` is a small, ready-made example server. It serves the site and answers `/api/interpret` using Claude. The key stays in an environment variable on the server:

  ```bash
  cd half-heard/server
  npm install
  ANTHROPIC_API_KEY=your-key-here npm start
  # then open http://localhost:8787/?llm=1
  ```

  Without `?llm=1`, or without a key, it just serves the built-in version. You can choose a model with `HALF_HEARD_MODEL` (the default is `claude-opus-5-5`). The server asks the API to retry a declined request on a fallback model automatically (`fallbacks: "default"`).

**Never put an API key in `index.html`, `app.js` or anywhere else in the browser code.** GitHub Pages is public, and anyone could copy the key. To use a language model on a public site, host `server.mjs` (or the same idea as a serverless function) somewhere that can keep secrets, and set `llmEndpoint` to its address.

---

## Files

```
half-heard/
  index.html        the page
  style.css         high-contrast styles, light and dark
  app.js            microphone, read aloud, save, copy, providers
  engine.js         the built-in misunderstanding engine (no key needed)
  tests/            engine tests (Node) and browser tests (Playwright)
  server/           optional: local server + language-model endpoint
```

## Privacy

With the built-in engine, everything you type stays in your browser. Saved results stay in your browser's local storage on this device and nowhere else. Voice input uses your browser's speech service: Apple's dictation on iPhone, or Google's service in Chrome. If you turn on the optional language-model server, your phrase is sent to that server.
