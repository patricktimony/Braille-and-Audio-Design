// SimpleGit: starts the app and decides which screen to show.
import { api, announce, confirmAction } from './ui.js';
import { state, errorPage, okToLeave, go } from './core.js';
import { initSpeech, stopSpeaking } from './speech.js';
import {
  welcome, signinProblem, setup, needsInstall, home, projectList, projectHome, startProject, download, help,
} from './screens-main.js';
import {
  folderScreen, fileScreen, changeFileScreen, editScreen, newFileScreen, uploadScreen, renameScreen, newFolderScreen,
} from './screens-files.js';
import { shareScreen } from './screens-share.js';
import { tryScreen } from './screens-try.js';

const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const decPath = (s) => (s ? s.split('/').map(dec).join('/') : '');

// Screens that work without signing in.
const PUBLIC = [
  [/^help$/, help],
  [/^setup(?:\/(\w+))?$/, setup],
  [/^signin-problem\/(\w+)$/, signinProblem],
];

const ROUTES = [
  [/^$/, home],
  [/^projects$/, () => projectList()],
  [/^choose\/(open|change|share|download|try)$/, (a) => projectList(a)],
  [/^start(?:\/(\d))?$/, startProject],
  [/^p\/([^/]+)\/([^/]+)$/, (o, r) => projectHome(dec(o), dec(r))],
  [/^p\/([^/]+)\/([^/]+)\/(open|change)(?:\/(.*))?$/, (o, r, mode, path) => folderScreen(dec(o), dec(r), decPath(path), mode)],
  [/^p\/([^/]+)\/([^/]+)\/file\/(.+)$/, (o, r, path) => fileScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/changefile\/(.+)$/, (o, r, path) => changeFileScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/edit\/(.+)$/, (o, r, path) => editScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/replace\/(.+)$/, (o, r, path) => uploadScreen(dec(o), dec(r), decPath(path), true)],
  [/^p\/([^/]+)\/([^/]+)\/upload(?:\/(.*))?$/, (o, r, path) => uploadScreen(dec(o), dec(r), decPath(path), false)],
  [/^p\/([^/]+)\/([^/]+)\/rename\/(.+)$/, (o, r, path) => renameScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/newfile(?:\/(.*))?$/, (o, r, path) => newFileScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/newfolder(?:\/(.*))?$/, (o, r, path) => newFolderScreen(dec(o), dec(r), decPath(path))],
  [/^p\/([^/]+)\/([^/]+)\/share(?:\/(see|help|public))?$/, (o, r, sub) => shareScreen(dec(o), dec(r), sub)],
  [/^p\/([^/]+)\/([^/]+)\/download$/, (o, r) => download(dec(o), dec(r))],
  [/^p\/([^/]+)\/([^/]+)\/try(?:\/(publish|progress))?$/, (o, r, sub) => tryScreen(dec(o), dec(r), sub)],
];

const routeOf = () => location.hash.replace(/^#\/?/, '').replace(/\/$/, '');

function match(table, route) {
  for (const [re, fn] of table) {
    const m = route.match(re);
    if (m) return () => fn(...m.slice(1));
  }
  return null;
}

async function loadMe() {
  if (state.me) return state.me;
  state.me = await api('GET', '/me');
  const who = document.getElementById('signed-in-as');
  const signOut = document.getElementById('sign-out');
  if (state.me.signedIn && state.me.user) {
    who.textContent = `Signed in as ${state.me.user.name}`;
    signOut.hidden = false;
  } else {
    who.textContent = '';
    signOut.hidden = true;
  }
  return state.me;
}

async function render() {
  state.nav++;
  stopSpeaking();
  const route = routeOf();
  const publicScreen = match(PUBLIC, route);
  try {
    await loadMe();
  } catch (err) {
    if (publicScreen) { publicScreen(); return; }
    errorPage(err);
    return;
  }
  if (publicScreen) { publicScreen(); return; }
  const me = state.me;
  if (!me.configured) { setup(); return; }
  if (!me.signedIn) { welcome(); return; }
  if (me.needsInstall) { needsInstall(); return; }
  const screen = match(ROUTES, route);
  if (screen) {
    await screen();
  } else {
    errorPage({ title: 'We could not find that page', message: 'The address does not match anything in SimpleGit.', next: 'Press Home to start again.' });
  }
}

// ----- Navigation, with protection for unsaved work -----

let currentHash = location.hash;

window.addEventListener('hashchange', async () => {
  if (state.dirty) {
    // Put the address back (this does not fire another hashchange), then ask.
    const target = location.hash;
    history.replaceState(null, '', currentHash || '#/');
    if (!(await okToLeave())) return;
    location.hash = target;
    return;
  }
  currentHash = location.hash;
  render();
});

window.addEventListener('sg:render', () => { currentHash = location.hash; render(); });

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});

document.getElementById('back-button').addEventListener('click', async () => {
  if (!state.back) { announce('You are already on the first screen.'); return; }
  if (!(await okToLeave())) return;
  go(state.back);
});

document.getElementById('home-button').addEventListener('click', async (e) => {
  e.preventDefault();
  if (!(await okToLeave())) return;
  go('#/');
});

document.getElementById('sign-out').addEventListener('click', async () => {
  if (!(await okToLeave())) return;
  const sure = await confirmAction({ title: 'Sign out of SimpleGit?', message: 'You can sign in again at any time.', no: 'No, Stay Signed In', yes: 'Yes, Sign Out' });
  if (!sure) return;
  try {
    await fetch('/auth/logout', { method: 'POST', headers: { 'X-SimpleGit': '1' } });
  } catch { /* signing out locally anyway */ }
  state.me = null;
  state.projects.clear();
  location.hash = '#/';
  render();
  announce('You are signed out.');
});

initSpeech();
render();
