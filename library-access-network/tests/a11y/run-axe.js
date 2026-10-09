'use strict';
// Automated accessibility checks: runs axe-core (WCAG 2.0/2.1/2.2 A and AA rules)
// on every page in a real headless Chromium, in each contrast theme, at 200% text
// size, plus keyboard and narrow-screen (reflow) checks.
//
//   npm install          (once; installs the two dev-only tools)
//   npm run test:a11y
//
// Automated tools find only part of the problems. See docs/ACCESSIBILITY.md for
// what still needs testing by JAWS users.

const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('../helpers');

let chromium;
let axeSource;
try {
  ({ chromium } = require('playwright-core'));
  axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.error('Missing dev tools. Run "npm install" first, then "npm run test:a11y".');
  process.exit(2);
}

function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(root)) return undefined; // let Playwright use its default
  const dir = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && path.join(root, dir, 'chrome-linux', 'chrome');
  return exe && fs.existsSync(exe) ? exe : undefined;
}

const PAGES = [
  '/', '/help', '/search?q=gmail', '/learn', '/learn/gmail-with-jaws', '/learn/practice', '/learn/practice?checked=1',
  '/jaws', '/jaws?q=heading&category=web', '/morphic', '/kb', '/kb?q=pdf', '/kb/kb-pdf', '/kb/kb-zoom/edit',
  '/libraries', '/libraries/lib-dc', '/people/usr-andre', '/preferences', '/me',
  '/discuss', '/discuss/pos-morphic', '/discuss/pos-zoom', '/discuss/new', '/share',
  '/requests', '/requests/new', '/dashboard', '/dashboard?library=all',
  '/about', '/privacy', '/accessibility', '/demo',
];

const THEMES = [
  { contrast: 'default', textSize: '100' },
  { contrast: 'high', textSize: '100' },
  { contrast: 'dark', textSize: '200' },
];

async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}

(async () => {
  const app = await startApp();
  // CSP blocks inline scripts on our pages; bypass it only inside the test browser so axe can be injected.
  const browser = await chromium.launch({ executablePath: findChromium() });
  const problems = [];
  let checks = 0;

  try {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ bypassCSP: true });
      const page = await ctx.newPage();
      await page.goto(app.base + '/signin');
      await page.getByRole('button', { name: /Sign in as Rosa M\./ }).click();
      await page.goto(app.base + '/preferences');
      await page.locator(`input[name="contrast"][value="${theme.contrast}"]`).check();
      await page.locator(`input[name="textSize"][value="${theme.textSize}"]`).check();
      await page.getByRole('button', { name: 'Save preferences' }).click();

      for (const p of PAGES) {
        await page.goto(app.base + p);
        const violations = await runAxe(page);
        checks++;
        for (const v of violations) problems.push({ page: p, theme: `${theme.contrast}/${theme.textSize}%`, ...v });
      }

      // Error state: submit an empty form and check the error summary.
      await page.goto(app.base + '/requests/new');
      await page.locator('#f-topic').fill('');
      await page.getByRole('button', { name: 'Send request' }).click();
      checks++;
      for (const v of await runAxe(page)) problems.push({ page: '/requests/new (errors)', theme: theme.contrast, ...v });
      await ctx.close();
    }

    // Keyboard: the first Tab reaches the skip link, which moves focus to <main>.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(app.base + '/');
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement.textContent.trim());
    if (first !== 'Skip to main content') problems.push({ page: '/', id: 'keyboard-skip-link', help: `First Tab stop was "${first}"` });
    await page.keyboard.press('Enter');
    const afterSkip = await page.evaluate(() => document.activeElement.id);
    if (afterSkip !== 'main') problems.push({ page: '/', id: 'keyboard-skip-target', help: `Skip link moved focus to "${afterSkip}"` });
    checks++;

    // Focus must be visible: the focused link gets an outline.
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    if (outline === 'none') problems.push({ page: '/', id: 'focus-visible', help: 'Focused element has no outline' });
    checks++;

    // Reflow (WCAG 1.4.10): no horizontal scrolling at 320 CSS pixels wide.
    await page.setViewportSize({ width: 320, height: 640 });
    for (const p of ['/', '/jaws', '/learn/gmail-with-jaws', '/kb/kb-pdf', '/preferences']) {
      await page.goto(app.base + p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push({ page: p, id: 'reflow-320', help: `Page scrolls sideways by ${overflow}px at 320px wide` });
      checks++;
    }
    await ctx.close();
  } finally {
    await browser.close();
    await app.close();
  }

  if (problems.length) {
    console.log(`\n${problems.length} accessibility problem(s) found in ${checks} checks:\n`);
    for (const p of problems) console.log(`- [${p.theme || 'keyboard'}] ${p.page}: ${p.id} (${p.impact || 'n/a'}) ${p.help}${p.targets ? ' → ' + p.targets.join(', ') : ''}`);
    process.exit(1);
  }
  console.log(`Accessibility checks passed: ${checks} page checks across ${THEMES.length} themes, keyboard, focus, and 320px reflow. No axe-core violations.`);
})().catch((err) => { console.error(err); process.exit(1); });
