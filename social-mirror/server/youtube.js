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

// "PT1H2M3S" -> seconds
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return null;
  const [, d = 0, h = 0, min = 0, s = 0] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

// Recent, short-ish public clips that name the person and have enough comments to analyze.
export async function searchClips(person, key, { days = 180, maxSeconds = 20 * 60, minComments = 20, limit = 6 } = {}) {
  const publishedAfter = new Date(Date.now() - days * 86400_000).toISOString();
  const ids = new Set();
  // YouTube's duration filter: "short" is under 4 minutes, "medium" is 4–20 minutes.
  for (const videoDuration of ['short', 'medium']) {
    const body = await ytGet(
      'search',
      { part: 'snippet', type: 'video', q: person, maxResults: '15', order: 'relevance', videoDuration, publishedAfter, relevanceLanguage: 'en' },
      key,
    );
    for (const item of body.items || []) ids.add(item.id.videoId);
  }
  if (!ids.size) return [];
  const body = await ytGet('videos', { part: 'snippet,contentDetails,statistics', id: [...ids].join(',') }, key);
  const surname = person.trim().split(/\s+/).pop().toLowerCase();
  return (body.items || [])
    .map((v) => ({
      id: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
      seconds: parseDuration(v.contentDetails?.duration),
      // commentCount is absent when comments are turned off.
      commentCount: v.statistics?.commentCount == null ? null : Number(v.statistics.commentCount),
      mentionsPerson: `${v.snippet.title} ${v.snippet.description}`.toLowerCase().includes(surname),
    }))
    .filter((c) => c.mentionsPerson && c.commentCount >= minComments && c.seconds != null && c.seconds <= maxSeconds)
    .sort((a, b) => b.commentCount - a.commentCount)
    .slice(0, limit);
}
