import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The built page only talks to itself, to the GitHub API and to the hosts that
// serve release assets, and loads its fonts from Google Fonts. The policy is
// added to the built index.html only: the development server injects inline
// scripts for hot reload, which a strict policy would block.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.github.com https://github.com https://raw.githubusercontent.com https://*.githubusercontent.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

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
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  server: {
    // Web Serial only works on https or on localhost, so the development
    // server has no reason to listen on the network.
    host: 'localhost',
    port: 3000,
  },
});
