'use strict';
// Morphic adapter — PLANNED, NOT FUNCTIONAL.
//
// What we verified from public sources (October 2026):
//  - Morphic (morphic.org) is a free, open-source accessibility toolbar (the
//    MorphicBar) from Raising the Floor, for Windows and macOS. It surfaces
//    features already built into the operating system: text size, magnifier,
//    read selected text, contrast, color vision filters, dark mode, night mode.
//  - Morphic can save a person's settings to their own Morphic account and apply
//    them on other computers running Morphic.
//  - Windows source code: https://github.com/raisingthefloor/morphic-windows
//
// What we did NOT find: a documented public web API that a third-party website
// may call to read or apply a person's Morphic settings. So this prototype only
// links to Morphic and keeps its own (separate) preference record. It never
// installs Morphic, changes computer settings, or contacts Morphic servers.
//
// To make this functional later: obtain a documented interface and written
// agreement from Raising the Floor, get explicit consent from each patron, then
// implement the methods below and flip `status` to 'available'.

const status = 'planned';

const capabilities = [
  { name: 'Link to Morphic information and download pages', status: 'available' },
  { name: 'Record which MorphicBar features a patron finds helpful (stored here, not in Morphic)', status: 'available' },
  { name: 'Tell staff a patron uses Morphic so they can help set up a library computer', status: 'available' },
  { name: 'Read a patron\'s saved Morphic settings (with consent)', status: 'planned' },
  { name: 'Apply a patron\'s Morphic settings to a library computer', status: 'planned' },
  { name: 'Library-wide custom MorphicBar suggestions', status: 'planned' },
];

class NotAvailableError extends Error {
  constructor(what) { super(`${what} is a planned integration and is not functional in this prototype.`); }
}

const adapter = {
  status,
  capabilities,
  async readSettings(/* patronId, consentToken */) { throw new NotAvailableError('Reading Morphic settings'); },
  async applySettings(/* computerId, settings, consentToken */) { throw new NotAvailableError('Applying Morphic settings'); },
};

module.exports = { adapter, capabilities, status, NotAvailableError };
