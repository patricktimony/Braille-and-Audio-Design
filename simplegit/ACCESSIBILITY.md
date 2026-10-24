# SimpleGit accessibility

Target: **WCAG 2.2 level AA**, plus cognitive accessibility, for JAWS, NVDA,
VoiceOver (Mac and iPhone), keyboard-only use, touchscreens, iPhone Safari and
Windows browsers.

## What was built in

| Area | How SimpleGit handles it |
| --- | --- |
| Structure | Semantic HTML: one `h1` per screen, `h2` sections, real `<button>`s for actions and `<a>` links for moving between screens, labelled `<nav>` regions, lists for lists. |
| Names | Every control has a visible text label that is also its accessible name. Icons are decorative (`aria-hidden`). |
| Focus | On every new screen, focus moves to the `h1`, so screen readers announce where you are. Thick two-colour focus ring (4px plus a halo) works on light, dark and Windows High Contrast. Skip link is the first item. |
| Announcements | Polite and assertive live regions announce loading, success ("Your changes were saved") and progress ("Step 2 of 3"). Error boxes use `role="alert"` and receive focus. |
| Not colour alone | Every message starts with a word: "Done:", "Problem:", "Please note:", and has an icon and border style. Steps say "Done", "Working on it now" or "Waiting" in words. |
| Forms | Visible labels, hints linked with `aria-describedby`, `aria-invalid` plus a written error, and focus moves to the first problem. |
| Dialogs | Native `<dialog>` (focus is kept inside it, Escape cancels). The safe choice ("No, Keep It") comes first and has focus. Focus returns to where you were. |
| Touch | Targets are at least 44 by 44 CSS pixels (most are 56 or more). No drag and drop: files are chosen with the standard file picker. No gestures needed. |
| Zoom and reflow | Text uses relative sizes (20px base). Works at 320 CSS pixels wide (the same as 400% zoom) with no sideways scrolling. |
| Motion | No animations or transitions. Nothing moves or flashes. |
| Dark mode | Full dark colour scheme with checked contrast. |
| Speech | Optional spoken instructions with the browser's speech synthesis. **Off by default**, and remembered only for the current tab. Spoken Help is a toggle button (`aria-pressed`). Repeat Instruction and Stop Speaking are always in the same place. |
| Cognitive | Short sentences, one instruction per screen, the same button names and positions everywhere, Back and Home on every screen, a confirmation after every action, Undo after every change, unsaved-work protection, drafts kept if the browser closes, the current project shown on every screen, no jargon (GitHub words are only explained on the Help page). |
| Errors | Every error says what happened and **What you can do**, in plain English. |

## Automated testing (done)

Run with `npm test` (43 tests, all passing).

- **axe-core** (via `@axe-core/playwright`) checks every screen and dialog
  against the WCAG 2.0, 2.1 and 2.2 A/AA rules plus axe best practices:
  welcome, Home, My Projects, project page, folders, text files, pictures,
  Change screens, edit, add, upload, rename, delete dialog, "changed by someone
  else" dialog, all Start a Project steps (including with errors), all Share
  screens, Download, all Try My Project states, read-only project, error
  screen, and five screens again in **dark mode at 320 pixels wide**.
  Result: **0 violations**.
- **Keyboard test:** the skip link comes first, all seven main buttons can be
  reached with Tab, every focused item has a visible outline of at least
  3 pixels, Enter opens a screen and focus lands on its heading.
- **Speech test:** proves speech never starts on its own, and that the
  toggle, Repeat and Stop work.
- **Phone test:** iPhone-sized screen with touch. No sideways scrolling, and
  no touch target smaller than 44 by 44 pixels.
- **Flows:** every feature is tested end to end in a real browser (Chromium)
  against a fake GitHub, including the warnings before deleting or overwriting
  and the "this file was changed since you opened it" protection.

## What still needs testing by people

Automated tools find roughly a third to a half of accessibility problems.
These need real assistive technology and real users:

### JAWS (Windows, with Chrome or Edge)
- [ ] Each new screen's heading is read when it opens (focus moves to the `h1`).
- [ ] "Done" and "Problem" messages are read without moving around.
- [ ] Publishing progress ("Step 2 of 3…") is announced, and not too often.
- [ ] Dialogs: the title and message are read when they open; Escape cancels.
- [ ] The Spoken Help button is read as "toggle button, not pressed / pressed".
- [ ] The file text area works in forms mode; Tab leaves it (Tab is never trapped).
- [ ] The file picker opens and the chosen file name is announced.

### NVDA (Windows, with Firefox and Chrome)
- [ ] Same checks as JAWS.
- [ ] Browse mode: H moves between headings; the main buttons are a list of 7.
- [ ] Breadcrumbs ("You are here") are read as navigation with the current place.

### VoiceOver (Mac, Safari)
- [ ] Same checks as JAWS, using VO keys and the rotor (headings, links, form controls).
- [ ] Copy Link reports "Link copied".

### VoiceOver (iPhone, Safari)
- [ ] Swiping right goes through each screen in a sensible order.
- [ ] Double-tap works on every button; the seven main buttons are easy to find.
- [ ] Share Link / Share Website opens the iPhone share sheet (Messages, Mail).
- [ ] Download: Safari asks to download, then the ZIP is in the Files app → Downloads.
- [ ] "Choose a file from this device" opens Photos and Files.
- [ ] Spoken Help works alongside VoiceOver, or can easily be left off.
- [ ] Dialogs keep VoiceOver inside them until a choice is made.

### Other checks
- [ ] Windows High Contrast (Contrast themes): buttons, borders and focus are visible.
- [ ] Browser zoom at 200% and 400% on a desktop; iOS text size at the largest setting.
- [ ] Voice control (Dragon, Voice Control on Mac and iPhone): "Click Save Changes" works, because names match the visible labels.
- [ ] Switch access on iPhone.
- [ ] **Usability sessions** with older adults, people with cognitive disabilities and first-time users: can they do the seven tasks without help? Which words confuse them?
