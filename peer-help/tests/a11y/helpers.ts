import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PAGES = [
  "index.html",
  "get-help.html",
  "help-someone.html",
  "instructions.html",
  "library.html",
  "profile.html",
  "about.html",
  "session.html",
];

/** Fails the test if axe finds any WCAG 2.0, 2.1 or 2.2 A/AA violation. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

/** Text most recently announced through the page's status region. */
export function status(page: Page) {
  return page.locator("#status");
}

/** Presses Tab until the focused element matches, like a keyboard user would. */
export async function tabTo(page: Page, name: string | RegExp, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "";
      const id = el.id && document.querySelector(`label[for="${el.id}"]`);
      return (el.getAttribute("aria-label") ?? (id ? id.textContent : null) ?? el.textContent ?? "").trim();
    });
    if (typeof name === "string" ? focused === name : name.test(focused)) return;
  }
  throw new Error(`Could not reach "${name}" with the Tab key`);
}
