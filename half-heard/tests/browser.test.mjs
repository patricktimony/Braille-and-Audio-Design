// End-to-end check in a real browser (Chromium via Playwright).
// Run with:  node tests/browser.test.mjs
// Needs Playwright installed (npm install playwright && npx playwright install chromium).
// Speech recognition is simulated, because a headless browser has no microphone.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tiny static server so the page runs on http://localhost (a secure context).
const server = http.createServer(async (req, res) => {
  const rel = req.url === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
  try {
    const body = await fs.readFile(path.join(appDir, rel));
    const type = rel.endsWith('.js') ? 'text/javascript' : rel.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, { 'Content-Type': type }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const errors = [];
let passed = 0;
async function check(name, fn) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    // The fallback test makes the server fail on purpose.
    if (m.type() === 'error' && !/status of 500/.test(m.text())) errors.push(`${name}: ${m.text()}`);
  });
  try { await fn(page, context); passed++; console.log('ok   ', name); }
  catch (e) { console.log('FAIL ', name, '\n', e.message); process.exitCode = 1; }
  await context.close();
}

await check('typed phrase produces five results and announces them', async (page) => {
  await page.goto(base);
  await page.fill('#phrase', 'I scream');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  assert.match(await page.locator('#heard').textContent(), /I scream/);
  assert.match(await page.locator('#list').textContent(), /Ice cream/);
  await page.waitForFunction(() => /5 misunderstandings are ready/.test(document.querySelector('#status').textContent));
});

await check('More Misunderstandings adds five new ones', async (page) => {
  await page.goto(base);
  await page.fill('#phrase', 'my cat is a genius');
  await page.click('text=Misunderstand It');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  await page.click('#more');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 10);
  const titles = await page.locator('#list h3').allTextContents();
  const texts = titles.map((t) => t.replace(/^\d+\.\s*/, '').toLowerCase());
  assert.strictEqual(new Set(texts).size, 10, 'no repeats');
});

await check('buttons explain themselves before any results exist', async (page) => {
  await page.goto(base);
  await page.click('#read');
  await page.waitForFunction(() => /Nothing to read yet/.test(document.querySelector('#status').textContent));
  await page.click('#save');
  await page.waitForFunction(() => /Nothing to save yet/.test(document.querySelector('#status').textContent));
});

await check('Save keeps results after reload, and Delete removes them', async (page) => {
  await page.goto(base);
  await page.fill('#phrase', 'good morning');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  await page.click('#save');
  await page.waitForFunction(() => document.querySelectorAll('#saved li').length === 1);
  await page.click('#save'); // saving again replaces, not duplicates
  await page.waitForFunction(() => /Saved/.test(document.querySelector('#status').textContent));
  await page.reload();
  assert.strictEqual(await page.locator('#saved li').count(), 1);
  assert.match(await page.locator('#saved summary').textContent(), /Good morning/);
  await page.click('#saved button:has-text("Delete")');
  assert.strictEqual(await page.locator('#saved li').count(), 0);
  assert.ok(await page.locator('#saved-empty').isVisible());
});

await check('Copy as Text puts plain text on the clipboard', async (page, context) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(base);
  await page.fill('#phrase', 'break a leg');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  await page.click('#copy');
  await page.waitForFunction(() => /copied/.test(document.querySelector('#status').textContent));
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^Half-Heard Genius Engine\nHeard: Break a leg/);
  assert.match(text, /1\. /);
  assert.doesNotMatch(text, /</, 'no HTML in copied text');
});

await check('Read Aloud speaks the newest results and can be stopped', async (page) => {
  await page.addInitScript(() => {
    window.__spoken = [];
    const fake = { speaking: false, pending: false, cancel() { this.speaking = false; }, speak(u) { window.__spoken.push(u.text); this.speaking = true; } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake });
  });
  await page.goto(base);
  await page.fill('#phrase', 'hello');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  await page.click('#read');
  assert.strictEqual(await page.locator('#read').textContent(), 'Stop Reading');
  const spoken = await page.evaluate(() => window.__spoken);
  assert.match(spoken[0], /^I heard: Hello/);
  assert.ok(spoken.some((s) => /^Number 5\./.test(s)));
  await page.click('#read');
  assert.strictEqual(await page.locator('#read').textContent(), 'Read Aloud');
});

await check('without speech recognition, typing is offered and Listen does not pretend', async (page) => {
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await page.goto(base);
  assert.ok(await page.locator('#no-speech-note').isVisible(), 'note shown on load');
  await page.click('#listen');
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'phrase', 'focus moves to the text box');
  await page.waitForFunction(() => /not available/.test(document.querySelector('#status').textContent));
  assert.notStrictEqual(await page.locator('#listen').getAttribute('aria-pressed'), 'true');
});

await check('simulated speech recognition fills in what was heard', async (page) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      start() {
        setTimeout(() => this.onstart && this.onstart(), 10);
        setTimeout(() => {
          const alt = (t) => ({ transcript: t, confidence: 0.5 });
          const result = [alt('recognize speech'), alt('wreck a nice beach')];
          result.isFinal = true;
          this.onresult({ resultIndex: 0, results: [result] });
          this.onend();
        }, 50);
      }
      stop() {}
    }
    window.webkitSpeechRecognition = FakeRecognition;
    delete window.SpeechRecognition;
  });
  await page.goto(base);
  assert.ok(await page.locator('#no-speech-note').isHidden());
  await page.click('#listen');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  assert.match(await page.locator('#heard').textContent(), /Recognize speech/);
  assert.match(await page.locator('#list li').first().textContent(), /Wreck a nice beach/);
  assert.strictEqual(await page.locator('#listen-label').textContent(), 'Listen');
});

await check('microphone permission denied gives a clear message', async (page) => {
  await page.addInitScript(() => {
    window.webkitSpeechRecognition = class { start() { setTimeout(() => { this.onerror({ error: 'not-allowed' }); this.onend(); }, 10); } stop() {} };
    delete window.SpeechRecognition;
  });
  await page.goto(base);
  await page.click('#listen');
  await page.waitForFunction(() => /permission/.test(document.querySelector('#status').textContent));
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'phrase');
});

await check('everything is reachable by keyboard', async (page) => {
  await page.goto(base);
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => document.activeElement.id || document.activeElement.textContent.trim()));
  }
  for (const id of ['listen', 'phrase', 'more', 'read', 'save', 'copy']) assert.ok(seen.includes(id), `${id} reachable: ${seen}`);
});

await check('fits an iPhone-sized screen without sideways scrolling', async (page) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto(base);
  await page.fill('#phrase', 'excuse me while I kiss the sky');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page is ${overflow}px too wide`);
  const h = await page.locator('#listen').evaluate((b) => b.getBoundingClientRect().height);
  assert.ok(h >= 120, 'Listen button is large');
});

await check('a broken language-model server falls back to the built-in engine', async (page) => {
  let called = false;
  await page.route('**/api/interpret', (route) => { called = true; route.fulfill({ status: 500, body: 'nope' }); });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'HALF_HEARD_CONFIG', { configurable: true, get: () => ({ llmEndpoint: '/api/interpret' }), set() {} });
  });
  await page.goto(base);
  await page.fill('#phrase', 'I scream');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#list li').length === 5);
  assert.ok(called, 'tried the server first');
});

await browser.close();
server.close();
if (errors.length) { console.log('\nBrowser errors:\n' + errors.join('\n')); process.exitCode = 1; }
console.log(`\n${passed} browser checks passed.`);
