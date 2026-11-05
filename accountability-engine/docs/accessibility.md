# Accessibility notes (aimed at WCAG 2.2 AA)

## Built in

| Success criterion | How the app meets it |
|---|---|
| 1.1.1 Non-text content | The only decorative symbol (⚖) has `aria-hidden`. |
| 1.3.1 Info and relationships | Landmarks, one `h1` per view, section headings, `<caption>` and `scope` on tables, `fieldset` and `legend` for radio groups, and real `<label>` elements. |
| 1.3.2 Meaningful sequence | DOM order is reading order. No CSS reordering. |
| 1.4.1 Use of colour | Finding levels are spelled out ("Level: Review"). Colour is only extra. |
| 1.4.3 and 1.4.11 Contrast | Text is at least 4.5:1 and borders at least 3:1, in light and dark themes. Checked with axe-core. |
| 1.4.4 and 1.4.10 Resize and reflow | Sizes are in relative units. There is no horizontal page scroll at 320 CSS px. Wide tables scroll inside a focusable region. |
| 1.4.12 Text spacing | No fixed heights on text containers. |
| 2.1.1 and 2.1.2 Keyboard | Every control is a native link, button or form field. There are no keyboard traps. |
| 2.1.4 Character key shortcuts | There are none. |
| 2.4.1 Bypass blocks | A skip link comes first in the page. |
| 2.4.2 Page titled | The title changes with each view. |
| 2.4.3 Focus order | After navigation, focus moves to the new view's heading. After an investigation, it moves to the investigation heading. |
| 2.4.6 Headings and labels | Headings describe their sections. Each **Investigate** button names its transaction (the extra words are visually hidden). |
| 2.4.7, 2.4.11 and 2.4.13 Focus visible, not obscured, appearance | A 3 px outline with an offset. No sticky headers. |
| 2.5.3 Label in name | Accessible names begin with the visible label. |
| 2.5.8 Target size | Controls are at least 44 × 44 px. Buttons inside tables are at least 36 px. |
| 3.2.3 and 3.2.6 Consistent navigation and help | Navigation and the Help link sit in the same place on every view. |
| 3.3.1 and 3.3.3 Error identification and suggestion | Import errors are reported one file at a time, in plain language, through the status region. |
| 3.3.7 Redundant entry | The account name and type are remembered between imports. |
| 4.1.2 Name, role, value | Native elements, `aria-current="page"` on the current navigation link, and `aria-controls` on draft previews. |
| 4.1.3 Status messages | A `role="status"` live region, plus `role="log"` for the conversation. |

The pages also honour `prefers-reduced-motion`, `prefers-color-scheme` and
`forced-colors`.

## Automated checks

- `tests/test_frontend_a11y.py` makes static checks: labels, button types,
  headings, live regions, no positive tabindex, and no `innerHTML`.
- During development, every view and the generated reports were scanned with
  axe-core 4.10 in Chromium, in both light and dark mode, using the WCAG 2.0,
  2.1 and 2.2 A and AA rules plus best practice. No violations were found.

## Manual screen-reader checklist

Before a release, run this checklist with NVDA and Firefox, JAWS and Chrome,
and VoiceOver and Safari, on both macOS and iOS:

1. Press Tab once. You should hear "Skip to main content". Press Enter, and you
   should land in the main content.
2. Go to Overview and choose **Load demonstration data**. The status message is
   announced once.
3. Go to Transactions and type `295.98` in the filter. The count is announced.
   Tab to **Investigate**. Its name includes the amount and date.
4. Press Enter. Focus lands on "Investigation: $295.98 on 2026-09-18". Move
   through the sections by heading: Summary, Verified facts, and so on.
5. Under Next actions, choose **Preview draft**. Focus moves to the preview
   heading, and the letter can be read line by line.
6. Go to Ask and type a question. The answer is read when it arrives.
7. In Privacy and settings, the radio group announces its legend, and the
   consent checkbox announces its full text.
8. Open a plain-text report and read it in browse mode, or on a braille display.
