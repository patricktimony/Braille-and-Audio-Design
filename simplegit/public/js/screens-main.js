// Home, sign in, setup, My Projects, Start a Project, Download and Help.
import { h, api, store, session, announce, whenText, uid } from './ui.js';
import {
  state, page, loading, errorPage, showStatus, showError, menuItem, projectHash, getProject, rememberProject,
  projectLine, visibilityText, setFlash, go,
} from './core.js';

const ACTIONS = {
  open: { label: 'Open a Project', short: 'Open this project', desc: 'Look at the files and folders inside.', icon: '📂', screen: 'open' },
  change: { label: 'Change a Project', short: 'Change this project', desc: 'Add, edit, rename or delete files.', icon: '✏️', screen: 'change' },
  share: { label: 'Share a Project', short: 'Share this project', desc: 'Send a link, or invite someone to help.', icon: '🤝', screen: 'share' },
  download: { label: 'Download a Project', short: 'Download this project', desc: 'Save a copy of everything onto this device.', icon: '⬇️', screen: 'download' },
  try: { label: 'Try My Project', short: 'Try this project', desc: 'Open it as a working website, or publish it so others can use it.', icon: '▶️', screen: 'try' },
};

// ---------- Welcome and setup ----------

export function welcome() {
  page({
    title: 'Welcome to SimpleGit',
    instruction: 'Press Sign in with GitHub to begin.',
    back: null,
    body: [
      h('p', {}, 'SimpleGit lets you look at, change, share and publish your projects on GitHub, in plain English.'),
      h('a', { class: 'btn primary huge', href: '/auth/login' }, 'Sign in with GitHub'),
      h('p', {}, 'You will go to GitHub\'s website to sign in, and then come back here. SimpleGit never sees your GitHub password.'),
      h('h2', {}, 'No GitHub account yet?'),
      h('p', {}, 'You can create one for free on GitHub\'s website. Then come back and sign in.'),
      h('a', { class: 'btn', href: 'https://github.com/signup', target: '_blank', rel: 'noopener' }, 'Create a free GitHub account (opens in a new tab)'),
    ],
  });
}

export function signinProblem(why) {
  const reasons = {
    cancelled: ['Sign in was cancelled', 'You chose not to let SimpleGit use your GitHub account.', 'If you want to use SimpleGit, press Sign in with GitHub and choose Authorize.'],
    expired: ['Sign in took too long', 'The sign in page was open for too long, or it was opened in a different browser.', 'Press Sign in with GitHub to try again.'],
    failed: ['GitHub did not let you sign in', 'GitHub did not accept the sign in.', 'Press Sign in with GitHub to try again. If it fails again, the person who set up SimpleGit may need to check its settings.'],
    network: ['We could not reach GitHub', 'SimpleGit could not talk to GitHub to finish signing you in.', 'Check the internet connection, then try again.'],
  };
  const [title, message, next] = reasons[why] || reasons.failed;
  page({ title, instruction: next, back: null, body: [h('p', {}, message), h('a', { class: 'btn primary huge', href: '/auth/login' }, 'Sign in with GitHub')] });
}

