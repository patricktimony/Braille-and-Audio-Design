'use strict';
// Short training lessons. Text-first so they work with any screen reader, braille
// display, or print. Extension point: accessible video/audio versions can be
// attached via `media` once captioned, described recordings exist (see
// src/integrations/video.js).

const LESSONS = [
  {
    id: 'gmail-with-jaws',
    title: 'Read Gmail with JAWS',
    minutes: 10,
    level: 'Beginner',
    tags: ['gmail', 'email', 'jaws', 'chrome'],
    summary: 'Open your inbox, move between messages, and read an email using Gmail keyboard shortcuts with JAWS.',
    before: 'You need a Gmail account and a web browser such as Chrome, Edge, or Firefox. Ask library staff if you need help signing in. Never share your Gmail password with anyone, including library staff.',
    steps: [
      'Open your web browser and go to mail.google.com. Sign in if asked.',
      'Press Insert+T. JAWS says the window title. It should include "Inbox".',
      'Turn on Gmail keyboard shortcuts once: press Shift+/ (question mark) to open the shortcut list. If it offers a link named "Enable", press Enter on it. Your library computer may already have this on.',
      'Press Insert+Z to turn off the JAWS Virtual PC Cursor. Google recommends this so that Gmail shortcuts reach Gmail. Press Insert+Z again later to turn it back on for normal web reading.',
      'Press J to move to the next (older) conversation and K to move to the previous (newer) one. JAWS reads the sender and subject.',
      'Press O or Enter to open a conversation.',
      'Press Insert+Z to turn the Virtual PC Cursor back on, then press Insert+Down Arrow to read the message. Press Ctrl to stop speech.',
      'Press Insert+Z again, then press U to return to your inbox.',
    ],
    practice: 'Find the newest email in your inbox, open it, read the first paragraph, and return to the inbox. Then try pressing R to start a reply, and Escape to cancel it.',
    commands: ['virtual-cursor', 'window-title', 'gmail-help', 'gmail-move', 'gmail-open', 'say-all', 'stop-speech', 'gmail-back'],
    sources: ['gmailShortcuts', 'gmailScreenReader', 'fs'],
  },
  {
    id: 'web-by-headings',
    title: 'Explore a web page by headings',
    minutes: 8,
    level: 'Beginner',
    tags: ['web', 'headings', 'jaws', 'navigation'],
    summary: 'Skim any web page quickly by jumping between headings, the way a sighted reader scans bold titles.',
    before: 'Open any web page in your browser. Our practice page works well for this.',
    steps: [
      'Press Insert+F6 to hear a list of headings on the page. Use Up and Down Arrow to explore the list, then press Enter to jump to one.',
      'Press H to move to the next heading, or Shift+H to go back.',
      'Press a number from 1 to 6 to jump to the next heading at that level. Level 1 is usually the page title.',
      'Press Insert+Down Arrow to start reading from a heading. Press Ctrl to stop.',
      'Press R to move between regions, such as navigation and main content.',
    ],
    practice: 'Open the practice page in this site. Use H to find the heading "Library hours", and read the hours for Saturday.',
    commands: ['headings-list', 'next-heading', 'heading-level', 'say-all', 'stop-speech', 'next-region'],
    sources: ['fs', 'deque'],
  },
  {
    id: 'online-forms',
    title: 'Fill in an online form',
    minutes: 10,
    level: 'Beginner',
    tags: ['forms', 'web', 'jaws', 'applications'],
    summary: 'Move between form fields, type in them, choose options, and press the submit button.',
    before: 'Use the practice page in this site. It has a short form that sends nothing anywhere.',
    steps: [
      'Press F to move to the next form field. JAWS says the field label and type.',
      'Press Enter to turn on Forms Mode, then type. JAWS usually turns Forms Mode on for you when you Tab into a field.',
      'Press Tab to move to the next field. Use the Space bar to check a checkbox, and Arrow keys to choose a radio button.',
      'Press Numpad Plus (desktop layout) to leave Forms Mode and read the page normally.',
      'Press Insert+F5 to list all form fields. Press B to find the next button, then Enter to press it.',
    ],
    practice: 'Fill in the practice form with fictional information and press "Check my answers". Nothing is sent or saved.',
    commands: ['next-field', 'forms-mode-on', 'forms-mode-off', 'fields-list', 'next-button'],
    sources: ['fs', 'deque'],
  },
  {
    id: 'first-five',
    title: 'Your first five JAWS commands',
    minutes: 5,
    level: 'New to JAWS',
    tags: ['jaws', 'basics', 'getting started'],
    summary: 'Five commands that get you unstuck anywhere: stop, read, where am I, and help.',
    before: 'Sit at a library computer with JAWS running. Ask staff to start JAWS if you do not hear speech.',
    steps: [
      'Press Ctrl to stop JAWS talking at any time.',
      'Press Insert+Down Arrow to read everything from where you are.',
      'Press Insert+T to hear the window title, which tells you which program you are in.',
      'Press Insert+F1 for help about where you are right now.',
      'Press Insert+H to hear hot keys for the current program.',
    ],
    practice: 'Open this page, press Insert+T, then Insert+Down Arrow, then Ctrl after a few words.',
    commands: ['stop-speech', 'say-all', 'window-title', 'screen-help', 'hotkey-help'],
    sources: ['fs'],
  },
];

module.exports = { LESSONS };
