// Shared screen layout, navigation and state.
import { h, statusBox, announce, api, store, confirmAction } from './ui.js';
import { setInstruction } from './speech.js';

export const state = {
  me: null,
  nav: 0, // increases on every screen change, so slow answers for old screens are ignored
  dirty: false,
  flash: null,
  back: null,
  projects: new Map(),
};

export const view = () => document.getElementById('view');

const enc = encodeURIComponent;
export const pathPart = (path) => (path ? `/${path.split('/').map(enc).join('/')}` : '');
export const projectHash = (owner, repo, screen = '', path = '') =>
  `#/p/${enc(owner)}/${enc(repo)}${screen ? `/${screen}` : ''}${pathPart(path)}`;

export function go(hash) {
  if (location.hash === hash || (hash === '#/' && !location.hash)) window.dispatchEvent(new Event('sg:render'));
  else location.hash = hash;
}

export const rerender = () => window.dispatchEvent(new Event('sg:render'));

// A message to show on the next screen (for example "Saved").
export function setFlash(f) { state.flash = f; }

export function setDirty(flag) { state.dirty = flag; }

// Returns true if it is fine to leave (no unsaved work, or the person agreed).
export async function okToLeave() {
  if (!state.dirty) return true;
  const leave = await confirmAction({
    title: 'Leave without saving?',
    message: 'You have changes that are not saved yet. If you leave now, they will be lost.',
    no: 'Stay Here',
    yes: 'Leave Without Saving',
    danger: true,
  });
  if (leave) state.dirty = false;
  return leave;
}

export function loading(text = 'Loading…') {
  document.title = 'Loading – SimpleGit';
  view().replaceChildren(h('p', { class: 'loading' }, h('span', { 'aria-hidden': 'true' }, '⏳ '), text));
  view().setAttribute('aria-busy', 'true');
  announce(text);
}

// Shows a whole screen: heading, one short instruction, messages, content.
export function page({ title, heading, kicker, instruction, back = '#/', body = [] }) {
  document.title = `${title} – SimpleGit`;
  const h1 = h('h1', { tabindex: '-1' }, heading || title);
  const statusArea = h('div', { id: 'status-area' });
  const flash = state.flash;
  state.flash = null;
  if (flash) statusArea.append(statusBox(flash));
  view().removeAttribute('aria-busy');
  view().replaceChildren(
    kicker ? h('p', { class: 'kicker' }, kicker) : '',
    h1,
    instruction ? h('p', { class: 'instruction' }, instruction) : '',
    statusArea,
    ...body,
  );
  setBack(back);
  window.scrollTo(0, 0);
  h1.focus();
  setInstruction([heading || title, instruction].filter(Boolean).join('. '));
  if (flash) setTimeout(() => announce(`${flash.title}. ${flash.message || ''}`), 600);
  return { statusArea };
}

// Shows a message inside the current screen.
export function showStatus(info) {
  const area = document.getElementById('status-area');
  if (!area) return;
  const box = statusBox(info);
  area.replaceChildren(box);
  if (info.type === 'error' || info.focus) box.focus();
  else announce(`${info.title}. ${info.message || ''}`, { assertive: false });
}

export function clearStatus() {
  document.getElementById('status-area')?.replaceChildren();
}

export function showError(err, { retry } = {}) {
  const actions = [];
  if (err.signedOut) actions.push(h('a', { class: 'btn primary', href: '/auth/login' }, 'Sign in with GitHub'));
  else if (retry) actions.push(h('button', { type: 'button', class: 'btn primary', onclick: retry }, 'Try Again'));
  showStatus({ type: 'error', title: err.title || 'Something went wrong', message: err.message, next: err.next, actions });
}

// A whole screen for when a screen could not load.
export function errorPage(err, back = '#/') {
  page({
    title: err.title || 'Something went wrong',
    instruction: err.next || 'Please try again.',
    back,
    body: [],
  });
  const actions = [];
  if (err.signedOut) actions.push(h('a', { class: 'btn primary', href: '/auth/login' }, 'Sign in with GitHub'));
  else actions.push(h('button', { type: 'button', class: 'btn primary', onclick: rerender }, 'Try Again'));
  actions.push(h('a', { class: 'btn', href: '#/' }, 'Go Home'));
  document.getElementById('status-area').append(statusBox({ type: 'error', title: err.title || 'Something went wrong', message: err.message, actions }));
  announce(`${err.title}. ${err.message || ''}`, { assertive: true });
}

function setBack(back) {
  state.back = back;
  const btn = document.getElementById('back-button');
  if (back) {
    btn.removeAttribute('aria-disabled');
  } else {
    // Kept focusable and in the same place; it simply explains itself.
    btn.setAttribute('aria-disabled', 'true');
  }
}

// ----- Projects -----

export async function getProject(owner, repo, { fresh = false } = {}) {
  const key = `${owner}/${repo}`.toLowerCase();
  if (!fresh && state.projects.has(key)) return state.projects.get(key);
  const { project } = await api('GET', `/projects/${enc(owner)}/${enc(repo)}`);
  rememberProject(project);
  return project;
}

export function rememberProject(project) {
  state.projects.set(`${project.owner}/${project.name}`.toLowerCase(), project);
  store.set('sg.current', { owner: project.owner, name: project.name });
}

export function forgetProjectCache(owner, repo) {
  state.projects.delete(`${owner}/${repo}`.toLowerCase());
}

export function projectLine(p) {
  return h('p', { class: 'project-line' },
    'Project: ', h('strong', {}, p.name),
    h('span', { class: 'tag' }, p.private ? 'Private' : 'Public'));
}

export const visibilityText = (p) => (p.private
  ? 'Private: only you and people you invite can see it.'
  : 'Public: anyone on the internet can see it, but only you and people you invite can change it.');

// A big button-like link or button with a title and short description.
export function menuItem({ label, desc, icon, href, onClick, primary = false, number }) {
  const inner = [
    h('span', { class: 'menu-icon', 'aria-hidden': 'true' }, icon || '•'),
    h('span', { class: 'menu-label' }, number ? h('span', { class: 'menu-number' }, `${number}.`) : '', label),
    desc ? h('span', { class: 'menu-desc' }, desc) : '',
  ];
  const cls = `menu-item${primary ? ' primary' : ''}`;
  const el = href ? h('a', { class: cls, href }, inner) : h('button', { type: 'button', class: cls, onclick: onClick }, inner);
  return h('li', {}, el);
}

export function breadcrumbs(project, path, screen) {
  const parts = path ? path.split('/') : [];
  if (!parts.length) return '';
  const items = [h('li', {}, parts.length
    ? h('a', { href: projectHash(project.owner, project.name, screen) }, project.name)
    : h('span', { 'aria-current': 'location' }, project.name))];
  parts.forEach((part, i) => {
    const sub = parts.slice(0, i + 1).join('/');
    items.push(h('li', {}, i === parts.length - 1
      ? h('span', { 'aria-current': 'location' }, part)
      : h('a', { href: projectHash(project.owner, project.name, screen, sub) }, part)));
  });
  return h('nav', { class: 'breadcrumbs', 'aria-label': 'You are here' }, h('ol', {}, items));
}

export const parentPath = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const baseName = (path) => path.split('/').pop();
