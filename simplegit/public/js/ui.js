// Small helpers for building the page safely and accessibly.

// Creates an element. Text is always inserted as text, never as HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let idCounter = 0;
export const uid = (prefix = 'id') => `${prefix}-${++idCounter}`;

// ----- Screen reader announcements -----

export function announce(text, { assertive = false } = {}) {
  const el = document.getElementById(assertive ? 'announce-assertive' : 'announce-polite');
  el.textContent = '';
  // A short delay makes screen readers notice the change reliably.
  setTimeout(() => { el.textContent = text; }, 120);
}

// ----- Status boxes -----

const PREFIX = { success: 'Done:', error: 'Problem:', warning: 'Please note:', info: 'Note:', working: 'Please wait:' };
const ICON = { success: '✅', error: '⚠️', warning: '❗', info: 'ℹ️', working: '⏳' };

// Builds a message box. The type is always written in words, not only shown by colour.
export function statusBox({ type = 'info', title, message, next, actions = [], extra }) {
  const box = h('div', { class: `status ${type === 'working' ? 'info' : type}`, role: type === 'error' ? 'alert' : null, tabindex: '-1' },
    h('p', { class: 'status-title' }, h('span', { 'aria-hidden': 'true' }, `${ICON[type]} `), `${PREFIX[type]} ${title}`),
    message ? h('p', {}, message) : null,
    next ? h('p', {}, h('strong', {}, 'What you can do: '), next) : null,
    extra || null,
    actions.length ? h('div', { class: 'button-row' }, actions) : null,
  );
  return box;
}

// ----- Talking to the SimpleGit server -----

export class ApiError extends Error {
  constructor(status, info) {
    super(info.message);
    this.status = status;
    Object.assign(this, info);
  }
}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-SimpleGit': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, {
      title: 'SimpleGit is not answering',
      message: 'Your device could not reach SimpleGit. The internet connection may have dropped, or SimpleGit may have stopped running.',
      next: 'Check your internet connection, then press Try Again.',
    });
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || {
      title: 'Something went wrong',
      message: `SimpleGit had an unexpected problem (code ${res.status}).`,
      next: 'Please try again. If it keeps happening, return Home.',
    });
  }
  return data;
}

// ----- Dialog for confirmations -----

// Shows a question with a few large choices. The safe choice comes first and
// gets focus. Resolves with the chosen value (or the first value on Escape).
export function choose({ title, message, choices, details }) {
  const dialog = document.getElementById('dialog');
  const returnFocus = document.activeElement;
  document.getElementById('dialog-title').textContent = title;
  const msg = document.getElementById('dialog-message');
  msg.replaceChildren(...(Array.isArray(message) ? message : [message]).map((m) => (m instanceof Node ? m : h('p', {}, m))), details || '');
  const row = document.getElementById('dialog-buttons');
  return new Promise((resolve) => {
    const finish = (value) => {
      dialog.close();
      resolve(value);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    };
    row.replaceChildren(...choices.map((c) => h('button', {
      type: 'button',
      class: `btn ${c.style || ''}`,
      onclick: () => finish(c.value),
    }, c.label)));
    dialog.oncancel = (e) => { e.preventDefault(); finish(choices[0].value); };
    dialog.showModal();
    row.querySelector('button').focus();
  });
}

export async function confirmAction({ title, message, yes, no = 'No, Go Back', danger = false, details }) {
  const answer = await choose({
    title, message, details,
    choices: [{ label: no, value: false }, { label: yes, value: true, style: danger ? 'danger' : 'primary' }],
  });
  return answer === true;
}

// ----- Copying and sharing -----

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back below */ }
  const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;top:-100px;opacity:0' });
  ta.value = text;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export const canShare = () => typeof navigator.share === 'function';

export async function shareThing({ title, text, url }) {
  try {
    await navigator.share({ title, text, url });
    return 'shared';
  } catch (err) {
    return err && err.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

// Friendly sizes and dates.
export function sizeText(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function whenText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// Safe local storage: never breaks the app if storage is blocked.
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

export const session = {
  get(key, fallback = null) {
    try { const v = sessionStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  remove(key) { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
};

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
