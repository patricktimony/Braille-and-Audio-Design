'use strict';
// JAWS adapter — reference content AVAILABLE, automation PLANNED.
//
// JAWS is proprietary Windows software from Freedom Scientific (Vispero). It
// supports its own scripting language and settings files, which run inside JAWS
// on the local computer. A website cannot (and must not) read JAWS speech output,
// change JAWS settings, or install scripts. This prototype therefore:
//  - works ALONGSIDE JAWS as an ordinary accessible web page;
//  - provides lessons and a searchable command guide (src/content);
//  - never collects JAWS speech output and never monitors activity.
//
// A future, opt-in path could be a downloadable, staff-reviewed JAWS settings
// or script package that a patron chooses to install with permission, using
// Freedom Scientific's documented scripting tools. Not implemented.

const status = 'planned';

const capabilities = [
  { name: 'Screen-reader-friendly pages (headings, landmarks, labels)', status: 'available' },
  { name: 'Searchable, sourced JAWS keyboard-command guide', status: 'available' },
  { name: 'Short text lessons and a practice page', status: 'available' },
  { name: 'Staff-reviewed JAWS settings or scripts a patron can choose to install', status: 'planned' },
  { name: 'Reading or changing JAWS settings from the website', status: 'not planned — out of scope by design' },
];

module.exports = { status, capabilities };
