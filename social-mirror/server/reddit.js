// Reddit via the official OAuth API (app-only "client_credentials" grant).
import { SourceError } from './youtube.js';

let token = null; // { value, expiresAt }

async function getToken({ clientId, clientSecret, userAgent }) {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new SourceError(`Reddit auth failed (HTTP ${res.status}${body.error ? ': ' + body.error : ''})`, 'auth');
  }
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function rGet(path, params, creds) {
  const t = await getToken(creds);
  const res = await fetch(`https://oauth.reddit.com${path}?` + new URLSearchParams({ raw_json: '1', ...params }), {
    headers: { Authorization: `Bearer ${t}`, 'User-Agent': creds.userAgent },
  });
  if (!res.ok) throw new SourceError(`Reddit API returned HTTP ${res.status} for ${path}`, `http_${res.status}`);
  return res.json();
}

function walk(children, post, out) {
  for (const child of children || []) {
    if (child.kind !== 't1') continue;
    const d = child.data;
    const removed = d.body === '[deleted]' || d.body === '[removed]';
    if (!removed && d.author !== 'AutoModerator' && d.body) {
      out.push({
        id: 'rd:' + d.id,
        platform: 'reddit',
        author: 'u/' + d.author,
        authorKey: 'rd:' + d.author,
        text: d.body,
        url: 'https://www.reddit.com' + d.permalink,
        likes: d.score ?? 0,
        publishedAt: new Date(d.created_utc * 1000).toISOString(),
        context: `r/${post.subreddit}: "${post.title}"`,
      });
    }
    if (d.replies?.data?.children) walk(d.replies.data.children, post, out);
  }
}

// Finds threads that link this video, plus threads whose title names the person.
export async function fetchRedditComments({ person, videoId, creds, maxThreads = 5 }) {
  const posts = new Map();
  const searches = [`url:${videoId}`];
  if (person) searches.push(`title:"${person}"`);
  for (const q of searches) {
    const body = await rGet('/search', { q, sort: 'relevance', t: 'all', limit: '25', type: 'link' }, creds);
    for (const c of body.data?.children || []) {
      if (!posts.has(c.data.id)) posts.set(c.data.id, { ...c.data, matchedBy: q.startsWith('url:') ? 'links this video' : 'title names the person' });
    }
  }
  const chosen = [...posts.values()]
    .filter((p) => p.num_comments > 0)
    .sort((a, b) => (a.matchedBy === b.matchedBy ? b.num_comments - a.num_comments : a.matchedBy === 'links this video' ? -1 : 1))
    .slice(0, maxThreads);

  const comments = [];
  for (const post of chosen) {
    const body = await rGet(`/comments/${post.id}`, { limit: '200', depth: '4', sort: 'top' }, creds);
    walk(body?.[1]?.data?.children, post, comments);
  }
  return {
    comments,
    threads: chosen.map((p) => ({
      title: p.title,
      subreddit: p.subreddit,
      url: 'https://www.reddit.com' + p.permalink,
      numComments: p.num_comments,
      matchedBy: p.matchedBy,
    })),
  };
}
