'use strict';
// Shared layout and accessible form components.
// Patterns: one <h1> per page, landmarks, skip link, labels tied to every
// control, hints and errors connected with aria-describedby, an error summary
// that links to each field, and results announced through the page <title>.

const { html, raw, escape } = require('./html');

const SITE = 'Library Access Network';

const ROLE_LABEL = { patron: 'Patron', trainer: 'Trainer', librarian: 'Librarian' };

function nav(user, current) {
  const items = [
    ['/', 'Home'],
    ['/help', 'Get help'],
    ['/learn', 'Learn a skill'],
    ['/share', 'Share a tip'],
    ['/discuss', 'Discussions'],
    ['/kb', 'Knowledge base'],
    ['/jaws', 'JAWS commands'],
    ['/morphic', 'Morphic'],
    ['/libraries', 'Libraries'],
    ['/requests', 'Trainer requests'],
    ['/preferences', 'My preferences'],
  ];
  if (user && (user.role === 'librarian' || user.role === 'trainer')) items.push(['/dashboard', 'Staff dashboard']);
  return html`<nav class="site-nav" aria-label="Main"><ul>${items.map(([href, label]) => {
    const isCurrent = href === '/' ? current === '/' : current === href || current.startsWith(href + '/');
    return html`<li><a href="${href}"${raw(isCurrent ? ' aria-current="page"' : '')}>${label}</a></li>`;
  })}</ul></nav>`;
}

function layout({ title, body, user, session, path = '/', status, library }) {
  const prefs = (user && user.prefs) || (session && session.prefs) || {};
  const textSize = ['100', '125', '150', '200'].includes(prefs.textSize) ? prefs.textSize : '100';
  const contrast = ['default', 'high', 'dark'].includes(prefs.contrast) ? prefs.contrast : 'default';
  const fullTitle = `${status ? status + ' — ' : ''}${title} — ${SITE}`;
  const who = user
    ? html`<div class="who">
        <p>Signed in as <a href="/people/${user.id}">${user.displayName}</a>
        (${ROLE_LABEL[user.role]}${library ? html`, ${library.name}` : ''}).</p>
        <form method="post" action="/signout">${csrfField(session)}<button type="submit" class="link-button">Sign out</button></form>
      </div>`
    : html`<div class="who"><p>You are not signed in. <a href="/signin">Sign in</a></p></div>`;
  return `<!doctype html>
<html lang="en" data-text-size="${escape(textSize)}" data-contrast="${escape(contrast)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(fullTitle)}</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
  <p class="demo-banner"><strong>Demonstration prototype.</strong> All libraries, people, and posts are fictional.
  Do not enter real personal information. <a href="/about">What this prototype can and cannot do</a>.</p>
  <div class="header-row">
    <p class="site-name"><a href="/">${SITE}</a></p>
    ${who}
  </div>
  ${nav(user, path)}
</header>
<main id="main" tabindex="-1">
${status ? `<div class="status-message" role="status"><p>${escape(status)}</p></div>` : ''}
${body}
</main>
<footer class="site-footer">
  <ul>
    <li><a href="/about">About and integration status</a></li>
    <li><a href="/privacy">Privacy</a></li>
    <li><a href="/accessibility">Accessibility statement</a></li>
    <li><a href="/demo">Demonstration walkthrough</a></li>
  </ul>
  <p>Library Access Network prototype. Not affiliated with Freedom Scientific, Vispero, Raising the Floor, or any real library.</p>
</footer>
</body>
</html>`;
}

// ---------- form components ----------

function csrfField(session) {
  return html`<input type="hidden" name="_csrf" value="${session ? session.csrf : ''}">`;
}

function describedBy(id, hint, error) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return ids ? raw(` aria-describedby="${escape(ids)}"`) : '';
}

function hintAndError(id, hint, error) {
  return html`${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}${error ? html`<p class="error" id="${id}-error"><span class="visually-hidden">Error: </span>${error}</p>` : ''}`;
}

function input({ name, label, value = '', hint, error, type = 'text', required = false, autocomplete, id = `f-${name}`, extra = '' }) {
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">(optional)</span>`}</label>
    ${hintAndError(id, hint, error)}
    <input type="${type}" id="${id}" name="${name}" value="${value}"${raw(required ? ' required' : '')}${raw(error ? ' aria-invalid="true"' : '')}${autocomplete ? raw(` autocomplete="${escape(autocomplete)}"`) : ''}${describedBy(id, hint, error)}${raw(extra)}>
  </div>`;
}

function textarea({ name, label, value = '', hint, error, required = false, rows = 6, id = `f-${name}` }) {
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">(optional)</span>`}</label>
    ${hintAndError(id, hint, error)}
    <textarea id="${id}" name="${name}" rows="${rows}"${raw(required ? ' required' : '')}${raw(error ? ' aria-invalid="true"' : '')}${describedBy(id, hint, error)}>${value}</textarea>
  </div>`;
}

function select({ name, label, options, value = '', hint, error, id = `f-${name}`, required = true }) {
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">(optional)</span>`}</label>
    ${hintAndError(id, hint, error)}
    <select id="${id}" name="${name}"${raw(error ? ' aria-invalid="true"' : '')}${describedBy(id, hint, error)}>
      ${options.map(([v, l]) => html`<option value="${v}"${raw(String(v) === String(value) ? ' selected' : '')}>${l}</option>`)}
    </select>
  </div>`;
}

// Radio buttons or checkboxes in a fieldset with a legend.
function choices({ name, legend, options, value, hint, error, type = 'radio', id = `f-${name}` }) {
  const selected = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
  return html`<div class="field${error ? ' has-error' : ''}">
    <fieldset${describedBy(id, hint, error)}>
      <legend>${legend}</legend>
      ${hintAndError(id, hint, error)}
      <div class="choices">
      ${options.map(([v, l, note], i) => {
        const oid = i === 0 ? id : `${id}-${i}`; // first option gets the field id so error links land on it
        return html`<div class="choice">
          <input type="${type}" id="${oid}" name="${name}" value="${v}"${raw(selected.includes(String(v)) ? ' checked' : '')}${note ? raw(` aria-describedby="${escape(oid)}-note"`) : ''}>
          <label for="${oid}">${l}</label>${note ? html`<p class="hint" id="${oid}-note">${note}</p>` : ''}
        </div>`;
      })}
      </div>
    </fieldset>
  </div>`;
}

function errorSummary(errors) {
  const entries = Object.entries(errors || {});
  if (!entries.length) return '';
  return html`<div class="error-summary" role="alert" aria-labelledby="error-summary-title">
    <h2 id="error-summary-title">There ${entries.length === 1 ? 'is a problem' : `are ${entries.length} problems`}</h2>
    <ul>${entries.map(([field, msg]) => html`<li><a href="#f-${field}">${msg}</a></li>`)}</ul>
  </div>`;
}

// ---------- small display helpers ----------

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function tagList(tags) {
  if (!tags || !tags.length) return '';
  return html`<p class="tags"><span class="visually-hidden">Topics: </span>${tags.map((t, i) => html`${i ? ', ' : ''}<a href="/search?q=${encodeURIComponent(t)}">${t}</a>`)}</p>`;
}

function statusBadge(text, kind = 'neutral') {
  return html`<span class="badge badge-${kind}">${text}</span>`;
}

module.exports = {
  layout, input, textarea, select, choices, errorSummary, csrfField,
  formatDate, tagList, statusBadge, ROLE_LABEL, SITE,
};
