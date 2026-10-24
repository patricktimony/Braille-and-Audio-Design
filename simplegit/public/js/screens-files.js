// Open a Project (read files) and Change a Project (add, edit, replace,
// rename, delete files and create folders).
import { h, api, store, sizeText, uid, choose, confirmAction, readFileAsBase64 } from './ui.js';
import {
  state, page, loading, errorPage, showStatus, showError, getProject, projectLine, projectHash, breadcrumbs,
  parentPath, baseName, setFlash, go, setDirty, rerender, menuItem,
} from './core.js';
import { explain } from './explain.js';

const enc = encodeURIComponent;
const apiBase = (o, r) => `/projects/${enc(o)}/${enc(r)}`;
const MAX_BYTES = 25 * 1024 * 1024;

async function loadProject(owner, repo, back) {
  const nav = state.nav;
  try {
    const p = await getProject(owner, repo);
    return nav === state.nav ? p : null;
  } catch (err) {
    if (nav === state.nav) errorPage(err, back);
    return null;
  }
}

// After a change is saved, show "Done" with an Undo button on the next screen.
function flashWithUndo(p, title, message, commit) {
  const undo = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api('POST', `${apiBase(p.owner, p.name)}/undo`, { commit });
      setFlash({ type: 'success', title: 'Your change was undone', message: 'Everything is back the way it was before.' });
      rerender();
    } catch (err) { btn.disabled = false; showError(err); }
  };
  setFlash({
    type: 'success', title, message,
    actions: commit ? [h('button', { type: 'button', class: 'btn', onclick: undo }, 'Undo This Change')] : [],
  });
}

function itemList(p, items, mode) {
  return h('ul', { class: 'items' }, items.map((item) => {
    const ex = explain(item.name, item.type);
    const screen = item.type === 'folder' ? mode : (mode === 'open' ? 'file' : 'changefile');
    return h('li', {}, h('a', { class: 'item-link', href: projectHash(p.owner, p.name, screen, item.path) },
      h('span', { class: 'item-icon', 'aria-hidden': 'true' }, ex.icon),
      h('span', { class: 'item-name' }, item.name),
      h('span', { class: 'item-kind' }, ex.kind, item.type === 'file' && item.size != null ? ` · ${sizeText(item.size)}` : ''),
      h('span', { class: 'item-desc' }, ex.desc)));
  }));
}

// ---------- Open a Project: folders ----------

