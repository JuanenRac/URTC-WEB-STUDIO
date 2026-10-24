import { defineConfig, devices } from '@playwright/test';

// End-to-end checks of the built Studio in a real browser. They run against the output of `npm run build`, served by `vite preview`
// on this machine only (no network, no hardware: a board is modelled by e2e/support/fakeBoard.ts). Run them with `npm run test:e2e`.
// The files are named *.e2e.ts so that the unit test runner (vitest) does not pick them up.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