export async function setup(step) {
  const me = state.me;
  if (step === 'done') {
    page({
      title: 'SimpleGit is connected to GitHub',
      instruction: 'Next, choose which of your projects SimpleGit may use.',
      back: null,
      body: [
        h('ol', { class: 'steps' },
          h('li', {}, 'Press the button below. GitHub will open.'),
          h('li', {}, 'On GitHub, choose "All repositories". (GitHub calls projects "repositories".) This lets new projects work too.'),
          h('li', {}, 'Press the green Install button. GitHub will bring you back here.')),
        me?.installUrl ? h('a', { class: 'btn primary huge', href: me.installUrl }, 'Choose My Projects on GitHub') : '',
        h('p', {}, 'After that, sign in:'),
        h('a', { class: 'btn huge', href: '/auth/login' }, 'Sign in with GitHub'),
      ],
    });
    return;
  }
  if (step === 'problem') {
    page({ title: 'Setup did not finish', instruction: 'Press Start Again to try once more.', back: null, body: [
      h('p', {}, 'GitHub did not finish connecting SimpleGit. This can happen if the GitHub page was closed, or took too long.'),
      h('a', { class: 'btn primary huge', href: '#/setup' }, 'Start Again'),
    ] });
    return;
  }
  if (!me?.setupAllowed) {
    page({ title: 'SimpleGit is not set up yet', instruction: 'Ask the person who runs SimpleGit to finish setting it up.', back: null, body: [
      h('p', {}, 'Before anyone can sign in, SimpleGit must be connected to GitHub once. For safety, this can only be done on the computer where SimpleGit is running.'),
    ] });
    return;
  }
  const s = step === '2' ? 2 : 1;
  if (s === 1) {
    page({
      title: 'Set up SimpleGit',
      kicker: 'Step 1 of 2',
      instruction: 'First, make sure you are signed in to GitHub in this web browser.',
      back: null,
      body: [
        h('p', {}, 'SimpleGit needs to be connected to GitHub. You only do this once. It takes about two minutes.'),
        h('p', {}, 'If you are not sure whether you are signed in, open GitHub in a new tab and check. Sign in there if needed, then come back to this tab.'),
        h('a', { class: 'btn', href: 'https://github.com/login', target: '_blank', rel: 'noopener' }, 'Open GitHub (opens in a new tab)'),
        h('div', { class: 'button-row' }, h('a', { class: 'btn primary huge', href: '#/setup/2' }, 'Next')),
      ],
    });
    return;
  }
  page({
    title: 'Set up SimpleGit',
    kicker: 'Step 2 of 2',
    instruction: 'Press Connect to GitHub. On GitHub, press the green Create button.',
    back: '#/setup',
    body: [
      h('p', {}, 'GitHub will show a page called "Create GitHub App". Everything is already filled in for you. Scroll to the bottom and press the green button that starts with "Create GitHub App".'),
      h('p', {}, 'This creates a private connection that only lets SimpleGit do the things you ask: look at files, save changes, invite helpers and publish websites.'),
      h('button', { type: 'button', class: 'btn primary huge', id: 'connect', onclick: connectToGitHub }, 'Connect to GitHub'),
    ],
  });
}

