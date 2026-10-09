'use strict';
// Starts the app on a random port with a throwaway data file, and provides a
// tiny browser-like client that keeps cookies and reads CSRF tokens from forms.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

async function startApp() {
  // One throwaway data file per test process; each app starts from fresh seed data.
  if (!process.env.LAN_TEST_DIR) {
    process.env.LAN_TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-test-'));
    process.env.LAN_DATA_FILE = path.join(process.env.LAN_TEST_DIR, 'db.json');
  }
  const dir = process.env.LAN_TEST_DIR;
  require('../src/db').reset();
  const { createServer } = require('../src/app');
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, server, db: require('../src/db'),
    close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); fs.rmSync(dir, { recursive: true, force: true }); }),
  };
}

class Client {
  constructor(base) { this.base = base; this.cookie = ''; }

  async request(method, url, form) {
    const headers = { cookie: this.cookie };
    let body;
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(form)) [].concat(v).forEach((x) => p.append(k, x));
      body = p.toString();
    }
    const res = await fetch(this.base + url, { method, headers, body, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), text };
  }

  async get(url) {
    let r = await this.request('GET', url);
    while (r.status === 303 || r.status === 302) r = await this.request('GET', r.location);
    return r;
  }

  // Load the page containing the form (to get a CSRF token), then post it and follow the redirect.
  async submit(pageUrl, actionUrl, fields) {
    const page = await this.get(pageUrl);
    const m = page.text.match(/name="_csrf" value="([^"]+)"/);
    if (!m) throw new Error(`No CSRF token on ${pageUrl}`);
    let r = await this.request('POST', actionUrl, { _csrf: m[1], ...fields });
    const posted = r;
    while (r.status === 303) r = await this.request('GET', r.location);
    return { ...r, postStatus: posted.status, redirectedTo: posted.location };
  }

  signIn(username) {
    return this.submit('/signin', '/signin', { username, password: 'demo-library' });
  }

  signOut() {
    return this.submit('/', '/signout', {});
  }
}

const titleOf = (htmlText) => (htmlText.match(/<title>([^<]*)<\/title>/) || [])[1];

module.exports = { startApp, Client, titleOf };
