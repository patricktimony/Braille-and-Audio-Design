import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, PAGES } from "./helpers";

for (const path of PAGES) {
  test.describe(path, () => {
    test("has no automatically detectable WCAG 2.2 AA problems", async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page);
    });

    test("has a language, a title, one main heading and landmarks", async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle(/Peer Tech Help/);
      await expect(page.locator("h1:visible")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByRole("status")).toHaveCount(1);
    });

    test("skip link is the first Tab stop and moves to the main content", async ({ page }) => {
      await page.goto(path);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
    });

    test("reflows at 320 pixels wide without sideways scrolling", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("the demonstration status is stated on every page", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByText("Trainers and sessions are demonstrations, not real people.")).toBeVisible();
  }
});
