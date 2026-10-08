import 'dotenv/config';
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cached } from './cache.js';
import { fetchVideo, fetchComments, parseVideoId, searchClips } from './youtube.js';
import { fetchRedditComments } from './reddit.js';
import {
  MODEL, PROMPT_VERSION, MAX_COMMENT_CHARS, aggregate, extractDescriptors, identifySubject, quoteIsGenuine,
} from './analyze.js';
import { demoComments, demoLabels } from './demo.js';

const app = express();
app.get('/healthz', (_req, res) => res.send('ok')); // for hosting health checks; reveals nothing

// Optional password for when the app is reachable by others (hosted, or on shared Wi-Fi),
// so strangers can't spend your API credits. Any username works; the password must match.
const APP_PASSWORD = (process.env.APP_PASSWORD || '').trim();
if (APP_PASSWORD) {
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    const given = Buffer.from(scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':') : '');
    const want = Buffer.from(APP_PASSWORD);
    if (given.length === want.length && timingSafeEqual(given, want)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Social Mirror", charset="UTF-8"').status(401).send('Password required.');
  });
}

app.use(express.json());

// Node's fetch reports network failures as a bare "fetch failed"; surface the underlying cause.
const why = (err) => (err.cause?.code || err.cause?.message ? `${err.message} (${err.cause.code || err.cause.message})` : err.message);

const env = (k) => (process.env[k] || '').trim();
const keys = () => ({
  youtube: !!env('YOUTUBE_API_KEY'),
  anthropic: !!env('ANTHROPIC_API_KEY'),
  reddit: !!(env('REDDIT_CLIENT_ID') && env('REDDIT_CLIENT_SECRET')),
});

app.get('/api/config', (_req, res) => res.json({ keys: keys(), model: MODEL, featured: featuredPeople() }));

const featuredPeople = () =>
  (env('FEATURED_PEOPLE') || 'Billy Corgan, Jordan Peterson, Matt Walsh').split(',').map((s) => s.trim()).filter(Boolean);

// Recent short clips of a person, found live through YouTube search (cached, since each search costs 100 quota units).
app.get('/api/clips', async (req, res) => {
  const person = String(req.query.person || '').trim().slice(0, 80);
  if (!person) return res.status(400).json({ error: 'Missing person.' });
  if (!keys().youtube) {
    return res.status(400).json({ error: 'Finding clips needs YOUTUBE_API_KEY on the server.' });
  }
  try {
    const r = await cached(`clips:v1:${person.toLowerCase()}`, () => searchClips(person, env('YOUTUBE_API_KEY')));
    res.json({ person, clips: r.value, cachedAt: r.cachedAt });
  } catch (err) {
    res.status(502).json({ error: `YouTube search is unavailable: ${why(err)}` });
  }
});

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
  if (process.env.NODE_ENV === 'production') {
    console.log(`\n  Open on this computer:  http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  Open on your phone:     http://${ip}:${port}   (same Wi-Fi)`);
    console.log(APP_PASSWORD ? '  Password protection: ON\n' : '  Password protection: off (set APP_PASSWORD in .env to turn it on)\n');
  }
});

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}
