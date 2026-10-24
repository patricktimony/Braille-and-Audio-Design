// Talks to GitHub's official REST API on behalf of the signed-in person, and
// turns GitHub's errors into plain English.
import { config } from './config.js';

const API_VERSION = '2022-11-28';

export class FriendlyError extends Error {
  constructor(status, title, message, next, extra = {}) {
    super(message);
    this.status = status;
    this.title = title;
    this.next = next;
    this.extra = extra;
  }
  toJSON() {
    return { error: { title: this.title, message: this.message, next: this.next, ...this.extra } };
  }
}

export class GitHubError extends Error {
  constructor(status, body, headers) {
    super((body && body.message) || `GitHub answered with status ${status}`);
    this.status = status;
    this.body = body || {};
    this.headers = headers;
  }
}

function timeText(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  const minutes = Math.max(1, Math.ceil((d - Date.now()) / 60000));
  return minutes <= 1 ? 'in about a minute' : `in about ${minutes} minutes`;
}

// Converts any error into a FriendlyError a person can act on.
export function toFriendly(err, what = 'do that') {
  if (err instanceof FriendlyError) return err;
  if (!(err instanceof GitHubError)) {
    console.error(err);
    return new FriendlyError(502, 'We could not reach GitHub',
      `SimpleGit could not connect to GitHub to ${what}. This is usually a temporary internet problem.`,
      'Check that you are connected to the internet, then try again in a minute.');
  }
  const { status, headers, body } = err;
  const said = String(body.message || '');
  if (/archived/i.test(said)) {
    return new FriendlyError(403, 'This project is stored away as read-only',
      'The owner has archived this project, which means nobody can change it at the moment.',
      'The owner can un-archive it on GitHub\'s website, in the project\'s settings.');
  }
  if (/protected branch|pull request|status check|required review|rule violation/i.test(said)) {
    return new FriendlyError(403, 'This project needs changes to be reviewed first',
      'This project has a safety setting that only allows changes after someone reviews them. SimpleGit cannot do reviews yet.',
      'Ask the owner to turn off this setting (called "branch protection") on GitHub\'s website, or make the change with another tool.');
  }
  const remaining = headers?.get('x-ratelimit-remaining');
  const reset = Number(headers?.get('x-ratelimit-reset'));
  if (status === 429 || (status === 403 && (remaining === '0' || /rate limit/i.test(body.message || '')))) {
    return new FriendlyError(429, 'GitHub asked us to slow down',
      'GitHub limits how many things can be done in a short time, and that limit has been reached.',
      `Please wait and try again ${reset ? timeText(reset) : 'in a few minutes'}. Nothing has been lost.`);
  }
  if (status === 401) {
    return new FriendlyError(401, 'You need to sign in again',
      'Your GitHub sign-in has ended. This happens after a while for your safety.',
      'Press the Sign in with GitHub button to continue.', { signedOut: true });
  }
  if (status === 403) {
    return new FriendlyError(403, 'You do not have permission',
      `GitHub did not allow SimpleGit to ${what}.`,
      'If this is someone else\'s project, ask the owner to let you help. If it is your own project, make sure SimpleGit is allowed to use it (see the help page).');
  }
  if (status === 404) {
    return new FriendlyError(404, 'We could not find that',
      `GitHub could not find what was needed to ${what}. It may have been moved, renamed or deleted, or SimpleGit may not be allowed to see it.`,
      'Go back and try again. If this keeps happening, return Home and choose the project again.');
  }
  if (status === 409) {
    return new FriendlyError(409, 'Something changed in the meantime',
      'This was changed by someone else, or in another program, after you opened it.',
      'Go back, open it again to see the newest version, and then make your change again.', { code: 'changed' });
  }
  if (status === 422) {
    return new FriendlyError(422, 'GitHub could not accept this',
      `GitHub could not ${what}. GitHub said: "${body.message || 'Invalid request'}"${
        body.errors?.[0]?.message ? ` (${body.errors[0].message})` : ''}.`,
      'Check what you typed and try again.');
  }
  return new FriendlyError(502, 'GitHub is having trouble',
    `GitHub had a problem when SimpleGit tried to ${what}.`,
    'Please try again in a minute. If it keeps happening, GitHub may be having an outage.');
}

async function refreshIfNeeded(session) {
  if (!session.refreshToken || !session.expiresAt) return;
  if (session.expiresAt - Date.now() > 60_000) return;
  const res = await fetch(`${config.webUrl}/login/oauth/access_token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new GitHubError(401, { message: 'Refresh failed' });
  storeTokens(session, data);
  await session.save();
}

export function storeTokens(session, data) {
  session.token = data.access_token;
  session.refreshToken = data.refresh_token || undefined;
  session.expiresAt = data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined;
}

// Returns a small GitHub client bound to one person's session.
export function github(session) {
  async function request(method, apiPath, { body, query, accept, raw } = {}) {
    if (!session.token) throw new GitHubError(401, { message: 'Not signed in' });
    await refreshIfNeeded(session);
    const url = new URL(config.apiUrl + apiPath);
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, v);
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${session.token}`,
          Accept: accept || 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'SimpleGit',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error(`Network error talking to GitHub: ${err.message}`);
    }
    if (raw && res.ok) return res;
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    if (!res.ok) throw new GitHubError(res.status, data, res.headers);
    return data;
  }

  // Follows GitHub's "next page" links, up to a sensible limit.
  async function paginate(apiPath, query = {}, maxPages = 5) {
    const all = [];
    for (let page = 1; page <= maxPages; page++) {
      const items = await request('GET', apiPath, { query: { per_page: 100, ...query, page } });
      const list = Array.isArray(items) ? items : (items.repositories || items.installations || []);
      all.push(...list);
      if (list.length < 100) break;
    }
    return all;
  }

  return {
    request,
    paginate,
    get: (p, o) => request('GET', p, o),
    post: (p, body, o) => request('POST', p, { ...o, body }),
    put: (p, body, o) => request('PUT', p, { ...o, body }),
    patch: (p, body, o) => request('PATCH', p, { ...o, body }),
    del: (p, body, o) => request('DELETE', p, { ...o, body }),
  };
}

export const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
