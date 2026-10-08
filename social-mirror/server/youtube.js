// YouTube Data API v3: video metadata + public comment threads (with replies).
const API = 'https://www.googleapis.com/youtube/v3';

export class SourceError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function parseVideoId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url;
  try {
    url = new URL(s.startsWith('http') ? s : 'https://' + s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1, 12) || null;
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.searchParams.get('v')) return url.searchParams.get('v').slice(0, 11);
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

async function ytGet(path, params, key) {
  const url = `${API}/${path}?` + new URLSearchParams({ ...params, key });
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason || `http_${res.status}`;
    const msg = body?.error?.message || `YouTube API returned HTTP ${res.status}`;
    throw new SourceError(`${msg} (${reason})`, reason);
  }
  return body;
}

export async function fetchVideo(videoId, key) {
  const body = await ytGet('videos', { part: 'snippet,statistics', id: videoId }, key);
  const item = body.items?.[0];
  if (!item) throw new SourceError('Video not found or not public.', 'videoNotFound');
  return {
    id: videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    description: item.snippet.description || '',
    publishedAt: item.snippet.publishedAt,
    commentCount: Number(item.statistics?.commentCount ?? NaN),
  };
}

function toComment(videoId, c) {
  const s = c.snippet;
  const author = s.authorDisplayName || 'unknown';
  return {
    id: 'yt:' + c.id,
    platform: 'youtube',
    author,
    authorKey: 'yt:' + (s.authorChannelId?.value || author),
    text: s.textOriginal ?? s.textDisplay ?? '',
    url: `https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`,
    likes: s.likeCount ?? 0,
    publishedAt: s.publishedAt,
    context: 'Comment on this video',
  };
}

export async function fetchComments(videoId, key, maxPages = 5) {
  const comments = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const body = await ytGet(
      'commentThreads',
      {
        part: 'snippet,replies',
        videoId,
        maxResults: '100',
        order: 'relevance',
        textFormat: 'plainText',
        ...(pageToken ? { pageToken } : {}),
      },
      key,
    );
    for (const thread of body.items || []) {
      comments.push(toComment(videoId, thread.snippet.topLevelComment));
      // commentThreads returns up to 5 replies inline; that's enough for a first version.
      for (const reply of thread.replies?.comments || []) comments.push(toComment(videoId, reply));
    }
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return comments;
}
