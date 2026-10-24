// Reads settings from environment variables (and the optional .env file).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = process.env.SIMPLEGIT_ENV_FILE || path.join(ROOT, '.env');

if (fs.existsSync(ENV_FILE)) {
  try { process.loadEnvFile(ENV_FILE); } catch (err) { console.warn('Could not read .env file:', err.message); }
}

const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, '');

export const config = {
  port,
  host: process.env.HOST || (process.env.BASE_URL ? '0.0.0.0' : '127.0.0.1'),
  baseUrl,
  secure: baseUrl.startsWith('https://'),
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  // When set, SimpleGit is running as a GitHub App (recommended).
  appSlug: process.env.GITHUB_APP_SLUG || '',
  // Only used when running as a classic OAuth App instead of a GitHub App.
  oauthScopes: process.env.GITHUB_OAUTH_SCOPES || 'repo workflow read:user',
  apiUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
  webUrl: (process.env.GITHUB_WEB_URL || 'https://github.com').replace(/\/$/, ''),
  sessionSecret: process.env.SESSION_SECRET || '',
  // Lets the setup page be used from another computer. Off by default so a
  // stranger cannot finish setup on a freshly deployed copy.
  allowRemoteSetup: process.env.ALLOW_REMOTE_SETUP === '1',
  // Testing only: lets the website checker visit local addresses.
  allowLocalSiteCheck: process.env.ALLOW_LOCAL_SITE_CHECK === '1',
};

export function isConfigured() {
  return Boolean(config.clientId && config.clientSecret);
}

// A session secret is required to encrypt the sign-in cookie. If none was
// given, create one and remember it in .env so people stay signed in across
// restarts.
export function ensureSessionSecret() {
  if (config.sessionSecret.length >= 32) return;
  config.sessionSecret = crypto.randomBytes(32).toString('base64url');
  saveEnv({ SESSION_SECRET: config.sessionSecret });
}

// Adds or replaces lines in the .env file. The file is readable only by the
// current user because it holds secrets.
export function saveEnv(values) {
  let lines = [];
  try { lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n'); } catch { /* new file */ }
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = line; else lines.push(line);
  }
  const text = lines.filter((l, i) => l !== '' || i < lines.length - 1).join('\n').replace(/\n*$/, '\n');
  try {
    fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
  } catch (err) {
    console.warn('Could not save settings to .env:', err.message);
  }
}
