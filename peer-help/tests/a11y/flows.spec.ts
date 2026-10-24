import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, status, tabTo } from "./helpers";

test("keyboard only: ask for help, take a session, and keep the instructions", async ({ page }) => {
  await page.goto("index.html");

  // Home: reach Get Help with Tab and open it with Enter.
  await tabTo(page, "Get Help");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/get-help/);

  // Get Help: type the request and submit.
  await tabTo(page, "What do you need help with?");
  await page.keyboard.type("I need someone to teach me JAWS");
  await tabTo(page, "Find helpers");
  await page.keyboard.press("Enter");

  // Focus moves to the results heading so screen readers read the results next.
  const heading = page.getByRole("heading", { level: 2, name: /helpers? found/ });
  await expect(heading).toBeFocused();
  await expectNoAxeViolations(page);
  await expect(page.getByRole("heading", { level: 3, name: "Alex (demo)" })).toBeVisible();

  await tabTo(page, "Request a session with Alex (demo)");
  await page.keyboard.press("Enter");

  // Session: clearly simulated, with an accessible link to the external call service.
  await expect(page).toHaveURL(/session\.html\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: "Session with Alex (demo)" })).toBeVisible();
  await expect(page.getByText("This is a simulated session.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Join a voice call on Jitsi Meet/ })).toHaveAttribute("href", /^https:\/\/meet\.jit\.si\/PeerHelp-/);

  await tabTo(page, "Your message");
  await page.keyboard.type("Okay, I opened my browser.");
  await page.keyboard.press("Enter");
  await expect(status(page)).toHaveText(/Alex \(demo\) replied: Press H/, { timeout: 5000 });
  await expect(page.getByRole("textbox", { name: "Your message" })).toBeFocused();
  await expectNoAxeViolations(page);

  // Without consent, nothing is created and the error is explained.
  await tabTo(page, "Create instructions");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Please tick the agreement box first.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /I agree/ })).toBeFocused();

  await page.keyboard.press("Space");
  await tabTo(page, "Create instructions");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Review your instructions" })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Steps, one per line" })).toHaveValue(/Press H to move to the next heading/);
  await expect(page.getByRole("radio", { name: "Only me (private)" })).toBeChecked();
  await expectNoAxeViolations(page);

  await tabTo(page, "Save to My Instructions");
  await page.keyboard.press("Enter");

  // My Instructions: the saved steps, announced and private.
  await expect(page).toHaveURL(/instructions\.html\?id=/);
  await expect(page.getByRole("heading", { level: 1, name: /How to: / })).toBeFocused();
  await expect(status(page)).toHaveText("Saved to My Instructions.");
  await expect(page.getByRole("listitem").filter({ hasText: "Press H to move to the next heading" })).toBeVisible();
  await expect(page.getByText("Private. Only you can see these instructions.")).toBeVisible();
  await expectNoAxeViolations(page);

  // And it is listed on My Instructions.
  await page.goto("instructions.html");
  await expect(page.getByRole("link", { name: /How to: / })).toBeVisible();
});

test("a request with no recognised skill offers a topic list", async ({ page }) => {
  await page.goto("get-help.html");
  await page.getByLabel("What do you need help with?").fill("hello");
  await page.getByRole("button", { name: "Find helpers" }).press("Enter");
  await expect(page.getByRole("heading", { name: "Which topic is closest?" })).toBeFocused();
  await page.getByLabel("Choose the closest topic").selectOption("magnification");
  await page.getByRole("button", { name: "Show helpers for this topic" }).press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Jordan (demo)" })).toBeVisible();
});

test("an empty request gives an accessible error", async ({ page }) => {
  await page.goto("get-help.html");
  await page.getByRole("button", { name: "Find helpers" }).press("Enter");
  const field = page.getByLabel("What do you need help with?");
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(/Please say or type what you need help with/);
});

test("nothing reaches the shared library without explicit confirmation", async ({ page }) => {
  await page.goto("instructions.html");
  await page.getByRole("button", { name: "write steps myself" }).press("Enter");
  await page.getByLabel("Title").fill("My private steps");
  await page.getByLabel("Steps, one per line").fill("Press Tab\nPress Enter");
  await page.getByRole("radio", { name: /share a copy/ }).check();
  await page.getByRole("button", { name: "Save to My Instructions" }).press("Enter");
  await expect(page.getByText(/tick the box to confirm there is no personal information/)).toBeVisible();

  await page.getByRole("radio", { name: "Only me (private)" }).check();
  await page.getByRole("button", { name: "Save to My Instructions" }).press("Enter");
  await expect(page.getByText("Private. Only you can see these instructions.")).toBeVisible();

  await page.goto("library.html");
  await expect(page.getByRole("heading", { name: "My private steps" })).toHaveCount(0);

  // Share it explicitly, with confirmation; now it appears.
  await page.goto("instructions.html");
  await page.getByRole("link", { name: "My private steps" }).press("Enter");
  await page.getByRole("checkbox", { name: /I want to share these steps/ }).check();
  await page.getByRole("button", { name: "Share in the library" }).press("Enter");
  await expect(status(page)).toHaveText("Shared in the library.");
  await page.goto("library.html");
  await expect(page.getByRole("heading", { name: "My private steps" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("trainer profile: saving lists the person and shows matching demo requests", async ({ page }) => {
  await page.goto("help-someone.html");
  await page.getByLabel("Your first name or a nickname").fill("Taylor");
  await page.getByRole("checkbox", { name: "Braille displays" }).check();
  await page.getByLabel("When are you usually available?").fill("Saturday mornings");
  await page.getByRole("radio", { name: "Yes, I charge" }).check();
  await page.getByRole("button", { name: "Save trainer profile" }).press("Enter");
  await expect(status(page)).toHaveText(/Trainer profile saved/);
  await expect(page.getByText("1 of 5 demonstration requests match your skills.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Braille displays" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Yes, I charge" })).toBeChecked();
});

test("speech input is optional: without it, the page explains how to type or dictate", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });
  await page.goto("get-help.html");
  await expect(page.getByRole("button", { name: "Speak instead of typing" })).toBeHidden();
  await expect(page.getByText(/Speech input is not available in this browser/)).toBeVisible();
  await expect(page.getByLabel("What do you need help with?")).toBeEditable();
});

test("an unknown session explains what to do", async ({ page }) => {
  await page.goto("session.html?id=nope");
  await expect(page.getByRole("heading", { level: 1, name: "Session not found" })).toBeVisible();
});

test("delete all information clears this device", async ({ page }) => {
  await page.goto("profile.html");
  await page.getByLabel("Your first name or a nickname").fill("Sam");
  await page.getByRole("button", { name: "Save profile" }).press("Enter");
  await page.getByRole("button", { name: "Delete all my information from this device" }).press("Enter");
  await expect(page.getByText(/Delete your profile, sessions/)).toBeFocused();
  await page.getByRole("button", { name: "No, keep my information" }).press("Enter");
  await expect(page.getByRole("button", { name: "Delete all my information from this device" })).toBeFocused();
  await expect(status(page)).toHaveText("Nothing was deleted.");
  await page.getByRole("button", { name: "Delete all my information from this device" }).press("Enter");
  await page.getByRole("button", { name: "Yes, delete everything" }).press("Enter");
  await expect(page).toHaveURL(/index\.html/);
  await page.goto("profile.html");
  await expect(page.getByLabel("Your first name or a nickname")).toHaveValue("");
});
