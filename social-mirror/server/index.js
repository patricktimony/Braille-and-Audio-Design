import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cached } from './cache.js';
import { fetchVideo, fetchComments, parseVideoId } from './youtube.js';
import { fetchRedditComments } from './reddit.js';
import {
  MODEL, PROMPT_VERSION, MAX_COMMENT_CHARS, aggregate, extractDescriptors, identifySubject, quoteIsGenuine,
} from './analyze.js';
import { demoComments, demoLabels } from './demo.js';

const app = express();
app.use(express.json());

// Node's fetch reports network failures as a bare "fetch failed"; surface the underlying cause.
const why = (err) => (err.cause?.code || err.cause?.message ? `${err.message} (${err.cause.code || err.cause.message})` : err.message);

const env = (k) => (process.env[k] || '').trim();
const keys = () => ({
  youtube: !!env('YOUTUBE_API_KEY'),
  anthropic: !!env('ANTHROPIC_API_KEY'),
  reddit: !!(env('REDDIT_CLIENT_ID') && env('REDDIT_CLIENT_SECRET')),
});

app.get('/api/config', (_req, res) => res.json({ keys: keys(), model: MODEL }));

app.post('/api/analyze', async (req, res) => {
  const { url, person: personInput = '', demo = false, refresh = false } = req.body || {};

  if (demo) {
    const terms = aggregate(demoLabels, demoComments);
    return res.json({
      demo: true,
      video: { id: null, title: 'Demo: fictional sample interview', channel: 'Sample data' },
      person: 'Sample Speaker (fictional)',
      personSource: 'demo',
      sources: {
        youtube: { status: 'demo', count: demoComments.filter((c) => c.platform === 'youtube').length },
        reddit: { status: 'demo', count: demoComments.filter((c) => c.platform === 'reddit').length },
        ai: { status: 'demo', note: 'Labels were hand-written for the demo, not produced by the AI.' },
      },
      comments: demoComments,
      terms,
      stats: stats(demoComments, terms),
      cachedAt: null,
    });
  }

  const videoId = parseVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'That does not look like a YouTube video URL.' });
  if (!keys().youtube) {
    return res.status(400).json({
      error: 'YOUTUBE_API_KEY is not set on the server, so no real comments can be loaded. Add it to social-mirror/.env, or try Demo mode.',
    });
  }

  const sources = {};
  let video;
  let ytComments = [];
  try {
    const r = await cached(`yt-video:${videoId}`, () => fetchVideo(videoId, env('YOUTUBE_API_KEY')), { refresh });
    video = r.value;
  } catch (err) {
    return res.status(502).json({ error: `YouTube is unavailable for this video: ${why(err)}` });
  }
  const maxPages = Number(env('YOUTUBE_MAX_PAGES') || 5);
  try {
    const r = await cached(`yt-comments:${videoId}:${maxPages}`, () => fetchComments(videoId, env('YOUTUBE_API_KEY'), maxPages), { refresh });
    ytComments = r.value;
    sources.youtube = { status: 'ok', count: ytComments.length, cachedAt: r.cachedAt, totalOnVideo: video.commentCount };
  } catch (err) {
    sources.youtube = { status: 'unavailable', count: 0, reason: why(err) };
  }

  // Who is the video about? Prefer the user's answer; otherwise ask the model, from title/description only.
  let person = String(personInput).trim();
  let personSource = 'user';
  if (!person && keys().anthropic) {
    try {
      const r = await cached(`subject:${videoId}:${MODEL}`, () => identifySubject(video), { refresh });
      person = r.value;
      personSource = 'ai';
    } catch (err) {
      sources.subjectError = err.message;
    }
  }

  let redditComments = [];
  if (!keys().reddit) {
    sources.reddit = { status: 'not_configured', count: 0, reason: 'REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET are not set.' };
  } else {
    try {
      const maxThreads = Number(env('REDDIT_MAX_THREADS') || 5);
      const r = await cached(`reddit:${videoId}:${person.toLowerCase()}:${maxThreads}`, () =>
        fetchRedditComments({
          person,
          videoId,
          maxThreads,
          creds: {
            clientId: env('REDDIT_CLIENT_ID'),
            clientSecret: env('REDDIT_CLIENT_SECRET'),
            userAgent: env('REDDIT_USER_AGENT') || 'social-mirror/0.1',
          },
        }), { refresh });
      redditComments = r.value.comments;
      sources.reddit = { status: 'ok', count: redditComments.length, threads: r.value.threads, cachedAt: r.cachedAt };
    } catch (err) {
      sources.reddit = { status: 'unavailable', count: 0, reason: why(err) };
    }
  }

  const comments = [...ytComments, ...redditComments];
  let terms = [];
  if (!keys().anthropic) {
    sources.ai = { status: 'not_configured', reason: 'ANTHROPIC_API_KEY is not set, so no word cloud was generated. You can still search the real comments below.' };
  } else if (!person) {
    sources.ai = { status: 'needs_person', reason: 'Could not tell who this video is about from its title. Type the person\'s name and load again.' };
  } else if (comments.length === 0) {
    sources.ai = { status: 'skipped', reason: 'No comments were retrieved, so there is nothing to analyze.' };
  } else {
    try {
      const key = `analysis:v${PROMPT_VERSION}:${MODEL}:${person.toLowerCase()}:${comments.map((c) => c.id).join(',')}`;
      // Only cache complete analyses, so a temporary API failure isn't remembered.
      const r = await cached(key, () => extractDescriptors(person, video, comments), {
        refresh,
        shouldCache: (v) => v.diagnostics.failedBatches.length === 0,
      });
      // Re-verify quotes against the comments we are about to show (defense in depth for cached data).
      const labels = r.value.labels.filter((l) => {
        const c = comments.find((x) => x.id === l.commentId);
        return c && quoteIsGenuine(l.quote, c.text);
      });
      terms = aggregate(labels, comments);
      const d = r.value.diagnostics;
      sources.ai = {
        status: d.failedBatches.length === d.batches ? 'unavailable' : d.failedBatches.length ? 'partial' : 'ok',
        model: MODEL,
        cachedAt: r.cachedAt,
        ...d,
        maxCommentChars: MAX_COMMENT_CHARS,
      };
    } catch (err) {
      sources.ai = { status: 'unavailable', reason: why(err) };
    }
  }

  res.json({ demo: false, video, person, personSource, sources, comments, terms, stats: stats(comments, terms) });
});

function stats(comments, terms) {
  const authors = new Set(comments.map((c) => c.authorKey));
  const describing = new Set(terms.flatMap((t) => t.evidence.map((e) => e.commentId)));
  return {
    comments: comments.length,
    distinctCommenters: authors.size,
    commentsWithDescriptors: describing.size,
    byPlatform: {
      youtube: comments.filter((c) => c.platform === 'youtube').length,
      reddit: comments.filter((c) => c.platform === 'reddit').length,
    },
  };
}

// In production, serve the built frontend from the same port.
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  const k = keys();
  console.log(`Social Mirror API on http://localhost:${port}  keys: youtube=${k.youtube} anthropic=${k.anthropic} reddit=${k.reddit}`);
});
