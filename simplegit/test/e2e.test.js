// End-to-end tests: a real browser drives SimpleGit against the fake GitHub.
// Every screen is checked with axe (WCAG 2.2 A and AA rules).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { startAll } from './harness.js';

let env;
let browser;
let context;
let page;
const axeProblems = [];
const checkedScreens = [];

async function axe(label) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  checkedScreens.push(label);
  for (const v of result.violations) {
    axeProblems.push(`${label}: ${v.id} – ${v.help} – ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  }
}

const h1 = () => page.getByRole('heading', { level: 1 });
const goto = async (hash) => { await page.goto(`${env.appUrl}/${hash}`); };
const waitH1 = async (name, timeout = 10000) => page.getByRole('heading', { level: 1, name }).waitFor({ timeout });
const focusedName = () => page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el.tagName, text: (el.innerText || el.value || '').trim().replace(/\s+/g, ' '), id: el.id };
});

before(async () => {
  env = await startAll();
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: env.appUrl });
  // Record any speech so we can prove it never starts on its own.
  await context.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
      window.speechSynthesis.cancel = () => {};
    }
  });
  page = await context.newPage();
  page.on('pageerror', (e) => { throw e; });
});

after(async () => {
  await browser?.close();
  await env?.stop();
});

test('welcome screen, then sign in with GitHub', async () => {
  await goto('');
  await waitH1('Welcome to SimpleGit');
  await axe('Welcome');
  await page.getByRole('link', { name: 'Sign in with GitHub' }).click();
  await waitH1('What would you like to do?');
  const names = await page.getByRole('navigation', { name: 'Main choices' }).locator('.menu-label').allInnerTexts();
  const labels = names.map((n) => n.replace(/^\d+\.\s*/, '').trim());
  assert.deepEqual(labels, ['My Projects', 'Start a Project', 'Open a Project', 'Change a Project', 'Share a Project', 'Download a Project', 'Try My Project']);
  await axe('Home');
});

test('keyboard: skip link first, all seven buttons reachable, focus clearly visible', async () => {
  await goto('#/');
  await waitH1('What would you like to do?');
  // The skip link is the first thing on the page and appears when focused.
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await skip.focus();
  assert.ok((await skip.boundingBox()).y >= 0, 'Skip link should be visible when focused');
  const seen = [(await focusedName()).text];
  // Back, Home, 3 speech buttons, 7 main buttons, Help, Sign Out.
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const f = await focusedName();
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
    });
    seen.push(f.text);
    assert.ok(outline.style !== 'none' && outline.width >= 3, `Focus outline missing on "${f.text}"`);
  }
  assert.match(seen[0], /Skip to main content/);
  for (const label of ['My Projects', 'Start a Project', 'Open a Project', 'Change a Project', 'Share a Project', 'Download a Project', 'Try My Project']) {
    assert.ok(seen.some((s) => s.includes(label)), `Could not reach "${label}" with the Tab key`);
  }
  // Pressing Enter on a button opens the next screen and moves focus to its heading.
  await page.getByRole('link', { name: /My Projects/ }).focus();
  await page.keyboard.press('Enter');
  await waitH1('My Projects');
  assert.equal((await focusedName()).tag, 'H1');
});

test('spoken help never starts by itself, and can be turned on, repeated and stopped', async () => {
  await goto('#/');
  await waitH1('What would you like to do?');
  assert.deepEqual(await page.evaluate(() => window.__spoken), []);
  const toggle = page.getByRole('button', { name: 'Spoken Help' });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  let spoken = await page.evaluate(() => window.__spoken);
  assert.match(spoken.at(-1), /Choose one of the seven buttons/);
  await page.getByRole('button', { name: 'Repeat Instruction' }).click();
  spoken = await page.evaluate(() => window.__spoken);
  assert.equal(spoken.length, 2);
  await page.getByRole('button', { name: 'Stop Speaking' }).click();
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
});

test('My Projects lists projects with descriptions and opens one', async () => {
  await goto('#/projects');
  await waitH1('My Projects');
  await page.getByText('Family recipes website').waitFor();
  await axe('My Projects');
  await page.getByRole('link', { name: /^recipes/ }).click();
  await waitH1('recipes');
  await page.getByText('What would you like to do with this project?').waitFor();
  await axe('Project page');
});

test('Open a Project: folders, files, pictures, Back and Home', async () => {
  await goto('#/p/tester/recipes/open');
  await waitH1('Open a Project');
  await page.getByText('The main page of the website').waitFor();
  await axe('Open: folder');
  await page.getByRole('link', { name: /^notes/ }).click();
  await page.getByRole('link', { name: /^ideas\.txt/ }).click();
  await waitH1('ideas.txt');
  assert.equal(await page.locator('pre.file-text').innerText(), 'Try a lemon cake.');
  await axe('Open: text file');
  await page.getByRole('button', { name: 'Back' }).click();
  await waitH1('Open a Project');
  await page.getByRole('navigation', { name: 'You are here' }).getByText('notes').waitFor();
  await goto('#/p/tester/recipes/file/images/cake.png');
  await waitH1('cake.png');
  await page.getByRole('img', { name: 'The picture in cake.png' }).waitFor();
  await axe('Open: picture');
  await page.getByRole('link', { name: 'Home' }).click();
  await waitH1('What would you like to do?');
});

test('Change a Project: edit, Save Changes, and Undo', async () => {
  await goto('#/p/tester/recipes/change');
  await waitH1('Change a Project');
  await axe('Change: folder');
  await page.getByRole('link', { name: /^README\.md/ }).click();
  await waitH1('README.md');
  await axe('Change: file choices');
  await page.getByRole('link', { name: /Edit the text/ }).click();
  await waitH1('Edit README.md');
  await axe('Change: edit');
  await page.getByLabel('Text of README.md').fill('# Recipes\n\nNow with soup.\n');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByText('Your changes were saved').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'README.md'), '# Recipes\n\nNow with soup.\n');
  await axe('Change: saved message');
  await page.getByRole('button', { name: 'Undo This Change' }).click();
  await page.getByText('Your change was undone').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'README.md'), '# Recipes\n\nOur family recipes.\n');
});

test('Change a Project: warns when the file changed since it was opened', async () => {
  await goto('#/p/tester/recipes/edit/style.css');
  await waitH1('Edit style.css');
  env.mock.writeFile('tester', 'recipes', 'style.css', 'body { color: red; }');
  await page.getByLabel('Text of style.css').fill('body { color: blue; }');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const dialog = page.getByRole('dialog', { name: 'This file was changed by someone else' });
  await dialog.waitFor();
  await axe('Dialog: changed by someone else');
  assert.equal((await focusedName()).text, 'Go Back to My Changes');
  await dialog.getByRole('button', { name: 'Go Back to My Changes' }).click();
  assert.equal(await page.getByLabel('Text of style.css').inputValue(), 'body { color: blue; }');
  assert.equal(env.mock.readFile('tester', 'recipes', 'style.css'), 'body { color: red; }');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await dialog.getByRole('button', { name: 'Replace It With My Version' }).click();
  await page.getByText('Your changes were saved').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'style.css'), 'body { color: blue; }');
});

test('unsaved changes are protected when leaving, and kept after a reload', async () => {
  await goto('#/p/tester/recipes/edit/notes/ideas.txt');
  await waitH1('Edit ideas.txt');
  await page.getByLabel('Text of ideas.txt').fill('Try a lemon cake. And scones.');
  await page.getByRole('link', { name: 'Home' }).click();
  const dialog = page.getByRole('dialog', { name: 'Leave without saving?' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Stay Here' }).click();
  await waitH1('Edit ideas.txt');
  assert.equal(await page.getByLabel('Text of ideas.txt').inputValue(), 'Try a lemon cake. And scones.');
  await page.getByRole('button', { name: 'Back' }).click();
  await dialog.getByRole('button', { name: 'Leave Without Saving' }).click();
  await waitH1('ideas.txt');
  // Coming back offers the earlier, unsaved text.
  await goto('#/p/tester/recipes/edit/notes/ideas.txt');
  await page.getByText('You have changes that were not saved').waitFor();
  await page.getByRole('button', { name: 'Use My Earlier Changes' }).click();
  assert.equal(await page.getByLabel('Text of ideas.txt').inputValue(), 'Try a lemon cake. And scones.');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave Without Saving' }).click();
});

test('Change a Project: add, replace warning, rename, delete, folder, upload', async () => {
  // Add a typed file.
  await goto('#/p/tester/recipes/newfile');
  await waitH1('Add a new file');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  assert.equal(await page.getByLabel('File name').getAttribute('aria-invalid'), 'true');
  await axe('Change: add file with error');
  await page.getByLabel('File name').fill('about.html');
  await page.getByLabel('What the file should say').fill('<h1>About us</h1>');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByText('"about.html" was added').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'about.html'), '<h1>About us</h1>');

  // Adding the same name warns before overwriting.
  await goto('#/p/tester/recipes/newfile');
  await waitH1('Add a new file');
  await page.getByLabel('File name').fill('about.html');
  await page.getByLabel('What the file should say').fill('Oops');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const replace = page.getByRole('dialog', { name: 'Replace the existing file?' });
  await replace.waitFor();
  await replace.getByRole('button', { name: 'No, Choose Another Name' }).click();
  assert.equal(env.mock.readFile('tester', 'recipes', 'about.html'), '<h1>About us</h1>');
  await page.getByLabel('File name').fill('');
  await page.getByLabel('What the file should say').fill('');

  // Rename.
  await goto('#/p/tester/recipes/rename/about.html');
  await waitH1('Rename about.html');
  await axe('Change: rename');
  await page.getByLabel('New name').fill('info');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByRole('dialog', { name: 'Keep the ".html" ending?' }).getByRole('button', { name: 'Yes, call it "info.html"' }).click();
  await page.getByText('The file was renamed').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'about.html'), null);
  assert.equal(env.mock.readFile('tester', 'recipes', 'info.html'), '<h1>About us</h1>');

  // Delete, with a warning first.
  await goto('#/p/tester/recipes/changefile/info.html');
  await waitH1('info.html');
  await page.getByRole('button', { name: /Delete it/ }).click();
  const del = page.getByRole('dialog', { name: 'Delete "info.html"?' });
  await del.waitFor();
  assert.equal((await focusedName()).text, 'No, Keep It');
  await axe('Dialog: delete');
  await del.getByRole('button', { name: 'Yes, Delete It' }).click();
  await page.getByText('"info.html" was deleted').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'info.html'), null);

  // Create a folder.
  await goto('#/p/tester/recipes/newfolder');
  await waitH1('Create a folder');
  await page.getByLabel('Folder name').fill('pictures');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByText('The folder "pictures" was created').waitFor();
  assert.ok(env.mock.files('tester', 'recipes').includes('pictures/.keep'));

  // Upload a file from the device into the new folder (no drag and drop needed).
  await page.getByRole('link', { name: /Add a file from this device/ }).click();
  await waitH1('Add a file from this device');
  await axe('Change: upload');
  await page.getByLabel('Choose a file from this device').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: env.mock.PNG });
  assert.equal(await page.getByLabel('Name in the project').inputValue(), 'photo.png');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByText('"photo.png" was added').waitFor();
  assert.ok(env.mock.files('tester', 'recipes').includes('pictures/photo.png'));

  // Replace a file, with confirmation.
  await goto('#/p/tester/recipes/replace/notes/ideas.txt');
  await waitH1('Replace ideas.txt');
  await page.getByLabel('Choose a file from this device').setInputFiles({ name: 'new.txt', mimeType: 'text/plain', buffer: Buffer.from('Brand new ideas') });
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.getByRole('dialog', { name: 'Replace "ideas.txt"?' }).getByRole('button', { name: 'Yes, Replace It' }).click();
  await page.getByText('"ideas.txt" was replaced').waitFor();
  assert.equal(env.mock.readFile('tester', 'recipes', 'notes/ideas.txt'), 'Brand new ideas');

  // Delete the folder.
  await goto('#/p/tester/recipes/change/pictures');
  await waitH1('Change a Project');
  await page.getByRole('button', { name: 'Delete the folder "pictures"' }).click();
  await page.getByRole('dialog').getByText('the 1 file inside it').waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, Delete the Folder' }).click();
  await page.getByText('The folder "pictures" was deleted').waitFor();
  assert.ok(!env.mock.files('tester', 'recipes').some((f) => f.startsWith('pictures/')));
});

test('Start a Project: one step at a time, private or public explained', async () => {
  await goto('#/start');
  await waitH1('Start a Project');
  await page.getByRole('button', { name: 'Next' }).click();
  assert.equal(await page.getByLabel('Project name').getAttribute('aria-invalid'), 'true');
  await page.getByText('Please type a name with at least one letter or number.').waitFor();
  await axe('Start: step 1 with error');
  await page.getByLabel('Project name').fill('Garden Diary');
  await page.getByText('It will be saved as: Garden-Diary').waitFor();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Short description (optional)').fill('Notes about my garden.');
  await axe('Start: step 2');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Best for personal or unfinished work.').waitFor();
  await axe('Start: step 3');
  await page.getByRole('radio', { name: /Only me and people I invite/ }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Check the details. Then press Create My Project.').waitFor();
  await axe('Start: review');
  await page.getByRole('button', { name: 'Create My Project' }).click();
  await waitH1('Garden-Diary');
  await page.getByText('Your project was created').waitFor();
  const repo = env.mock.repos.get('tester/garden-diary');
  assert.ok(repo && repo.private);
  assert.ok(env.mock.files('tester', 'Garden-Diary').includes('README.md'));
});

test('Share a Project: public link with Copy, sharing by email and text', async () => {
  await goto('#/p/tester/recipes/share');
  await waitH1('Share a Project');
  await axe('Share: choices');
  await page.getByRole('link', { name: /A\. Let someone see my project/ }).click();
  await waitH1('Let someone see my project');
  await page.getByText('They cannot change anything.').waitFor();
  await axe('Share: public link');
  await page.getByRole('button', { name: 'Copy Link' }).click();
  await page.getByText('Link copied').waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/web\/tester\/recipes$/);
  assert.match(await page.getByRole('link', { name: 'Send by Email' }).getAttribute('href'), /^mailto:\?subject=recipes/);
  assert.match(await page.getByRole('link', { name: 'Send by Text Message' }).getAttribute('href'), /^sms:/);
});

test('Share a Project: private project explained; making it public is blocked when keys are found', async () => {
  await goto('#/p/tester/secret-app/share/see');
  await waitH1('Let someone see my project');
  await page.getByText('they will only see a "Page not found" message').waitFor();
  await axe('Share: private warning');
  await page.getByRole('link', { name: /Make my project public/ }).click();
  await waitH1('Make my project public');
  await page.getByText('Problem: private information was found').waitFor();
  await page.getByRole('link', { name: '.env' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Make My Project Public' }).count(), 0);
  await axe('Share: make public blocked');
  assert.equal(env.mock.repos.get('tester/secret-app').private, true);
});

test('Share a Project: make a private project public only after explicit confirmation', async () => {
  await goto('#/p/tester/garden-diary/share/public');
  await waitH1('Make my project public');
  await page.getByText('No passwords or keys were found').waitFor();
  await axe('Share: make public');
  await page.getByRole('button', { name: 'Make My Project Public' }).click();
  await page.getByText('Please tick the box to confirm you understand.').waitFor();
  assert.equal(env.mock.repos.get('tester/garden-diary').private, true);
  await page.getByLabel('I understand that everyone will be able to see this project.').check();
  await page.getByRole('button', { name: 'Make My Project Public' }).click();
  await page.getByText('Your project is now public').waitFor();
  assert.equal(env.mock.repos.get('tester/garden-diary').private, false);
});

test('Share a Project: invite a helper using GitHub invitations', async () => {
  await goto('#/p/tester/recipes/share/help');
  await waitH1('Let someone help work on my project');
  await axe('Share: invite');
  await page.getByLabel('Their GitHub username').fill('nobody-here');
  await page.getByRole('button', { name: 'Find This Person' }).click();
  await page.getByText('There is no GitHub account called "nobody-here".', { exact: false }).waitFor();
  await page.getByLabel('Their GitHub username').fill('helperperson');
  await page.getByRole('button', { name: 'Find This Person' }).click();
  await page.getByRole('heading', { name: 'Is this the right person?' }).waitFor();
  await page.getByText('Helpful Friend').waitFor();
  await axe('Share: confirm person');
  await page.getByRole('button', { name: 'Yes, Send the Invitation' }).click();
  await page.getByText('Invitation sent to helperperson').waitFor();
  await page.getByText('Invitations waiting for an answer').waitFor();
  assert.equal(env.mock.repos.get('tester/recipes').invitations.length, 1);
  await axe('Share: invitation sent');
});

test('Download a Project: one button gives a ZIP file', async () => {
  await goto('#/p/tester/recipes/download');
  await waitH1('Download a Project');
  await axe('Download');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download' }).click(),
  ]);
  assert.equal(download.suggestedFilename(), 'recipes.zip');
  await page.locator('.status').getByText('Your download has started').waitFor();
});

test('Download a Project: an empty project is explained instead of failing', async () => {
  env.mock.addRepo({ owner: 'tester', name: 'empty-one' });
  await goto('#/p/tester/empty-one/download');
  await waitH1('Download a Project');
  await page.getByRole('link', { name: 'Download' }).click();
  await page.getByText('Problem: This project is empty').waitFor();
  await page.getByText('Add a file to the project first.').waitFor();
  await axe('Download: empty project');
});

test('Try My Project: a plain website is published with GitHub Pages after confirmation', async () => {
  await goto('#/p/tester/recipes/try');
  await waitH1('Try My Project');
  await page.getByText('not yet a working website').waitFor();
  await axe('Try: can publish');
  await page.getByRole('link', { name: 'Publish My Project' }).click();
  await waitH1('Publish My Project');
  await page.getByText('What becomes public').waitFor();
  await axe('Try: confirm publish');
  await page.getByRole('button', { name: 'Yes, Publish My Project' }).click();
  await page.getByText('Please tick the box to confirm you understand.').waitFor();
  assert.equal(env.mock.repos.get('tester/recipes').pages, null);
  await page.getByLabel('I understand that anyone with the link will be able to visit this website.').check();
  await page.getByRole('button', { name: 'Yes, Publish My Project' }).click();
  await waitH1('Publishing your project');
  await axe('Try: publishing progress');
  await page.getByRole('link', { name: /Open My Project/ }).waitFor({ timeout: 30000 });
  await page.getByText('Your project is published').waitFor();
  await axe('Try: live website');
  assert.equal(env.mock.repos.get('tester/recipes').pages.source.path, '/');
  await page.getByRole('button', { name: 'Copy Website Link' }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/site\/tester\/recipes\/$/);
});

test('Try My Project: a server app is explained honestly and not published', async () => {
  await goto('#/p/tester/secret-app/try');
  await page.getByRole('heading', { name: 'Why it cannot be published here' }).waitFor({ timeout: 15000 });
  await page.getByText('SimpleGit will not connect to any of these companies').waitFor();
  await page.getByRole('button', { name: 'Copy This Request' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Publish My Project' }).count(), 0);
  await axe('Try: cannot publish');
});

test('Try My Project: an app that needs building is published with GitHub automatic building', async () => {
  await goto('#/p/tester/vite-app/try');
  await page.getByText('needs to be "built"').waitFor({ timeout: 15000 });
  await page.getByRole('link', { name: 'Publish My Project' }).click();
  await waitH1('Publish My Project');
  await page.getByText('Only the finished app is published').waitFor();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Yes, Publish My Project' }).click();
  await page.getByRole('link', { name: /Open My Project/ }).waitFor({ timeout: 30000 });
  const workflow = env.mock.readFile('tester', 'vite-app', '.github/workflows/simplegit-publish.yml');
  assert.match(workflow, /npx vite build --base=\/vite-app\/ --outDir dist/);
  assert.equal(env.mock.repos.get('tester/vite-app').pages.build_type, 'workflow');
});

test('someone else\'s project can be opened but not changed', async () => {
  await goto('#/p/otherperson/shared-thing/change');
  await waitH1('Change a Project');
  await page.getByText('You can look at this project, but you cannot change it.').waitFor();
  await axe('Change: read only');
});

test('errors explain what happened and what to do next', async () => {
  await goto('#/p/tester/does-not-exist/open');
  await waitH1('We could not find that');
  await page.getByText('Problem: We could not find that').waitFor();
  await page.getByRole('button', { name: 'Try Again' }).waitFor();
  await axe('Error screen');
});

test('phone screen: large targets and no sideways scrolling', async () => {
  const phone = await browser.newContext({
    viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const cookies = await context.cookies();
  await phone.addCookies(cookies);
  const p2 = await phone.newPage();
  for (const hash of ['#/', '#/p/tester/recipes/open', '#/p/tester/recipes/try', '#/p/tester/recipes/edit/README.md', '#/p/tester/recipes/share/see']) {
    await p2.goto(`${env.appUrl}/${hash}`);
    await p2.getByRole('heading', { level: 1 }).waitFor();
    await p2.waitForLoadState('networkidle');
    const wide = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(wide <= 0, `${hash} scrolls sideways by ${wide}px`);
    const small = await p2.evaluate(() => [...document.querySelectorAll('main button, main a.btn, main .menu-item, header .btn')]
      .filter((el) => el.offsetParent)
      .map((el) => ({ t: el.innerText.trim(), r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ t, r }) => `${t} (${Math.round(r.width)}x${Math.round(r.height)})`));
    assert.deepEqual(small, [], `Small touch targets on ${hash}`);
  }
  await phone.close();
});

test('dark mode and very narrow screens (320 pixels, like 400% zoom) also pass', async () => {
  const dark = await browser.newContext({ viewport: { width: 320, height: 700 }, colorScheme: 'dark' });
  await dark.addCookies(await context.cookies());
  const main = page;
  page = await dark.newPage();
  try {
    for (const [hash, name] of [['#/', 'What would you like to do?'], ['#/p/tester/recipes/open', 'Open a Project'], ['#/p/tester/recipes/try', 'Try My Project'], ['#/p/tester/recipes/edit/README.md', 'Edit README.md'], ['#/start/3', 'Start a Project']]) {
      await goto(hash);
      await waitH1(name, 15000);
      await page.waitForLoadState('networkidle');
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(wide <= 0, `${hash} scrolls sideways by ${wide}px at 320 pixels wide`);
      await axe(`Dark, 320px: ${name}`);
    }
  } finally {
    await dark.close();
    page = main;
  }
});

test('no automated accessibility problems on any screen', () => {
  assert.ok(checkedScreens.length >= 30, `Only ${checkedScreens.length} screens were checked`);
  assert.deepEqual(axeProblems, []);
});
