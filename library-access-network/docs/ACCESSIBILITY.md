# Accessibility

Target: **WCAG 2.2 level AA**.

## Design decisions

- **Server-rendered HTML, no client-side JavaScript.** Each action is a normal link or form submission that loads a new page. JAWS handles this predictably: there are no virtual-buffer refresh problems, no hidden focus moves, and no custom widgets to learn.
- **Results are announced through the page title.** After a form is submitted, the next page title starts with the result, for example "Your question was posted — …". JAWS reads the title when a page loads. The same message appears in a `role="status"` box at the top of the main content.
- **Error summaries.** Invalid forms are shown again with the person's input kept, a `role="alert"` summary that links to each field, `aria-invalid`, and an error message connected to the field with `aria-describedby`. The page title starts with "Error".
- **Structure.** Each page has one `<h1>`, a logical heading order, `header`/`nav`/`main`/`footer` landmarks, and a skip link. Lists, tables with captions and header cells, and `fieldset`/`legend` for groups of radio buttons and checkboxes are used where they apply.
- **Visible focus.** A 4px outline with an offset, plus a highlight on focused links, in every theme. Windows High Contrast (forced colors) is supported.
- **Targets of at least 44 by 44 CSS pixels** for buttons, navigation links, and form fields (WCAG 2.5.8 needs 24).
- **No drag-and-drop, pop-ups, time limits, carousels, animations, or automatic focus changes.** Choices use native radio buttons, checkboxes, and select menus.
- **Themes and text size.** Standard, high contrast (white and yellow on black), and dark, with text at 100%, 125%, 150%, or 200%. Layouts reflow with no sideways scrolling at 320 CSS pixels.
- **Plain language.** Short sentences, keys named exactly ("press Insert+T"), and no jargon without explanation.

## Automated testing done

`npm run test:a11y` runs **axe-core** in headless Chromium with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, and `best-practice` rules on:

- all 32 pages, signed in as a librarian so the staff pages are included;
- in each of three themes (standard at 100%, high contrast at 100%, dark at 200%);
- a form in its error state;
- keyboard checks: the first Tab reaches the skip link, the skip link moves focus to `<main>`, and the focus outline is visible;
- reflow at 320px for five representative pages.

Result: **106 checks, 0 violations.** As a sanity check, the same setup on a deliberately broken page reported contrast, missing title, missing lang, missing alt text, and missing label.

`npm test` also checks that every page has exactly one `<h1>`, a `lang`, a skip link, landmarks, and a `<label>` for every form control.

## What still needs testing by real JAWS users

Automated tools catch only part of the barriers. Before any real use, this prototype needs sessions with blind patrons and trainers, ideally at more than one library. Specifically:

1. **JAWS with Chrome, Edge, and Firefox** (current JAWS versions): page title announcements after each form, error summaries, the radio-button groups on the preferences page, and the long main navigation (do people prefer a shorter menu?).
2. **Forms mode:** does JAWS switch into and out of forms mode smoothly in the answer and share forms? Are the hint texts read at the right time, or are they too verbose?
3. **Command guide accuracy** on the JAWS versions and keyboard layouts (desktop or laptop) actually installed at each library. Check the Gmail lesson step by step against the current Gmail interface.
4. **Braille displays:** are badges such as "Solved" and the credit lines clear in braille? Are any labels too long for a 40-cell display?
5. **Magnification users** (ZoomText, Windows Magnifier, the Morphic magnifier) at 200% to 400%: is the layout easy to follow?
6. **NVDA, Narrator, and VoiceOver**, because patrons will not all use JAWS.
7. **Voice control and switch access:** can every button be reached and named by voice?
8. **Cognitive load and plain language:** test with new screen reader users such as the "Harold" persona, who have never used a computer.
9. **Staff dashboard** with a screen reader: is the order of the request card and its update form clear?
10. **Older library computers and locked-down browsers**, and kiosk modes that reset settings.

Record findings as issues, and give participating testers credit, with their permission.