export async function folderScreen(owner, repo, path, mode) {
  loading(mode === 'open' ? 'Opening…' : 'Getting the files…');
  const back = path ? projectHash(owner, repo, mode, parentPath(path)) : projectHash(owner, repo);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nav = state.nav;
  let data;
  try { data = await api('GET', `${apiBase(owner, repo)}/folder?path=${enc(path)}`); } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;
  if (data.isFile) { go(projectHash(owner, repo, mode === 'open' ? 'file' : 'changefile', path)); return; }

  const title = mode === 'open' ? 'Open a Project' : 'Change a Project';
  const body = [projectLine(p), breadcrumbs(p, path, mode)];

  if (mode === 'change' && !p.canChange) {
    page({ title, instruction: 'You can look at this project, but you cannot change it.', back, body: [
      ...body,
      h('p', {}, 'This project belongs to someone else. To change it, ask the owner to invite you as a helper. They can do that in SimpleGit with Share a Project.'),
      h('a', { class: 'btn primary huge', href: projectHash(owner, repo, 'open', path) }, 'Open the Project Instead'),
    ] });
    return;
  }

  if (mode === 'change') {
    body.push(h('h2', {}, 'Add something new'), h('ul', { class: 'menu' },
      menuItem({ label: 'Add a new file', desc: 'Type a new file, such as a page or a note.', icon: '📝', href: projectHash(owner, repo, 'newfile', path) }),
      menuItem({ label: 'Add a file from this device', desc: 'Choose a file, such as a photo, from this phone or computer.', icon: '📤', href: projectHash(owner, repo, 'upload', path) }),
      menuItem({ label: 'Create a folder', desc: 'Make a new folder to keep files together.', icon: '📁', href: projectHash(owner, repo, 'newfolder', path) })));
    body.push(h('h2', {}, path ? `Files and folders in "${baseName(path)}"` : 'Files and folders'));
  }

  if (data.empty) {
    body.push(h('p', {}, 'This project has no files yet.'));
    if (mode === 'open' && p.canChange) body.push(h('a', { class: 'btn primary', href: projectHash(owner, repo, 'newfile') }, 'Add a File'));
  } else if (!data.items.length) {
    body.push(h('p', {}, 'This folder is empty.'));
  } else {
    body.push(h('p', {}, `${data.items.length} ${data.items.length === 1 ? 'item' : 'items'}:`), itemList(p, data.items, mode));
  }

  if (mode === 'open' && p.canChange && !data.empty) {
    body.push(h('p', {}, h('a', { class: 'btn', href: projectHash(owner, repo, 'change', path) }, h('span', { 'aria-hidden': 'true' }, '✏️ '), 'Change something here')));
  }
  if (mode === 'change' && path) {
    body.push(h('h2', {}, 'Remove this folder'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => deleteFolder(p, path) }, `Delete the folder "${baseName(path)}"`));
  }

  page({
    title,
    instruction: mode === 'open'
      ? (data.empty || !data.items.length ? 'There is nothing to open here yet.' : 'Choose a folder or file to open it.')
      : 'Choose a file to change it, or add something new.',
    back,
    body,
  });
}

// ---------- Open a Project: one file ----------

export async function fileScreen(owner, repo, path) {
  loading('Opening the file…');
  const back = projectHash(owner, repo, 'open', parentPath(path));
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nav = state.nav;
  let f;
  try { f = await api('GET', `${apiBase(owner, repo)}/file?path=${enc(path)}`); } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;
  if (f.isFolder) { go(projectHash(owner, repo, 'open', path)); return; }
  const ex = explain(f.name, 'file');
  const rawUrl = `/api${apiBase(owner, repo)}/raw?path=${enc(path)}`;
  const body = [projectLine(p), breadcrumbs(p, path, 'open'), h('p', {}, h('strong', {}, `${ex.kind}: `), ex.desc)];

  if (f.isImage) {
    body.push(h('h2', {}, 'The picture'), h('img', { class: 'file-image', src: rawUrl, alt: `The picture in ${f.name}` }));
  } else if (f.isText) {
    const preId = uid('text');
    body.push(h('h2', { id: `${preId}-h` }, 'What the file says'),
      f.text.trim() ? h('pre', { class: 'file-text', tabindex: '0', role: 'region', 'aria-labelledby': `${preId}-h` }, f.text) : h('p', {}, 'This file is empty.'));
  } else if (f.tooLarge) {
    body.push(h('p', {}, 'This file is too large to show here. You can download it instead.'));
  } else {
    body.push(h('p', {}, 'This kind of file cannot be shown here. You can download it and open it with another app.'));
  }

  const actions = [];
  if (p.canChange) actions.push(h('a', { class: 'btn primary', href: projectHash(owner, repo, 'changefile', path) }, h('span', { 'aria-hidden': 'true' }, '✏️ '), 'Change this file'));
  actions.push(h('a', { class: 'btn', href: `${rawUrl}&download=1`, download: f.name }, h('span', { 'aria-hidden': 'true' }, '⬇️ '), 'Download this file'));
  body.push(h('div', { class: 'button-row' }, actions));
  body.push(h('details', {}, h('summary', {}, 'Show technical details'), h('dl', {},
    h('dt', {}, 'Full name'), h('dd', {}, path),
    h('dt', {}, 'Size'), h('dd', {}, sizeText(f.size)),
    h('dt', {}, 'Version code'), h('dd', {}, f.sha),
    h('dt', {}, 'On GitHub'), h('dd', {}, h('a', { href: f.link, target: '_blank', rel: 'noopener' }, 'See this file on GitHub (opens in a new tab)')))));

  page({ title: f.name, kicker: 'Open a Project', instruction: f.isText ? 'Read the file below.' : 'Here is the file.', back, body });
}

