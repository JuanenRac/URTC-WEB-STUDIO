import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { FLASH_PAGE_SIZE, HARDWARE_ID_MAIN } from '../src/lib/generated/urtcCanIds';
import { installFakeBoard } from './support/fakeBoard';
import { connectBoard, openTab } from './support/studio';

// Flasher Studio against the modelled bootloader of the main board (e2e/support/fakeBoard.ts): the whole CAN-OTA conversation of the
// page - enter the bootloader, START_UPDATE, the signature, the pages with their acknowledgements, END_UPDATE - in a real browser.

function image(size: number): Buffer {
  const data = Buffer.alloc(size, 0xa5);
  data.writeUInt32LE(0x20002000, 0); // stack pointer in SRAM
  data.writeUInt32LE(0x08008101, 4); // reset handler inside the application slot
  return data;
}

function files(bin: Buffer, version = '9.9.9', hardwareId: number = HARDWARE_ID_MAIN) {
  const name = `URTC_MAIN_FIRMWARE_v${version}.bin`;
  const manifest = {
    version,
    sha256: createHash('sha256').update(bin).digest('hex'),
    hmac_sha256: createHash('sha256').update('signature of the test image').digest('hex'),
    component: 'main_application',
    hardware_id: `0x${hardwareId.toString(16).toUpperCase().padStart(8, '0')}`,
    signing_key_kind: 'development',
  };
  return [
    { name, mimeType: 'application/octet-stream', buffer: bin },
    { name: `${name}.manifest.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(manifest)) },
  ];
}

async function openFlasherWith(page: Page, bin: Buffer, version?: string, hardwareId?: number) {
  page.on('dialog', (dialog) => { void dialog.accept(); }); // the page asks window.confirm before it flashes
  await page.goto('/');
  await connectBoard(page);
  await openTab(page, 'flasher');
  await page.locator('input[type="file"][accept=".bin,.json"]').setInputFiles(files(bin, version, hardwareId));
}

test.describe('Flasher Studio', () => {
  test('updates the main board through the modelled bootloader', async ({ page }) => {
    await installFakeBoard(page, { bootloader: true });
    await openFlasherWith(page, image(2 * FLASH_PAGE_SIZE + 100));
    await expect(page.getByText('Manifest selected: URTC_MAIN_FIRMWARE_v9.9.9.bin.manifest.json')).toBeVisible();
    await page.getByRole('button', { name: /START CAN-OTA UPDATE \(main/ }).click();
    await expect(page.getByText('Update SUCCESS.')).toBeVisible({ timeout: 45_000 });
  });

  test('says why when the bootloader refuses the image at the end', async ({ page }) => {
    await installFakeBoard(page, { bootloader: true, finalStatus: 0x05 });
    await openFlasherWith(page, image(FLASH_PAGE_SIZE + 8));
    await page.getByRole('button', { name: /START CAN-OTA UPDATE \(main/ }).click();
    await expect(page.getByText(/Update verification FAILED/)).toBeVisible({ timeout: 45_000 });
  });

  test('refuses an image that is not an application of this board before sending anything', async ({ page }) => {
    await installFakeBoard(page, { bootloader: true });
    const bad = image(2048);
    bad.writeUInt32LE(0x00000000, 0); // no stack pointer
    await openFlasherWith(page, bad);
    await page.getByRole('button', { name: /START CAN-OTA UPDATE \(main/ }).click();
    await expect(page.getByText(/not a valid initial stack pointer/)).toBeVisible();
    await expect(page.getByText('Update SUCCESS.')).toHaveCount(0);
  });

  test('refuses a manifest of the other board', async ({ page }) => {
    await installFakeBoard(page, { bootloader: true });
    await openFlasherWith(page, image(2048), '9.9.9', 0x12345678);
    await page.getByRole('button', { name: /START CAN-OTA UPDATE \(main/ }).click();
    await expect(page.getByText('Update SUCCESS.')).toHaveCount(0);
    await expect(page.getByText(/it declares 0x12345678/)).toBeVisible();
  });
});
