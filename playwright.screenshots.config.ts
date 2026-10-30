import { defineConfig } from '@playwright/test';

// The pictures of the README (see tools/make_screenshots.mjs): the built Studio, served by `vite preview` on this machine only, seen by
// Microsoft Edge with no window. Build it first (`npm run build`).
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.shots.ts',
  timeout: 120_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'msedge', headless: true, serviceWorkers: 'block' },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