// ---------- Change a Project: choose what to do with a file ----------

export async function changeFileScreen(owner, repo, path) {
  loading('Opening the file…');
  const back = projectHash(owner, repo, 'change', parentPath(path));
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nav = state.nav;
  let f;
  try { f = await api('GET', `${apiBase(owner, repo)}/file?path=${enc(path)}`); } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;
  if (f.isFolder) { go(projectHash(owner, repo, 'change', path)); return; }
  if (!p.canChange) { go(projectHash(owner, repo, 'file', path)); return; }
  const ex = explain(f.name, 'file');
  const items = [];
  if (f.isText) items.push(menuItem({ label: 'Edit the text', desc: 'Change the words or code inside this file.', icon: '📝', href: projectHash(owner, repo, 'edit', path) }));
  items.push(
    menuItem({ label: 'Replace it', desc: 'Swap it for a file from this device.', icon: '🔁', href: projectHash(owner, repo, 'replace', path) }),
    menuItem({ label: 'Rename it', desc: 'Give this file a new name.', icon: '🏷️', href: projectHash(owner, repo, 'rename', path) }),
    menuItem({ label: 'Delete it', desc: 'Remove this file from the project. You can undo this straight after.', icon: '🗑️', onClick: () => deleteFile(p, path, f.sha) }),
  );
  page({
    title: f.name, kicker: 'Change a Project',
    instruction: 'What would you like to do with this file?',
    back,
    body: [projectLine(p), breadcrumbs(p, path, 'change'), h('p', {}, h('strong', {}, `${ex.kind}: `), ex.desc),
      h('ul', { class: 'menu' }, items),
      h('p', {}, h('a', { href: projectHash(owner, repo, 'file', path) }, 'Read this file without changing it'))],
  });
}

async function deleteFile(p, path, sha) {
  const name = baseName(path);
  const ok = await confirmAction({
    title: `Delete "${name}"?`,
    message: [`This removes "${name}" from your project.`, 'You can undo this straight after. GitHub also keeps older versions.'],
    no: 'No, Keep It', yes: 'Yes, Delete It', danger: true,
  });
  if (!ok) return;
  showStatus({ type: 'working', title: 'Deleting…' });
  try {
    const { commit } = await api('DELETE', `${apiBase(p.owner, p.name)}/file`, { path, sha });
    flashWithUndo(p, `"${name}" was deleted`, 'It has been removed from your project.', commit);
    go(projectHash(p.owner, p.name, 'change', parentPath(path)));
  } catch (err) {
    if (err.code === 'changed') {
      const again = await confirmAction({
        title: 'This file was changed by someone else',
        message: [err.message, 'Do you still want to delete it, including the newer changes?'],
        no: 'No, Keep It', yes: 'Delete It Anyway', danger: true,
      });
      if (again) {
        try {
          const { commit } = await api('DELETE', `${apiBase(p.owner, p.name)}/file`, { path, force: true });
          flashWithUndo(p, `"${name}" was deleted`, 'It has been removed from your project.', commit);
          go(projectHash(p.owner, p.name, 'change', parentPath(path)));
        } catch (e2) { showError(e2); }
      } else showStatus({ type: 'info', title: 'Nothing was deleted' });
    } else showError(err);
  }
}