async function connectToGitHub() {
  try {
    const res = await fetch('/setup/manifest', { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw data.error;
    const { action, manifest } = data;
    const form = h('form', { method: 'post', action }, h('input', { type: 'hidden', name: 'manifest', value: manifest }));
    document.body.append(form);
    announce('Opening GitHub.');
    form.submit();
  } catch (err) {
    showError(err?.title ? err : { title: 'We could not start setup', message: 'SimpleGit could not prepare the connection to GitHub.', next: 'Check that SimpleGit is still running, then try again.' });
  }
}

export function needsInstall() {
  const me = state.me;
  page({
    title: 'One more step',
    instruction: 'Let SimpleGit use your projects on GitHub.',
    back: null,
    body: [
      h('ol', { class: 'steps' },
        h('li', {}, 'Press Choose My Projects on GitHub. GitHub will open.'),
        h('li', {}, 'Choose "All repositories". (GitHub calls projects "repositories".)'),
        h('li', {}, 'Press the green Install button. GitHub will bring you back here.')),
      h('a', { class: 'btn primary huge', href: me.installUrl }, 'Choose My Projects on GitHub'),
      h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn', onclick: () => { state.me = null; go('#/'); } }, 'I Have Done This. Continue.')),
    ],
  });
}

// ---------- Home ----------

export function home() {
  const current = store.get('sg.current');
  const target = (key) => (current ? projectHash(current.owner, current.name, ACTIONS[key].screen) : `#/choose/${key}`);
  const items = [
    menuItem({ number: 1, label: 'My Projects', desc: 'See all your projects.', icon: '🗂️', href: '#/projects', primary: true }),
    menuItem({ number: 2, label: 'Start a Project', desc: 'Make a new, empty project.', icon: '➕', href: '#/start' }),
    ...['open', 'change', 'share', 'download', 'try'].map((key, i) => menuItem({
      number: i + 3, label: ACTIONS[key].label, desc: ACTIONS[key].desc, icon: ACTIONS[key].icon, href: target(key),
    })),
  ];
  page({
    title: 'Home',
    heading: 'What would you like to do?',
    instruction: 'Choose one of the seven buttons.',
    back: null,
    body: [
      current ? h('div', { class: 'status info' },
        h('p', {}, 'You are working on the project: ', h('strong', {}, current.name), '.'),
        h('a', { class: 'btn small-btn', href: '#/projects' }, 'Choose a Different Project')) : '',
      h('nav', { 'aria-label': 'Main choices' }, h('ul', { class: 'menu' }, items)),
    ],
  });
}

// ---------- My Projects (and choosing a project for an action) ----------

export async function projectList(action) {
  const act = ACTIONS[action];
  loading('Getting your projects from GitHub…');
  const nav = state.nav;
  let projects;
  try { ({ projects } = await api('GET', '/projects')); } catch (err) { if (nav === state.nav) errorPage(err); return; }
  if (nav !== state.nav) return;
  projects.forEach((p) => state.projects.set(`${p.owner}/${p.name}`.toLowerCase(), p));

  const listEl = h('ul', { class: 'items', id: 'project-list' });
  const countEl = h('p', { 'aria-live': 'polite' });
  const draw = (filter = '') => {
    const f = filter.trim().toLowerCase();
    const shown = projects.filter((p) => !f || p.name.toLowerCase().includes(f) || p.description.toLowerCase().includes(f));
    listEl.replaceChildren(...shown.map((p) => h('li', {}, h('a', {
      class: 'item-link',
      href: act ? projectHash(p.owner, p.name, act.screen) : projectHash(p.owner, p.name),
      onclick: () => rememberProject(p),
    },
    h('span', { class: 'item-icon', 'aria-hidden': 'true' }, p.private ? '🔒' : '🌍'),
    h('span', { class: 'item-name' }, p.name),
    h('span', { class: 'item-kind' }, p.private ? 'Private' : 'Public', p.owner.toLowerCase() !== state.me.user.login.toLowerCase() ? ` · belongs to ${p.owner}` : '', p.updatedAt ? ` · changed ${whenText(p.updatedAt)}` : ''),
    h('span', { class: 'item-desc' }, p.description || 'No description.')))));
    countEl.textContent = f ? `${shown.length} of ${projects.length} projects match.` : `You have ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}.`;
  };

  const body = [];
  if (!projects.length) {
    body.push(h('p', {}, 'You do not have any projects yet.'),
      h('a', { class: 'btn primary huge', href: '#/start' }, 'Start a Project'));
    if (state.me.installUrl) {
      body.push(h('p', {}, 'If you expected to see projects here, SimpleGit may not have permission to use them yet.'),
        h('a', { class: 'btn', href: state.me.installUrl }, 'Choose My Projects on GitHub'));
    }
  } else {
    if (projects.length > 6) {
      const id = uid('find');
      body.push(h('div', { class: 'field' },
        h('label', { for: id }, 'Find a project by name'),
        h('input', { type: 'text', id, autocomplete: 'off', oninput: (e) => draw(e.target.value) })));
    }
    body.push(countEl, listEl);
    draw();
  }
  page({
    title: act ? act.label : 'My Projects',
    instruction: act ? 'Which project? Choose one from the list.' : 'Choose a project to see what you can do with it.',
    back: '#/',
    body,
  });
}

export async function projectHome(owner, repo) {
  loading('Opening the project…');
  const nav = state.nav;
  let p;
  try { p = await getProject(owner, repo, { fresh: true }); } catch (err) { if (nav === state.nav) errorPage(err, '#/projects'); return; }
  if (nav !== state.nav) return;
  const items = ['open', 'change', 'share', 'download', 'try'].map((key) => {
    const a = ACTIONS[key];
    if (key === 'change' && !p.canChange) {
      return menuItem({ label: a.short, desc: 'You can look at this project, but not change it. Ask the owner to invite you as a helper.', icon: a.icon, href: projectHash(owner, repo, 'change') });
    }
    return menuItem({ label: a.short, desc: a.desc, icon: a.icon, href: projectHash(owner, repo, a.screen) });
  });
  page({
    title: p.name,
    kicker: 'My Projects',
    instruction: 'What would you like to do with this project?',
    back: '#/projects',
    body: [
      h('p', {}, p.description || 'This project has no description.'),
      h('p', {}, h('span', { 'aria-hidden': 'true' }, p.private ? '🔒 ' : '🌍 '), visibilityText(p)),
      p.updatedAt ? h('p', {}, `Last changed ${whenText(p.updatedAt)}.`) : '',
      h('nav', { 'aria-label': 'Things you can do' }, h('ul', { class: 'menu' }, items)),
    ],
  });
}

// ---------- Start a Project ----------

const START_KEY = 'sg.start';

const safeName = (name) => name.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_.-]/g, '').replace(/^\.+/, '').slice(0, 100);

