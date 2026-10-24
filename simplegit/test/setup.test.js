// First-time setup: a fresh copy of SimpleGit walks the person through
// connecting to GitHub, and sends GitHub a correct, narrowly scoped app manifest.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 39000 + Math.floor(Math.random() * 500);
const url = `http://localhost:${port}`;
let child;
let browser;

before(async () => {
  const env = { ...process.env, PORT: String(port), SIMPLEGIT_ENV_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sg-setup-')), '.env') };
  for (const k of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_APP_SLUG', 'BASE_URL', 'SESSION_SECRET']) delete env[k];
  child = spawn(process.execPath, ['server/index.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve) => child.stdout.on('data', (d) => { if (String(d).includes('SimpleGit is running')) resolve(); }));
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  child?.kill();
});

test('setup is explained one step at a time and creates a narrowly scoped GitHub App', async () => {
  const page = await (await browser.newContext()).newPage();
  const check = async () => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(r.violations.map((v) => v.id), []);
  };
  await page.goto(url);
  await page.getByRole('heading', { level: 1, name: 'Set up SimpleGit' }).waitFor();
  await page.getByText('Step 1 of 2').waitFor();
  await check();
  await page.getByRole('link', { name: 'Next' }).click();
  await page.getByText('Step 2 of 2').waitFor();
  await check();

  let posted = null;
  await page.route('https://github.com/settings/apps/new**', async (route) => {
    posted = { url: route.request().url(), body: route.request().postData() };
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<title>GitHub</title><h1>Create GitHub App</h1>' });
  });
  await page.getByRole('button', { name: 'Connect to GitHub' }).click();
  await page.waitForURL(/github\.com/);
  assert.ok(posted, 'The manifest was sent to GitHub');
  assert.match(posted.url, /state=[0-9a-f]{32}/);
  const manifest = JSON.parse(new URLSearchParams(posted.body).get('manifest'));
  assert.equal(manifest.public, false);
  assert.deepEqual(manifest.callback_urls, [`${url}/auth/callback`]);
  assert.equal(manifest.hook_attributes.active, false);
  assert.deepEqual(manifest.default_permissions, {
    contents: 'write', metadata: 'read', administration: 'write', pages: 'write', workflows: 'write', actions: 'read',
  });
});
