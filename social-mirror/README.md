# Social Mirror

Paste a YouTube URL. The video plays on the left. On the right is a word cloud of how people **publicly describe the person** in the video's YouTube comments and in related Reddit threads. Click any word to see the actual comments behind it.

## Run it

```bash
cd social-mirror
npm install
cp .env.example .env    # then add your keys (below)
npm run dev
```

Open **http://localhost:5173**. The API server runs on port 3001, and Vite proxies `/api` to it.

**Demo mode** works with no keys. It uses clearly labeled, fictional sample data.

## Featured people

The home page lists recent short clips of **Billy Corgan, Jordan Peterson and Matt Walsh**. Click any clip to load it with that person's word cloud. You can also type another name under "Find clips of someone else".

Clips are found live through YouTube search, not hardcoded, so they stay current. A clip is shown only if it:
- was published in the last 6 months
- is under 20 minutes long
- names the person in its title or description
- has at least 20 comments

Each search uses about 200 of YouTube's free 10,000 daily quota units and is cached for 24 hours. To change the list, set `FEATURED_PEOPLE` in `.env`.

## Use it on your iPhone

**Option A: from your Mac on the same Wi-Fi (free, simplest).**

1. On the Mac, run `npm start` (not `npm run dev`). It prints a line like
   `Open on your phone: http://192.168.1.23:3001`.
2. Type that address into Safari on the iPhone. The phone and Mac must be on the same Wi-Fi.
3. If macOS asks whether to allow **node** to accept incoming connections, click **Allow**.
4. Optional: in Safari, tap Share → **Add to Home Screen** to get an app icon.

The Mac must stay awake with Terminal open while you use it.

**Option B: host it online (works anywhere, Mac can be off).**
The repo includes `render.yaml` for [Render](https://render.com):

1. Sign in to Render with GitHub → **New** → **Blueprint** → choose this repository.
2. When asked, fill in `APP_PASSWORD` (pick one; it stops strangers from spending your API credits) and your API keys.
3. When the deploy finishes, open the `https://social-mirror-….onrender.com` address on your iPhone and enter the password (any username).

The free plan sleeps when idle; the first visit after a while takes about a minute to wake up.

## API keys (server only, in `social-mirror/.env`)

| Variable | Needed for | Where to get it |
|---|---|---|
| `YOUTUBE_API_KEY` | Real YouTube comments | Google Cloud Console → enable **YouTube Data API v3** → Credentials → Create API key |
| `ANTHROPIC_API_KEY` | Building the word cloud (AI labeling) | https://console.anthropic.com → API keys |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Reddit comments (optional) | https://www.reddit.com/prefs/apps → create app → type **script** |
| `APP_PASSWORD` | Optional password prompt (any username) | Choose one. Recommended when hosted or on shared Wi-Fi |

Restart `npm run dev` after editing `.env`. The header shows which keys the server sees. Keys never reach the browser.

## How it stays honest

- **Comments are fetched, never generated.** YouTube Data API v3 provides up to 500 comment threads (most relevant first) plus inline replies. Reddit uses the official OAuth API and covers threads that link the video plus threads whose title names the person.
- **The AI only labels.** For every comment, Claude returns short descriptors (for example "snide" or "warm"), each with a category, a polarity, and an **exact quote**. The server throws out any label whose quote does not appear word-for-word in that comment, and shows how many were discarded.
- **Counts come from code, not the model.** Word size is the number of **distinct commenters**: one person saying "arrogant" three times counts once.
- **The evidence panel separates three things.** The AI label is marked as an AI summary. Commenters who **used the word themselves** are listed apart from those the AI **grouped under it**. Every comment links to its source.
- **"Did anyone actually say it?"** is a plain text search over every retrieved comment, with no AI. Use it to check any word, even one that isn't in the cloud.
- **Categories:** personality, facial expressions, voice, and mannerisms (about the person) are kept separate from music/work, politics, and other topics.
- Nothing is inferred from the video or the person's face. "Facial expressions" means what commenters wrote about expressions.
- If a source fails, the Sample size and sources panel says so and gives the reason. No placeholder data is ever substituted.

## Cache

Results are cached as JSON in `social-mirror/.cache/` for 24 hours (`CACHE_HOURS`). Reloading a video costs no API calls. An analysis with any failed batch is not cached. **Re-fetch (bypass cache)** forces a fresh pull.

## Other scripts

- `npm test` runs unit tests for quote verification, word matching, distinct-commenter counting, and URL parsing.
- `npm start` builds the frontend and serves everything from http://localhost:3001.
