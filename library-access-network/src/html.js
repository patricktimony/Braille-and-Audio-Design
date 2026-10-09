'use strict';
// Tiny HTML templating: every interpolated value is escaped unless wrapped in raw().
// No client-side framework — every page is plain, server-rendered HTML.

class Raw {
  constructor(value) { this.value = String(value); }
  toString() { return this.value; }
}

const raw = (value) => new Raw(value);

function escape(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(escape).join('');
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tagged template: html`<p>${userText}</p>` -> Raw with userText escaped.
function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += escape(values[i]);
  });
  return new Raw(out);
}

// Turn plain text with blank-line paragraphs and "- " / "1. " lists into safe HTML.
function prose(text) {
  const blocks = String(text || '').trim().split(/\n\s*\n/);
  return raw(blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-*] /.test(l))) {
      return '<ul>' + lines.map((l) => `<li>${escape(l.slice(2))}</li>`).join('') + '</ul>';
    }
    if (lines.length && lines.every((l) => /^\d+[.)] /.test(l))) {
      return '<ol>' + lines.map((l) => `<li>${escape(l.replace(/^\d+[.)] /, ''))}</li>`).join('') + '</ol>';
    }
    return `<p>${lines.map(escape).join('<br>')}</p>`;
  }).join('\n'));
}

module.exports = { html, raw, escape, prose, Raw };
