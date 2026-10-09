'use strict';
// Registry of future integrations. Each entry states plainly what works today
// and what is only planned. Pages read from here, so status labels in the UI
// stay accurate when an integration is implemented.

const morphic = require('./morphic');
const jaws = require('./jaws');

const INTEGRATIONS = [
  {
    id: 'jaws', name: 'JAWS screen reader', status: jaws.status,
    now: 'Lessons, command guide, and pages built to work well with JAWS.',
    later: 'Opt-in, staff-reviewed JAWS settings or scripts, using Freedom Scientific\'s documented tools.',
    capabilities: jaws.capabilities,
  },
  {
    id: 'morphic', name: 'Morphic (Raising the Floor)', status: morphic.status,
    now: 'Information, official links, and a note of which Morphic features a patron likes.',
    later: 'Read or apply a patron\'s saved Morphic settings, with consent, once a documented interface exists.',
    capabilities: morphic.capabilities,
  },
  {
    id: 'identity', name: 'Library identity (library card sign-in)', status: 'planned',
    now: 'Fictional demonstration accounts with hashed passwords.',
    later: 'Sign in with a library card through the library\'s own system (for example SAML, OpenID Connect, or SIP2). Replace signIn() in src/auth.js.',
  },
  {
    id: 'video', name: 'Accessible video and audio training', status: 'planned',
    now: 'Text lessons that work with speech, braille, and print.',
    later: 'Captioned, audio-described recordings attached to each lesson.',
  },
  {
    id: 'ai-summary', name: 'Opt-in AI summaries', status: 'planned',
    now: 'People write knowledge-base summaries themselves.',
    later: 'Optional draft summaries of a solved thread, only when every participant opts in, always edited by a person before publishing.',
  },
  {
    id: 'paid-trainers', name: 'Paid peer-trainer network', status: 'planned',
    now: 'Volunteer and staff trainers listed per library; patrons request training.',
    later: 'Scheduling and payment for blind peer trainers, with vetting by participating libraries.',
  },
];

module.exports = { INTEGRATIONS, morphic, jaws };