export function startProject(stepParam) {
  const data = session.get(START_KEY, { name: '', description: '', private: null });
  const step = Number(stepParam || 1);
  const save = () => session.set(START_KEY, data);

  if (step === 1) {
    const id = uid('name');
    const preview = h('p', { id: `${id}-preview`, 'aria-live': 'polite' });
    const err = h('p', { class: 'field-error', id: `${id}-err` });
    const input = h('input', { type: 'text', id, value: data.name, autocomplete: 'off', 'aria-describedby': `${id}-hint ${id}-preview ${id}-err`,
      oninput: () => { data.name = input.value; save(); updatePreview(); } });
    const updatePreview = () => {
      const s = safeName(input.value);
      preview.textContent = s && s !== input.value.trim() ? `It will be saved as: ${s}` : '';
    };
    updatePreview();
    const next = (e) => {
      e.preventDefault();
      if (!safeName(input.value)) {
        err.textContent = 'Please type a name with at least one letter or number.';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      go('#/start/2');
    };
    page({
      title: 'Start a Project', kicker: 'Step 1 of 3', instruction: 'What do you want to call your project?', back: '#/',
      body: [h('form', { onsubmit: next, novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: id }, 'Project name'),
          h('p', { class: 'hint', id: `${id}-hint` }, 'Use a short name, like "family-recipes". Spaces will become dashes.'),
          err, input, preview),
        h('button', { type: 'submit', class: 'btn primary huge' }, 'Next'))],
    });
    return;
  }
  if (!safeName(data.name)) { go('#/start'); return; }
  if (step === 2) {
    const id = uid('desc');
    page({
      title: 'Start a Project', kicker: 'Step 2 of 3', instruction: 'Describe your project in one sentence. You can leave this empty.', back: '#/start',
      body: [h('form', { onsubmit: (e) => { e.preventDefault(); go('#/start/3'); } },
        h('div', { class: 'field' },
          h('label', { for: id }, 'Short description (optional)'),
          h('p', { class: 'hint', id: `${id}-hint` }, 'For example: "A website with my grandmother\'s recipes."'),
          h('input', { type: 'text', id, value: data.description, maxlength: '350', 'aria-describedby': `${id}-hint`, oninput: (e) => { data.description = e.target.value; save(); } })),
        h('button', { type: 'submit', class: 'btn primary huge' }, 'Next'))],
    });
    return;
  }
  if (step === 3) {
    const err = h('p', { class: 'field-error', id: 'vis-err' });
    const radio = (value, title, desc) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'visibility', value, checked: data.private === (value === 'private'), onchange: () => { data.private = value === 'private'; save(); } }),
      h('span', {}, h('span', { class: 'choice-title' }, title), h('span', { class: 'choice-desc' }, desc)));
    page({
      title: 'Start a Project', kicker: 'Step 3 of 3', instruction: 'Choose who can see your project.', back: '#/start/2',
      body: [h('form', { onsubmit: (e) => {
        e.preventDefault();
        if (data.private === null) { err.textContent = 'Please choose one of the two options.'; document.querySelector('input[name=visibility]').focus(); return; }
        go('#/start/4');
      } },
      h('fieldset', { class: 'choices', 'aria-describedby': 'vis-err' },
        h('legend', {}, 'Who can see this project?'),
        err,
        radio('private', 'Only me and people I invite (private)', 'Best for personal or unfinished work. Nobody else can see it unless you invite them.'),
        radio('public', 'Everyone (public)', 'Anyone on the internet can see and copy the files. Only you and people you invite can change them. Needed if you want a free website on a free GitHub account.')),
      h('p', {}, 'You can change this later.'),
      h('button', { type: 'submit', class: 'btn primary huge' }, 'Next'))],
    });
    return;
  }
  // Step 4: review and create.
  if (data.private === null) { go('#/start/3'); return; }
  const create = async (btn) => {
    btn.disabled = true;
    showStatus({ type: 'working', title: 'Creating your project…', message: 'This takes a few seconds.' });
    try {
      const { project } = await api('POST', '/projects', { name: data.name, description: data.description, private: data.private });
      session.remove(START_KEY);
      rememberProject(project);
      setFlash({ type: 'success', title: 'Your project was created', message: `"${project.name}" is ready. It has one file: a welcome note called README.md.` });
      go(projectHash(project.owner, project.name));
    } catch (err) {
      btn.disabled = false;
      if (err.code === 'name-taken') {
        setFlash({ type: 'error', title: err.title, message: err.message, next: err.next });
        go('#/start');
      } else showError(err, { retry: () => create(btn) });
    }
  };
  page({
    title: 'Start a Project', kicker: 'Ready', instruction: 'Check the details. Then press Create My Project.', back: '#/start/3',
    body: [
      h('dl', {},
        h('dt', {}, 'Name'), h('dd', {}, safeName(data.name)),
        h('dt', {}, 'Description'), h('dd', {}, data.description || '(none)'),
        h('dt', {}, 'Who can see it'), h('dd', {}, data.private ? 'Only you and people you invite (private)' : 'Everyone (public)')),
      h('p', {}, h('a', { href: '#/start' }, 'Change the name'), ' · ', h('a', { href: '#/start/2' }, 'Change the description'), ' · ', h('a', { href: '#/start/3' }, 'Change who can see it')),
      h('button', { type: 'button', class: 'btn primary huge', onclick: (e) => create(e.currentTarget) }, 'Create My Project'),
    ],
  });
}

