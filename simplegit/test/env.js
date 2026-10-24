// Test settings. Imported before anything else so the real .env file (if
// any) is never read or changed by tests.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

Object.assign(process.env, {
  SIMPLEGIT_ENV_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'simplegit-')), '.env'),
  GITHUB_CLIENT_ID: 'Iv1.test',
  GITHUB_CLIENT_SECRET: 'test-secret',
  GITHUB_APP_SLUG: 'simplegit-test',
  SESSION_SECRET: 'a-test-session-secret-that-is-long-enough-1234',
  ALLOW_LOCAL_SITE_CHECK: '1',
});