async function deleteFolder(p, path) {
  const name = baseName(path);
  let size;
  try { size = await api('GET', `${apiBase(p.owner, p.name)}/folder-size?path=${enc(path)}`); } catch (err) { showError(err); return; }
  const ok = await confirmAction({
    title: `Delete the folder "${name}"?`,
    message: [size.count
      ? `This removes the folder "${name}" and the ${size.count} ${size.count === 1 ? 'file' : 'files'} inside it, including any folders inside it.`
      : `This removes the empty folder "${name}".`,
    'You can undo this straight after.'],
    no: 'No, Keep It', yes: 'Yes, Delete the Folder', danger: true,
  });
  if (!ok) return;
  showStatus({ type: 'working', title: 'Deleting the folder…' });
  try {
    const { commit } = await api('POST', `${apiBase(p.owner, p.name)}/delete-folder`, { path, total: size.total });
    flashWithUndo(p, `The folder "${name}" was deleted`, 'It has been removed from your project.', commit);
    go(projectHash(p.owner, p.name, 'change', parentPath(path)));
  } catch (err) { showError(err); }
}

// ---------- Edit the text of a file ----------

const draftKey = (p, path) => `sg.draft:${p.owner}/${p.name}:${path}`.toLowerCase();

export async function editScreen(owner, repo, path) {
  loading('Opening the file for editing…');
  const back = projectHash(owner, repo, 'changefile', path);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nav = state.nav;
  let f;
  try { f = await api('GET', `${apiBase(owner, repo)}/file?path=${enc(path)}`); } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;
  if (!f.isText) {
    errorPage({ title: 'This file cannot be edited here', message: 'Only text files can be edited in SimpleGit.', next: 'You can replace it with a file from your device instead.' }, back);
    return;
  }
  let sha = f.sha;
  const id = uid('editor');
  const textarea = h('textarea', { id, class: 'editor', spellcheck: 'false', autocapitalize: 'off', 'aria-describedby': `${id}-hint` });
  textarea.value = f.text;
  const key = draftKey(p, path);
  const saveDraft = () => store.set(key, { text: textarea.value, sha, at: Date.now() });
  textarea.addEventListener('input', () => { setDirty(textarea.value !== f.text); saveDraft(); });

  async function save(force = false, recreate = false) {
    saveBtn.disabled = true;
    showStatus({ type: 'working', title: 'Saving your changes…' });
    try {
      const body = recreate ? { path, text: textarea.value, overwrite: true } : { path, text: textarea.value, sha, force };
      const result = await api('PUT', `${apiBase(owner, repo)}/file`, body);
      sha = result.sha;
      store.remove(key);
      setDirty(false);
      flashWithUndo(p, 'Your changes were saved', `The changes to "${f.name}" are now saved on GitHub.`, result.commit);
      go(projectHash(owner, repo, 'file', path));
    } catch (err) {
      saveBtn.disabled = false;
      if (err.code === 'changed') {
        const answer = await choose({
          title: 'This file was changed by someone else',
          message: [err.message, 'Your changes are kept safe on this device while you decide.'],
          choices: [
            { label: 'Go Back to My Changes', value: 'stay' },
            { label: 'Look at the Newer Version', value: 'view' },
            { label: 'Replace It With My Version', value: 'force', style: 'danger' },
          ],
        });
        if (answer === 'force') save(true);
        else if (answer === 'view') {
          saveDraft();
          setDirty(false);
          setFlash({ type: 'info', title: 'Your changes are kept', message: 'This is the newer version. Your own changes are saved on this device. Press Change this file, then Edit the text, to get them back.' });
          go(projectHash(owner, repo, 'file', path));
        } else showStatus({ type: 'info', title: 'Nothing was saved yet', message: 'Your changes are still in the box.' });
      } else if (err.code === 'deleted') {
        const again = await confirmAction({ title: 'This file was deleted', message: [err.message, 'Do you want to put the file back, with your changes?'], no: 'No, Go Back', yes: 'Put It Back' });
        if (again) save(false, true);
      } else showError(err, { retry: () => save(force, recreate) });
    }
  }

  const saveBtn = h('button', { type: 'submit', class: 'btn primary huge' }, h('span', { 'aria-hidden': 'true' }, '💾 '), 'Save Changes');
  const form = h('form', { onsubmit: (e) => { e.preventDefault(); save(); } },
    h('div', { class: 'field' },
      h('label', { for: id }, `Text of ${f.name}`),
      h('p', { class: 'hint', id: `${id}-hint` }, 'Your changes are only saved on GitHub when you press Save Changes. Shortcut: Control S (or Command S).'),
      textarea),
    saveBtn,
    h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Cancel')));
  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  page({ title: `Edit ${f.name}`, kicker: 'Change a Project', instruction: 'Make your changes in the box. Then press Save Changes.', back, body: [projectLine(p), form] });

  // Offer back any unsaved changes from an earlier visit.
  const draft = store.get(key);
  if (draft && draft.text !== f.text) {
    const when = new Date(draft.at).toLocaleString();
    showStatus({
      type: 'warning', title: 'You have changes that were not saved',
      message: `Earlier (${when}) you made changes to this file that were not saved.${draft.sha !== f.sha ? ' The file has also been changed since then.' : ''}`,
      next: 'Choose whether to use them.',
      actions: [
        h('button', { type: 'button', class: 'btn primary', onclick: () => {
          textarea.value = draft.text; sha = draft.sha; setDirty(true);
          showStatus({ type: 'success', title: 'Your earlier changes are back in the box', message: 'Press Save Changes when you are ready.' });
          textarea.focus();
        } }, 'Use My Earlier Changes'),
        h('button', { type: 'button', class: 'btn', onclick: () => { store.remove(key); showStatus({ type: 'info', title: 'Earlier changes thrown away' }); textarea.focus(); } }, 'Throw Them Away'),
      ],
    });
  }
}

// ---------- Add a new file (typed) ----------

export async function newFileScreen(owner, repo, folder) {
  loading();
  const back = projectHash(owner, repo, 'change', folder);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nameId = uid('name');
  const textId = uid('text');
  const nameErr = h('p', { class: 'field-error', id: `${nameId}-err` });
  const nameInput = h('input', { type: 'text', id: nameId, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': `${nameId}-hint ${nameId}-err` });
  const textarea = h('textarea', { id: textId, class: 'editor', spellcheck: 'false', 'aria-describedby': `${textId}-hint` });
  const markDirty = () => setDirty(Boolean(nameInput.value || textarea.value));
  nameInput.addEventListener('input', markDirty);
  textarea.addEventListener('input', markDirty);
  const saveBtn = h('button', { type: 'submit', class: 'btn primary huge' }, h('span', { 'aria-hidden': 'true' }, '💾 '), 'Save Changes');

  async function save(overwrite = false) {
    const name = nameInput.value.trim();
    const problem = checkFileName(name);
    if (problem) {
      nameErr.textContent = problem;
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.focus();
      return;
    }
    nameErr.textContent = '';
    nameInput.removeAttribute('aria-invalid');
    const path = folder ? `${folder}/${name}` : name;
    saveBtn.disabled = true;
    showStatus({ type: 'working', title: 'Saving…' });
    try {
      const result = await api('PUT', `${apiBase(owner, repo)}/file`, { path, text: textarea.value, overwrite });
      setDirty(false);
      flashWithUndo(p, `"${name}" was added`, 'The new file is saved on GitHub.', result.commit);
      go(projectHash(owner, repo, 'file', path));
    } catch (err) {
      saveBtn.disabled = false;
      if (err.code === 'exists') {
        const replace = await confirmAction({ title: 'Replace the existing file?', message: [err.message, 'The old file will be replaced by this new one.'], no: 'No, Choose Another Name', yes: 'Yes, Replace It', danger: true });
        if (replace) save(true);
        else { nameInput.focus(); showStatus({ type: 'info', title: 'Nothing was saved yet', message: 'Type a different name, then press Save Changes.' }); }
      } else showError(err, { retry: () => save(overwrite) });
    }
  }

  page({
    title: 'Add a new file', kicker: 'Change a Project',
    instruction: 'Type a name for the file, and what it should say. Then press Save Changes.',
    back,
    body: [projectLine(p), breadcrumbs(p, folder, 'change'),
      h('form', { onsubmit: (e) => { e.preventDefault(); save(); }, novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: nameId }, 'File name'),
          h('p', { class: 'hint', id: `${nameId}-hint` }, 'Include the ending, for example "notes.txt" or "about.html".'),
          nameErr, nameInput),
        h('div', { class: 'field' },
          h('label', { for: textId }, 'What the file should say'),
          h('p', { class: 'hint', id: `${textId}-hint` }, 'You can leave this empty and add text later.'),
          textarea),
        saveBtn,
        h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Cancel')))],
  });
}

function checkFileName(name) {
  if (!name) return 'Please type a name for the file.';
  if (name.includes('/') || name.includes('\\')) return 'A file name cannot contain the / or \\ characters. To put a file in a folder, open that folder first.';
  if (name === '.' || name === '..' || /[\0-\x1f]/.test(name)) return 'That name cannot be used. Please choose another.';
  if (name.length > 255) return 'That name is too long. Please use a shorter name.';
  return '';
}

// ---------- Add a file from this device / Replace a file ----------

export async function uploadScreen(owner, repo, targetPath, replacing) {
  loading();
  const folder = replacing ? parentPath(targetPath) : targetPath;
  const back = replacing ? projectHash(owner, repo, 'changefile', targetPath) : projectHash(owner, repo, 'change', folder);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  let currentSha = null;
  if (replacing) {
    const nav = state.nav;
    try {
      const f = await api('GET', `${apiBase(owner, repo)}/file?path=${enc(targetPath)}`);
      currentSha = f.sha;
    } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
    if (nav !== state.nav) return;
  }
  const fileId = uid('file');
  const nameId = uid('name');
  const fileErr = h('p', { class: 'field-error', id: `${fileId}-err` });
  const chosen = h('p', { 'aria-live': 'polite' });
  const fileInput = h('input', { type: 'file', id: fileId, 'aria-describedby': `${fileId}-hint ${fileId}-err` });
  const nameInput = h('input', { type: 'text', id: nameId, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const nameErr = h('p', { class: 'field-error' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) { chosen.textContent = ''; setDirty(false); return; }
    chosen.textContent = `You chose: ${file.name} (${sizeText(file.size)}).`;
    fileErr.textContent = '';
    fileInput.removeAttribute('aria-invalid');
    if (!replacing) nameInput.value = file.name;
    setDirty(true);
  });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary huge' }, h('span', { 'aria-hidden': 'true' }, '💾 '), 'Save Changes');

  async function save(overwrite = false) {
    const file = fileInput.files[0];
    if (!file) {
      fileErr.textContent = 'Please choose a file first.';
      fileInput.setAttribute('aria-invalid', 'true');
      fileInput.focus();
      return;
    }
    if (file.size > MAX_BYTES) {
      fileErr.textContent = `This file is ${sizeText(file.size)}. SimpleGit can save files up to 25 MB. Please choose a smaller file.`;
      fileInput.setAttribute('aria-invalid', 'true');
      fileInput.focus();
      return;
    }
    let path = targetPath;
    if (!replacing) {
      const name = nameInput.value.trim();
      const problem = checkFileName(name);
      if (problem) { nameErr.textContent = problem; nameInput.setAttribute('aria-invalid', 'true'); nameInput.focus(); return; }
      nameErr.textContent = '';
      nameInput.removeAttribute('aria-invalid');
      path = folder ? `${folder}/${name}` : name;
    } else if (!overwrite) {
      const ok = await confirmAction({
        title: `Replace "${baseName(targetPath)}"?`,
        message: [`The current "${baseName(targetPath)}" will be replaced by "${file.name}". The name stays "${baseName(targetPath)}".`, 'You can undo this straight after.'],
        no: 'No, Go Back', yes: 'Yes, Replace It', danger: true,
      });
      if (!ok) return;
    }
    saveBtn.disabled = true;
    showStatus({ type: 'working', title: 'Sending the file to GitHub…', message: file.size > 2_000_000 ? 'This is a large file, so it may take a minute.' : '' });
    try {
      const base64 = await readFileAsBase64(file);
      const body = replacing ? { path, base64, sha: currentSha, replace: true, force: overwrite } : { path, base64, overwrite };
      const result = await api('PUT', `${apiBase(owner, repo)}/file`, body);
      setDirty(false);
      flashWithUndo(p, replacing ? `"${baseName(path)}" was replaced` : `"${baseName(path)}" was added`, 'The file is saved on GitHub.', result.commit);
      go(projectHash(owner, repo, 'file', path));
    } catch (err) {
      saveBtn.disabled = false;
      if (err.code === 'exists' || err.code === 'changed') {
        const again = await confirmAction({
          title: err.code === 'exists' ? 'Replace the existing file?' : 'This file was changed by someone else',
          message: [err.message, 'Do you want to replace it with your file anyway?'],
          no: 'No, Go Back', yes: 'Yes, Replace It', danger: true,
        });
        if (again) save(true);
        else showStatus({ type: 'info', title: 'Nothing was saved' });
      } else showError(err, { retry: () => save(overwrite) });
    }
  }

  const fields = [
    h('div', { class: 'field' },
      h('label', { for: fileId }, 'Choose a file from this device'),
      h('p', { class: 'hint', id: `${fileId}-hint` }, 'Press the button to look through your files or photos. Up to 25 MB.'),
      fileErr, fileInput, chosen),
  ];
  if (!replacing) {
    fields.push(h('div', { class: 'field' },
      h('label', { for: nameId }, 'Name in the project'),
      h('p', { class: 'hint' }, 'This fills in by itself. You can change it.'),
      nameErr, nameInput));
  }
  page({
    title: replacing ? `Replace ${baseName(targetPath)}` : 'Add a file from this device',
    kicker: 'Change a Project',
    instruction: replacing ? 'Choose the new file. Then press Save Changes.' : 'Choose a file. Then press Save Changes.',
    back,
    body: [projectLine(p), breadcrumbs(p, replacing ? targetPath : folder, 'change'),
      h('form', { onsubmit: (e) => { e.preventDefault(); save(); }, novalidate: true }, fields, saveBtn,
        h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Cancel')))],
  });
}

// ---------- Rename ----------

export async function renameScreen(owner, repo, path) {
  loading();
  const back = projectHash(owner, repo, 'changefile', path);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const nav = state.nav;
  let f;
  try { f = await api('GET', `${apiBase(owner, repo)}/file?path=${enc(path)}`); } catch (err) { if (nav === state.nav) errorPage(err, back); return; }
  if (nav !== state.nav) return;
  const id = uid('rename');
  const err = h('p', { class: 'field-error', id: `${id}-err` });
  const input = h('input', { type: 'text', id, value: f.name, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': `${id}-hint ${id}-err`, oninput: () => setDirty(input.value !== f.name) });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary huge' }, h('span', { 'aria-hidden': 'true' }, '💾 '), 'Save Changes');

  async function save(overwrite = false) {
    let name = input.value.trim();
    const problem = checkFileName(name) || (name === f.name ? 'The new name is the same as the old name. Type a different name, or press Cancel.' : '');
    if (problem) { err.textContent = problem; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    err.textContent = '';
    input.removeAttribute('aria-invalid');
    // Losing the ending (such as .html) can stop a file working, so ask.
    const ending = (f.name.match(/\.[^.]+$/) || [''])[0];
    if (ending && !name.includes('.') && !overwrite) {
      const answer = await choose({
        title: `Keep the "${ending}" ending?`,
        message: [`The old name ended with "${ending}". This ending tells computers what kind of file it is.`],
        choices: [
          { label: `Yes, call it "${name}${ending}"`, value: 'add', style: 'primary' },
          { label: `No, call it "${name}"`, value: 'keep' },
        ],
      });
      if (answer === 'add') { name += ending; input.value = name; }
    }
    const folder = parentPath(path);
    const to = folder ? `${folder}/${name}` : name;
    saveBtn.disabled = true;
    showStatus({ type: 'working', title: 'Renaming…' });
    try {
      const result = await api('POST', `${apiBase(owner, repo)}/rename`, { from: path, to, sha: f.sha, overwrite });
      setDirty(false);
      flashWithUndo(p, 'The file was renamed', `"${f.name}" is now called "${name}".`, result.commit);
      go(projectHash(owner, repo, 'change', folder));
    } catch (e) {
      saveBtn.disabled = false;
      if (e.code === 'exists') {
        const again = await confirmAction({ title: 'Replace the other file?', message: [e.message], no: 'No, Choose Another Name', yes: 'Yes, Replace It', danger: true });
        if (again) save(true); else input.focus();
      } else showError(e, { retry: () => save(overwrite) });
    }
  }

  page({
    title: `Rename ${f.name}`, kicker: 'Change a Project', instruction: 'Type the new name. Then press Save Changes.', back,
    body: [projectLine(p), breadcrumbs(p, path, 'change'),
      h('form', { onsubmit: (e) => { e.preventDefault(); save(); }, novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: id }, 'New name'),
          h('p', { class: 'hint', id: `${id}-hint` }, `The current name is "${f.name}". Keep the ending (such as .html) unless you know you need to change it.`),
          err, input),
        saveBtn,
        h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Cancel')))],
  });
}

// ---------- Create a folder ----------

export async function newFolderScreen(owner, repo, folder) {
  loading();
  const back = projectHash(owner, repo, 'change', folder);
  const p = await loadProject(owner, repo, back);
  if (!p) return;
  const id = uid('folder');
  const err = h('p', { class: 'field-error', id: `${id}-err` });
  const input = h('input', { type: 'text', id, autocomplete: 'off', autocapitalize: 'off', 'aria-describedby': `${id}-hint ${id}-err` });
  const saveBtn = h('button', { type: 'submit', class: 'btn primary huge' }, h('span', { 'aria-hidden': 'true' }, '💾 '), 'Save Changes');
  async function save() {
    const name = input.value.trim();
    const problem = checkFileName(name).replace(/file/g, 'folder');
    if (problem) { err.textContent = problem; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    const path = folder ? `${folder}/${name}` : name;
    saveBtn.disabled = true;
    showStatus({ type: 'working', title: 'Creating the folder…' });
    try {
      const result = await api('POST', `${apiBase(owner, repo)}/folders`, { path });
      flashWithUndo(p, `The folder "${name}" was created`, 'You are now inside the new folder. You can add files to it.', result.commit);
      go(projectHash(owner, repo, 'change', path));
    } catch (e) { saveBtn.disabled = false; showError(e, { retry: save }); }
  }
  page({
    title: 'Create a folder', kicker: 'Change a Project', instruction: 'Type a name for the folder. Then press Save Changes.', back,
    body: [projectLine(p), breadcrumbs(p, folder, 'change'),
      h('form', { onsubmit: (e) => { e.preventDefault(); save(); }, novalidate: true },
        h('div', { class: 'field' },
          h('label', { for: id }, 'Folder name'),
          h('p', { class: 'hint', id: `${id}-hint` }, 'For example "pictures". (GitHub cannot keep empty folders, so SimpleGit adds a tiny hidden file inside it.)'),
          err, input),
        saveBtn,
        h('div', { class: 'button-row' }, h('a', { class: 'btn', href: back }, 'Cancel')))],
  });

}
