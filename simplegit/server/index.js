// Starts the SimpleGit web server.
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { getIronSession } from 'iron-session';
import { config, ensureSessionSecret, isConfigured, ROOT } from './config.js';
import { apiRouter, authRouter } from './routes.js';

export function createApp() {
  ensureSessionSecret();
  const app = express();
  app.disable('x-powered-by');
  if (config.secure) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://avatars.githubusercontent.com'],
        connectSrc: ["'self'"],
        formAction: ["'self'", config.webUrl],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
        ...(config.secure ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.secure,
    crossOriginEmbedderPolicy: false,
  }));

  // The sign-in token lives only inside this encrypted cookie, which page
  // scripts cannot read.
  app.use(async (req, res, next) => {
    try {
      req.session = await getIronSession(req, res, {
        password: config.sessionSecret,
        cookieName: 'simplegit_session',
        ttl: 60 * 60 * 24 * 14,
        cookieOptions: { httpOnly: true, sameSite: 'lax', secure: config.secure, path: '/' },
      });
      next();
    } catch (err) { next(err); }
  });

  app.use(authRouter());
  app.use('/api', apiRouter());
  app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: 0 }));
  return app;
}

// Opens the web browser for people who start SimpleGit by double-clicking.
function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* the address is printed anyway */ }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const server = createApp().listen(config.port, config.host, () => {
    console.log(`\nSimpleGit is running. Open this address in your web browser:\n\n    ${config.baseUrl}\n`);
    console.log('Keep this window open while you use SimpleGit. Close it to stop SimpleGit.\n');
    if (!isConfigured()) console.log('SimpleGit is not connected to GitHub yet. The page above will walk you through it.\n');
    if (process.env.OPEN_BROWSER === '1') openBrowser(config.baseUrl);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\nSimpleGit could not start because something else is already using port ${config.port}.`);
      console.log(`SimpleGit may already be running. Try opening ${config.baseUrl} in your web browser.\n`);
      if (process.env.OPEN_BROWSER === '1') openBrowser(config.baseUrl);
    } else {
      console.log(`\nSimpleGit could not start: ${err.message}\n`);
    }
    process.exitCode = 1;
  });
}
