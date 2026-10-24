import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderServiceWorker, type PrecacheEntry } from './src/lib/serviceWorkerBuild';

const APP_VERSION: string = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

// Writes version.json next to the built page: the page compares it with its own version (src/lib/selfUpdate.ts) and
// offers a reload when the host serves a newer one.
function versionFile(): Plugin {
  return {
    name: 'urtc-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ name: 'urtc-web-studio', version: APP_VERSION }) + '\n' });
    },
  };
}

function publicFiles(directory: string, prefix = ''): PrecacheEntry[] {
  const found: PrecacheEntry[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...publicFiles(join(directory, entry.name), path));
    else found.push({ path, digest: createHash('sha256').update(readFileSync(join(directory, entry.name))).digest('hex') });
  }
  return found;
}

// The service worker (scripts/sw.template.js) keeps the built page, its scripts, styles, fonts and everything in public/ (the
// bundled firmware among it), so the Studio opens without a network. It is written next to index.html with the list filled in.
function serviceWorker(): Plugin {
  return {
    name: 'urtc-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entries: PrecacheEntry[] = Object.values(bundle).map((chunk) => ({
        path: chunk.fileName,
        digest: chunk.type === 'asset' ? createHash('sha256').update(chunk.source).digest('hex') : chunk.fileName,
      }));
      const publicDir = fileURLToPath(new URL('./public', import.meta.url));
      if (existsSync(publicDir)) entries.push(...publicFiles(publicDir));
      const template = readFileSync(new URL('./scripts/sw.template.js', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: renderServiceWorker(template, APP_VERSION, entries) });
    },
  };
}

// The built page only talks to itself, to the GitHub API and to the hosts that
// serve release assets; its scripts, styles, fonts and images all come from the page
// itself. Only the style *attributes* that React writes are allowed inline
// (style-src-attr); no inline <style> or <script> is. The policy is added to the
// built index.html only: the development server injects inline scripts for hot
// reload, which a strict policy would block.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://github.com https://raw.githubusercontent.com https://*.githubusercontent.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

// What the page asks the browser for, and nothing else. Web Serial is the only
// powerful feature it uses. A meta tag cannot carry this policy; it is sent as a
// response header by hosts that read public/_headers, and documented for the others.
export const PERMISSIONS_POLICY = [
  'serial=(self)',
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'usb=()',
  'bluetooth=()',
  'payment=()',
  'interest-cohort=()',
].join(', ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'urtc-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
    },
  };
}

export default defineConfig({
  // GitHub Pages serves a project site under /<repository>/; the workflow passes that path.
  base: process.env.URTC_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), versionFile(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  server: {
    // Web Serial only works on https or on localhost, so the development
    // server has no reason to listen on the network.
    host: 'localhost',
    port: 3000,
  },
});
