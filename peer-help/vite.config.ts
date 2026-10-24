import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const pages = readdirSync(root).filter((f) => f.endsWith(".html"));

// Inserts the shared header and footer into every page as static HTML, so the
// navigation works even before (or without) JavaScript, and marks the current
// page in the navigation with aria-current="page".
function partials(): Plugin {
  return {
    name: "partials",
    transformIndexHtml(html, ctx) {
      const page = ctx.path.replace(/^\//, "") || "index.html";
      const header = readFileSync(resolve(root, "partials/header.html"), "utf8").replace(
        `<a href="./${page}">`,
        `<a href="./${page}" aria-current="page">`,
      );
      const footer = readFileSync(resolve(root, "partials/footer.html"), "utf8");
      return html.replace("<!-- header -->", header).replace("<!-- footer -->", footer);
    },
  };
}

// A strict Content Security Policy for the built site (not the dev server,
// which needs inline scripts for hot reloading). Only this site's own scripts
// may run, and the page may only connect back to its own origin.
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "csp",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`),
  };
}

export default defineConfig({
  // Relative paths let the built site work from any folder, e.g. GitHub Pages.
  base: "./",
  plugins: [partials(), contentSecurityPolicy()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p.replace(".html", ""), resolve(root, p)])),
    },
  },
  server: { host: true },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
