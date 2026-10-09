'use strict';
// Password hashing and sessions.
// PROTOTYPE ONLY: sessions live in memory and there is no account recovery,
// rate limiting, or audit logging. See docs/PRIVACY.md before any real use.
// Extension point: replace signIn() with a library identity system (SAML/OIDC,
// library card + PIN via the ILS) — see src/integrations/identity.js.

const crypto = require('node:crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 32);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const sessions = new Map(); // token -> { userId, csrf, prefs, flash }
const COOKIE = 'lan_session';

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

// Every visitor gets a session (anonymous until sign-in) so forms carry a CSRF token
// and visitors can try display preferences without creating an account.
function getSession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token && sessions.has(token)) return sessions.get(token);
  const fresh = { token: crypto.randomBytes(24).toString('hex'), userId: null, csrf: crypto.randomBytes(16).toString('hex'), prefs: null, flash: null };
  sessions.set(fresh.token, fresh);
  res.setHeader('Set-Cookie', `${COOKIE}=${fresh.token}; Path=/; HttpOnly; SameSite=Lax`);
  return fresh;
}

function startUserSession(session, userId) {
  // Rotate the session token on sign-in to prevent session fixation.
  sessions.delete(session.token);
  session.token = crypto.randomBytes(24).toString('hex');
  session.userId = userId;
  session.csrf = crypto.randomBytes(16).toString('hex');
  sessions.set(session.token, session);
  return `${COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Lax`;
}

function endSession(session) {
  session.userId = null;
  session.csrf = crypto.randomBytes(16).toString('hex');
}

function checkCsrf(session, token) {
  const a = Buffer.from(String(token || ''));
  const b = Buffer.from(session.csrf);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword, getSession, startUserSession, endSession, checkCsrf, parseCookies };
