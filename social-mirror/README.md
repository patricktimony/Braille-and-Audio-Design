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

## API keys (server only, in `social-mirror/.env`)

| Variable | Needed for | Where to get it |
|---|---|---|
| `YOUTUBE_API_KEY` | Real YouTube comments | Google Cloud Console → enable **YouTube Data API v3** → Credentials → Create API key |
| `ANTHROPIC_API_KEY` | Building the word cloud (AI labeling) | https://console.anthropic.com → API keys |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Reddit comments (optional) | https://www.reddit.com/prefs/apps → create app → type **script** |

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
