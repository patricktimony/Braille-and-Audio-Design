// Starts the fake GitHub and SimpleGit together, for tests and demos.
import './env.js';
import { createMockGitHub } from './mock-github.js';
import { config } from '../server/config.js';
import { createApp } from '../server/index.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export async function startAll({ simplegitPort = 0 } = {}) {
  const mock = createMockGitHub();
  const mockServer = await listen(mock.app);
  const mockUrl = `http://127.0.0.1:${mockServer.address().port}`;
  mock.helpers.setBase(mockUrl);

  config.apiUrl = mockUrl;
  config.webUrl = mockUrl;
  const app = createApp();
  const appServer = await new Promise((resolve) => {
    const s = app.listen(simplegitPort, '127.0.0.1', () => resolve(s));
  });
  const appUrl = `http://localhost:${appServer.address().port}`;
  config.baseUrl = appUrl;
  seed(mock.helpers);
  return {
    mock: mock.helpers,
    appUrl,
    mockUrl,
    async stop() { appServer.close(); mockServer.close(); },
  };
}

export function seed(m) {
  m.addRepo({
    owner: 'tester', name: 'recipes', description: 'Family recipes website',
    files: {
      'README.md': '# Recipes\n\nOur family recipes.\n',
      'index.html': '<!doctype html><title>Recipes</title><h1>Recipes</h1>',
      'style.css': 'body { font-family: sans-serif; }',
      'images/cake.png': m.PNG,
      'notes/ideas.txt': 'Try a lemon cake.',
    },
  });
  m.addRepo({
    owner: 'tester', name: 'secret-app', description: 'A chat app with a server', isPrivate: true,
    files: {
      'package.json': JSON.stringify({ name: 'secret-app', scripts: { start: 'node server.js' }, dependencies: { express: '^4.0.0' } }),
      'server.js': 'const express = require("express");',
      '.env': 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz123456',
    },
  });
  m.addRepo({
    owner: 'tester', name: 'vite-app', description: 'A to-do list app made with Claude Code',
    files: {
      'package.json': JSON.stringify({ name: 'vite-app', scripts: { dev: 'vite', build: 'vite build' }, devDependencies: { vite: '^5.0.0' } }),
      'index.html': '<!doctype html><div id="app"></div><script type="module" src="/src/main.js"></script>',
      'src/main.js': 'document.querySelector("#app").textContent = "Hello";',
    },
  });
  m.addRepo({
    owner: 'otherperson', name: 'shared-thing', description: 'Someone else\'s project',
    perms: { admin: false, push: false, pull: true },
    files: { 'README.md': '# Shared thing\n', 'index.html': '<h1>Hi</h1>' },
  });
}