// ---------- Download ----------

function downloadPlaceText() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'On iPhone and iPad, Safari may first ask if you want to download it. Press Download. The file goes into the Files app, in the Downloads folder. You can also press the downloads button (a circle with a down arrow) in Safari\'s address bar.';
  }
  if (/Android/.test(ua)) return 'On Android, the file goes into your Downloads. You can find it in the Files app, or by pulling down the notifications at the top of the screen.';
  if (/Windows/.test(ua)) return 'On Windows, the file usually goes into your Downloads folder. In Edge or Chrome, press Control and J together to see your downloads.';
  if (/Macintosh/.test(ua)) return 'On a Mac, the file usually goes into your Downloads folder. In Safari, press Option, Command and L together to see your downloads.';
  return 'The file usually goes into your Downloads folder.';
}

export async function download(owner, repo) {
  loading('Getting ready…');
  const nav = state.nav;
  let p;
  try { p = await getProject(owner, repo); } catch (err) { if (nav === state.nav) errorPage(err); return; }
  if (nav !== state.nav) return;
  const fileName = `${p.name}.zip`;
  const url = `/api/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/download`;
  page({
    title: 'Download a Project',
    instruction: 'Press Download. Your whole project will be saved as one file.',
    back: projectHash(owner, repo),
    body: [
      projectLine(p),
      h('a', {
        class: 'btn primary huge',
        href: url,
        download: fileName,
        onclick: async (e) => {
          // Check first, so any problem is explained in plain English.
          e.preventDefault();
          showStatus({ type: 'working', title: 'Getting your download ready…' });
          try {
            await api('GET', `/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/download-check`);
          } catch (err) { showError(err); return; }
          window.location.href = url;
          showStatus({ type: 'success', title: 'Your download has started', message: `The file is called ${fileName}. ${downloadPlaceText()}` });
        },
      }, h('span', { 'aria-hidden': 'true' }, '⬇️ '), 'Download'),
      h('h2', {}, 'What you will get'),
      h('p', {}, `One file called ${fileName}. It is a ZIP file: a single file that holds all the files and folders of your project. Open it to see everything inside.`),
      h('p', {}, downloadPlaceText()),
    ],
  });
}

// ---------- Help ----------

export function help() {
  const words = [
    ['Repository', 'A project.'],
    ['Commit', 'Saving a change. SimpleGit does this when you press Save Changes.'],
    ['Branch', 'A separate copy of a project for trying out changes. SimpleGit always uses the main copy.'],
    ['Pull request', 'A request to add someone\'s changes to a project.'],
    ['Fork', 'Your own copy of somebody else\'s project.'],
    ['Clone', 'Copying a project to a computer. In SimpleGit, use Download a Project instead.'],
    ['Push', 'Sending saved changes up to GitHub.'],
    ['Merge', 'Combining two sets of changes.'],
    ['Collaborator', 'A helper: someone you invited to work on your project.'],
    ['GitHub Pages', 'GitHub\'s free service that turns a project into a website.'],
    ['Deployment', 'Publishing a project so people can use it.'],
  ];
  page({
    title: 'Help',
    instruction: 'Here are answers to common questions.',
    back: '#/',
    body: [
      h('h2', {}, 'How do I go back?'),
      h('p', {}, 'Press Back at the top of the screen to go back one step. Press Home to return to the seven main buttons. They are always in the same place.'),
      h('h2', {}, 'Can I undo a change?'),
      h('p', {}, 'Yes. After you save, delete or rename something, SimpleGit shows an Undo button. GitHub also keeps every older version of your files, so nothing is lost for good.'),
      h('h2', {}, 'Spoken help'),
      h('p', {}, 'Press Spoken Help near the top to hear each step read aloud. Press Repeat Instruction to hear it again, or Stop Speaking to stop. Speech never starts unless you turn it on.'),
      h('h2', {}, 'I cannot see some of my projects'),
      h('p', {}, 'SimpleGit can only see the projects you allowed it to use.'),
      state.me?.installUrl ? h('a', { class: 'btn', href: state.me.installUrl }, 'Choose My Projects on GitHub') : '',
      h('h2', {}, 'What do GitHub\'s words mean?'),
      h('p', {}, 'You never need to know these words to use SimpleGit. They are here in case you see them on GitHub\'s own website.'),
      h('dl', {}, words.flatMap(([w, m]) => [h('dt', {}, w), h('dd', {}, m)])),
    ],
  });
}
