'use strict';
// A deliberately small set of JAWS and Gmail keyboard commands, each checked
// against a public source (listed in SOURCES). This guide is reference text only:
// the app never sends keystrokes to JAWS or changes JAWS settings.
//
// Keys use the JAWS DESKTOP keyboard layout, where INSERT is the JAWS key.
// In the laptop layout, CAPS LOCK is usually the JAWS key and some
// numeric-keypad commands differ. Keys can also vary between JAWS versions
// and with custom key maps. Each library should check against its installed version.

const SOURCES = {
  fs: {
    name: 'Freedom Scientific — JAWS Keystrokes (official reference)',
    url: 'https://www.freedomscientific.com/Content/Documents/Manuals/JAWS/Keystrokes.pdf',
  },
  deque: {
    name: 'Deque University — JAWS Keyboard Shortcuts',
    url: 'https://dequeuniversity.com/screenreaders/jaws-keyboard-shortcuts',
  },
  gmailShortcuts: {
    name: 'Google Gmail Help — Keyboard shortcuts for Gmail',
    url: 'https://support.google.com/mail/answer/6594',
  },
  gmailScreenReader: {
    name: 'Google Gmail Help — Use a screen reader with Gmail',
    url: 'https://support.google.com/mail/answer/90559',
  },
};

const CATEGORIES = [
  { id: 'essentials', name: 'Essentials' },
  { id: 'reading', name: 'Reading text' },
  { id: 'web', name: 'Web pages' },
  { id: 'forms', name: 'Forms' },
  { id: 'tables', name: 'Tables' },
  { id: 'help', name: 'Getting help in JAWS' },
  { id: 'gmail', name: 'Gmail in a web browser' },
];

const COMMANDS = [
  // Essentials
  { id: 'stop-speech', keys: 'Ctrl', action: 'Stop speech (silence JAWS)', category: 'essentials', source: 'fs' },
  { id: 'say-all', keys: 'Insert+Down Arrow', action: 'Say All — read continuously from the current position', category: 'essentials', source: 'fs' },
  { id: 'say-line', keys: 'Insert+Up Arrow', action: 'Say the current line', category: 'essentials', source: 'fs' },
  { id: 'window-title', keys: 'Insert+T', action: 'Say the window title (useful to check where you are)', category: 'essentials', source: 'fs' },
  { id: 'say-time', keys: 'Insert+F12', action: 'Say the system time', category: 'essentials', source: 'fs' },
  { id: 'jaws-window', keys: 'Insert+J', action: 'Open the JAWS application window', category: 'essentials', source: 'fs' },
  { id: 'quick-settings', keys: 'Insert+V', action: 'Open JAWS Quick Settings for the current application', category: 'essentials', source: 'fs' },
  { id: 'virtual-cursor', keys: 'Insert+Z', action: 'Turn the Virtual PC Cursor on or off (Google recommends off when using Gmail shortcuts)', category: 'essentials', source: 'gmailScreenReader' },

  // Reading
  { id: 'next-char', keys: 'Right Arrow / Left Arrow', action: 'Say the next or previous character', category: 'reading', source: 'fs' },
  { id: 'next-word', keys: 'Ctrl+Right Arrow / Ctrl+Left Arrow', action: 'Say the next or previous word', category: 'reading', source: 'fs' },
  { id: 'next-line', keys: 'Down Arrow / Up Arrow', action: 'Say the next or previous line', category: 'reading', source: 'fs' },
  { id: 'top-of-page', keys: 'Ctrl+Home', action: 'Move to the top of the page or document', category: 'reading', source: 'fs' },

  // Web
  { id: 'next-heading', keys: 'H / Shift+H', action: 'Move to the next or previous heading', category: 'web', source: 'deque' },
  { id: 'heading-level', keys: '1 through 6', action: 'Move to the next heading at that level (for example, 2 for the next level-2 heading)', category: 'web', source: 'deque' },
  { id: 'headings-list', keys: 'Insert+F6', action: 'List the headings on the page', category: 'web', source: 'fs' },
  { id: 'links-list', keys: 'Insert+F7', action: 'List the links on the page', category: 'web', source: 'fs' },
  { id: 'next-region', keys: 'R / Shift+R', action: 'Move to the next or previous region (landmark)', category: 'web', source: 'deque' },
  { id: 'next-list', keys: 'L / Shift+L', action: 'Move to the next or previous list', category: 'web', source: 'deque' },
  { id: 'next-link', keys: 'Tab / Shift+Tab', action: 'Move to the next or previous link or control', category: 'web', source: 'fs' },
  { id: 'html-features', keys: 'Insert+F3', action: 'Open the list of virtual HTML features (headings, links, regions and more)', category: 'web', source: 'fs' },

  // Forms
  { id: 'next-field', keys: 'F / Shift+F', action: 'Move to the next or previous form field', category: 'forms', source: 'deque' },
  { id: 'next-button', keys: 'B / Shift+B', action: 'Move to the next or previous button', category: 'forms', source: 'deque' },
  { id: 'fields-list', keys: 'Insert+F5', action: 'List the form fields on the page', category: 'forms', source: 'fs' },
  { id: 'forms-mode-on', keys: 'Enter (on an edit field)', action: 'Turn on Forms Mode so you can type into the field', category: 'forms', source: 'fs' },
  { id: 'forms-mode-off', keys: 'Numpad Plus', action: 'Turn off Forms Mode (desktop layout)', category: 'forms', source: 'fs' },

  // Tables
  { id: 'next-table', keys: 'T / Shift+T', action: 'Move to the next or previous table', category: 'tables', source: 'deque' },
  { id: 'table-cells', keys: 'Ctrl+Alt+Arrow keys', action: 'Move between table cells (right, left, up, down)', category: 'tables', source: 'fs' },
  { id: 'tables-list', keys: 'Insert+Ctrl+T', action: 'List the tables on the page', category: 'tables', source: 'fs' },

  // Help
  { id: 'screen-help', keys: 'Insert+F1', action: 'Screen-sensitive help — explains where you are', category: 'help', source: 'fs' },
  { id: 'hotkey-help', keys: 'Insert+H', action: 'Hot key help for the current application', category: 'help', source: 'fs' },
  { id: 'windows-keys', keys: 'Insert+W', action: 'Windows keystroke help for the current application', category: 'help', source: 'fs' },

  // Gmail — these are Gmail's own shortcuts (turn on in Gmail settings), not JAWS commands.
  { id: 'gmail-help', keys: '? (Shift+/)', action: 'Show the list of Gmail keyboard shortcuts', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-move', keys: 'J / K', action: 'Move to the next (older) or previous (newer) conversation', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-open', keys: 'O or Enter', action: 'Open the selected conversation', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-msg', keys: 'N / P', action: 'Inside a conversation: next or previous message', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-back', keys: 'U', action: 'Return to the conversation list', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-inbox', keys: 'G then I', action: 'Go to the Inbox', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-compose', keys: 'C', action: 'Compose a new message', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-reply', keys: 'R / A / F', action: 'Reply, Reply all, or Forward', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-send', keys: 'Ctrl+Enter', action: 'Send the message you are writing', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-search', keys: '/', action: 'Move to the Search mail box', category: 'gmail', source: 'gmailShortcuts' },
  { id: 'gmail-archive', keys: 'E', action: 'Archive the conversation', category: 'gmail', source: 'gmailShortcuts' },
];

function searchCommands(query = '', category = '') {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return COMMANDS.filter((c) => {
    if (category && c.category !== category) return false;
    const hay = `${c.keys} ${c.action} ${c.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

module.exports = { COMMANDS, CATEGORIES, SOURCES, searchCommands };
