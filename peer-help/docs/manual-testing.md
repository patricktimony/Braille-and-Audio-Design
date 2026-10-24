# Manual accessibility testing

Automated checks (`npm run test:a11y`) catch roughly a third of accessibility problems. They cannot tell
whether something *sounds* right or is easy to use. Before any release, have screen reader users run
these scripts. **Testers who are blind or have low vision every day give the most valuable results.**

Record each result as Pass, Fail (with what was heard), or Not applicable, plus the browser and screen
reader versions.

## Test matrix

| Screen reader | Browser | Device |
|---|---|---|
| VoiceOver | Safari | iPhone (current iOS and the version before it) |
| JAWS | Chrome, and Edge | Windows 11 |
| NVDA | Firefox, and Chrome | Windows 11 |
| Windows Narrator | Edge | Windows 11 |
| No screen reader, keyboard only | Any | Windows |
| Zoom at 200% and 400%, or Windows Magnifier | Edge | Windows |
| Voice Control (iOS) / Voice Access (Windows) | Safari / Edge | iPhone / Windows |

Start each run with fresh data: My Profile, then "Delete all my information from this device".

## Script A: Ask for help and remember it (the core journey)

1. Open the home page. **Expect** the page title "Peer Tech Help" to be read. The prototype notice must be
   easy to find. The three main links "Get Help", "Help Someone", and "My Instructions" must be reachable by
   heading or link navigation (JAWS/NVDA: `Insert+F7`/`NVDA+F7` links list; VoiceOver: rotor, Links).
2. Activate **Get Help**. Move to the text box. **Expect** "What do you need help with?" to be read, followed
   by the example hint.
3. Type "I need help scanning a document" and activate **Find helpers**. **Expect** "2 helpers found" to be
   read straight away, because focus moves to that heading. Then you should be able to read the results in
   order by heading (H key / rotor Headings).
4. Activate "Request a session with Sam (demo)". **Expect** the session page to say it is simulated, before
   the messages.
5. Find the **Join a voice call on Jitsi Meet (external website)** link. **Expect** the link text to make
   it clear that it leaves the site. (You do not need to join the call.)
6. In **Your message**, type "OK" and press Enter. **Expect** "Sent." and, about a second later,
   "Sam (demo) replied: …" to be announced **without focus moving** out of the message box. Repeat until the
   end-of-lesson message.
7. Activate **Create instructions** *without* ticking the agreement. **Expect** the error to be read, and
   focus to land on the agreement checkbox.
8. Tick the agreement and activate **Create instructions** again. **Expect** focus to move to "Review your
   instructions" and the explanation that the steps were made by simple rules, not AI.
9. Edit the steps text box (delete one line). Leave "Only me (private)" selected and save.
10. **Expect** the instructions page to open with the title read, "Saved to My Instructions" announced, and
    the steps read as a numbered list ("list, 4 items").
11. Go to **My Instructions** from the navigation and check the instructions are listed.

## Script B: Errors and consent

1. On Get Help, activate **Find helpers** with an empty box. **Expect** focus to return to the text box,
   which is announced as "invalid" with the error message.
2. On Get Help, type "hello" and search. **Expect** "Which topic is closest?" and a usable topic list
   (VoiceOver: picker wheel; JAWS/NVDA: combo box, arrow keys).
3. On My Instructions, choose **write steps myself**, add steps, pick "share a copy", and save without
   ticking the confirmation. **Expect** an error read aloud, and nothing saved.
4. Open a private instruction and use **Share in the library** with the confirmation. **Expect** "Shared in
   the library." Then check that it appears on Shared Library. Use **Stop sharing** and check it disappears.
5. On My Profile, use **Delete all my information from this device**. **Expect** the browser's own
   confirmation dialog to be fully readable and answerable with the keyboard or gestures.

## Script C: Being a trainer

1. Open **Help Someone**. Enter a nickname, tick two skills, choose "Yes, I charge", and save.
   **Expect** the saved message to be announced, and the list of matching demonstration requests to update.
2. Save with no skills ticked. **Expect** the error "Choose at least one skill you can teach." and focus on
   the first skill checkbox.
3. Reload the page. **Expect** your choices to be kept.

## Script D: Speech (optional features)

1. On a browser with speech input (Safari on iPhone, Chrome or Edge on Windows), use **Speak instead of
   typing** on Get Help. **Expect** "Get ready. Speak after the tone.", then a tone. Speak, then hear a second
   tone, and the words appear in the text box and are announced.
2. Check that the screen reader's own speech is **not** typed into the box. Report it if it is, and try
   again with headphones.
3. Deny microphone permission. **Expect** a clear message suggesting typing instead.
4. On the home page, use **Speak a choice** and say "my instructions". **Expect** to move to My Instructions.
5. With iOS Voice Control, say "Tap Get Help" and "Tap Find helpers". With Windows Voice Access, say
   "Click Find helpers". **Expect** each control to be activated by its visible name.
6. On a saved instruction, use **Read steps aloud** with no screen reader running. **Expect** each step
   to be read, starting "Step 1".

## Script E: Low vision

1. Zoom the browser to 200%, then 400% (or use the iPhone at its largest text size). **Expect** no text cut
   off and no need to scroll sideways.
2. Turn on Windows High Contrast / Contrast themes and dark mode on iPhone. **Expect** all text, borders,
   and the focus outline to stay visible.
3. Tab through every page. **Expect** a clearly visible focus outline on every control, and focus never
   hidden behind other content.

## Screen reader–specific checks

- **VoiceOver (iPhone):** Swipe through each page from the top. The "Skip to main content" link is first.
  The rotor Headings and Form Controls lists are complete. Double-tap works on every button. No control is
  announced twice.
- **JAWS:** In virtual cursor mode, form fields switch to forms mode on Enter. `Insert+F5` (form fields)
  and `Insert+F6` (headings) list everything with sensible names.
- **NVDA:** Browse mode and focus mode switch automatically in text boxes. The Elements List (`NVDA+F7`)
  shows meaningful link and heading names. Status messages are spoken once, not repeated.
- **Narrator:** Scan mode (`Caps Lock+Space`) reads each page in order. Status messages are spoken.

## Reporting

For each failure note: the page, the step, what you expected, what you heard (quote it), and the browser,
screen reader, and versions. File it as an issue in this repository with the label `accessibility`.
