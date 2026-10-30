import { test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FLASH_PAGE_SIZE, HARDWARE_ID_MAIN } from '../src/lib/generated/urtcCanIds';
import { installFakeBoard } from './support/fakeBoard';
import { connectBoard, openTab, openTesterPanel } from './support/studio';

// The pictures of the README: the built Studio in a real browser (Microsoft Edge with no window), with a board modelled behind the adapter
// (e2e/support/fakeBoard.ts) and made-up data. Nothing real is behind them. Run them with `node tools/make_screenshots.mjs`
// (the output folder is images/screenshots/, or the one given with --out).

const OUT = path.resolve(process.env.URTC_SHOTS_OUT ?? 'images/screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.mouse.move(1900, 1060); // the pointer is out of the way, so no tip covers anything
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

function image(size: number): Buffer {
  const data = Buffer.alloc(size, 0xa5);
  data.writeUInt32LE(0x20002000, 0);
  data.writeUInt32LE(0x08008101, 4);
  return data;
}

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'en-US' });

test('the pictures of the README', async ({ page }) => {
  test.setTimeout(120_000);
  await installFakeBoard(page, {
    bootloader: true,
    readings: [
      { faults: 0, heaterOnSeconds: 3600, lastFault: 0, persisted: true },
      { faults: 0, heaterOnSeconds: 5400, lastFault: 0, persisted: true },
      { faults: 1, heaterOnSeconds: 7200, lastFault: 2, persisted: true },
    ],
  });
  await page.addInitScript(() => { try { window.localStorage.setItem('i18nextLng', 'en'); } catch { /* storage blocked */ } });
  await page.goto('/');
  await connectBoard(page);

  await openTab(page, 'control');
  await shot(page, 'control');

  await openTab(page, 'oled');
  await shot(page, 'oled');

  await openTab(page, 'thermal');
  await shot(page, 'thermal');

  // the flasher with a made-up image and its manifest loaded (nothing is sent)
  await openTab(page, 'flasher');
  const bin = image(2 * FLASH_PAGE_SIZE + 100);
  const name = 'URTC_MAIN_FIRMWARE_v9.9.9.bin';
  const manifest = {
    version: '9.9.9', sha256: createHash('sha256').update(bin).digest('hex'), hmac_sha256: createHash('sha256').update('sample signature').digest('hex'),
    component: 'main_application', hardware_id: `0x${HARDWARE_ID_MAIN.toString(16).toUpperCase().padStart(8, '0')}`, signing_key_kind: 'development',
  };
  await page.locator('input[type="file"][accept=".bin,.json"]').setInputFiles([
    { name, mimeType: 'application/octet-stream', buffer: bin },
    { name: `${name}.manifest.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(manifest)) },
  ]);
  await page.waitForTimeout(800);
  await shot(page, 'flasher');

  // the tester: the black box, after three readings of the thermal counters
  await openTesterPanel(page, 'Black Box');
  const read = page.getByRole('button', { name: 'Read the thermal counters' });
  for (let reading = 0; reading < 3; reading++) { await read.click(); await page.waitForTimeout(500); }
  await shot(page, 'tester');
});
