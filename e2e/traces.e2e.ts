import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { collectErrors, openTesterPanel } from './support/studio';

// The trace viewer: a recorded trace is read in the page, its frames are named with the specification, and the selection is saved as CSV and JSON. No board is needed.

const TRACE = [
  ';$FILEVERSION=1.1',
  ';',
  '      1)         0.0  Tx  01A2  1  06',
  '      2)        10.0  Rx  01A3  2  1F 06',
  '      3)        20.0  Rx  01A3  2  1F 00',
  '      4)        30.0  Rx  07F5  2  05 02',
  '      5)      3000.0  Rx  0110  0',
  '=HYPERLINK("http://example.invalid")',
  '',
].join('\r\n');

test.describe('the viewer of CAN traces', () => {
  test('names the frames, marks the refusals, filters them and saves the selection', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await openTesterPanel(page, 'CAN Traces');
    await expect(page.getByTestId('trace-viewer')).toContainText('No frames loaded');

    await page.locator('[data-testid="trace-viewer"] input[type="file"]').setInputFiles({ name: 'bench.trc', mimeType: 'text/plain', buffer: Buffer.from(TRACE) });
    await expect(page.locator('table tbody tr')).toHaveCount(5);
    await expect(page.getByTestId('trace-viewer')).toContainText('5 frames, 2 refused');
    await expect(page.getByTestId('trace-viewer')).toContainText('1 lines were not valid frames and were skipped');
    await expect(page.locator('table tbody tr').nth(0)).toContainText('set_free_tool');
    await expect(page.locator('table tbody tr').nth(3)).toContainText('status');

    // the text of the file is shown as text, never run
    expect(await page.locator('a[href*="example.invalid"]').count()).toBe(0);

    await page.getByTestId('trace-viewer').locator('select').nth(2).selectOption('refused');
    await expect(page.locator('table tbody tr')).toHaveCount(2);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download the selection (CSV)' }).click();
    const csv = await readFile((await (await download).path()) ?? '', 'utf8');
    const lines = csv.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('0x1A3');
    expect(lines[2]).toContain('0x7F5');

    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download the selection (JSON)' }).click();
    const json = JSON.parse(await readFile((await (await jsonDownload).path()) ?? '', 'utf8'));
    expect(json).toMatchObject({ format: 'urtc-trace-view/1', source: 'bench.trc', frames: 2 });

    expect(errors).toEqual([]);
  });

  test('does not read a file over the size limit', async ({ page }) => {
    await page.goto('/');
    await openTesterPanel(page, 'CAN Traces');
    await page.locator('[data-testid="trace-viewer"] input[type="file"]').setInputFiles({ name: 'huge.trc', mimeType: 'text/plain', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 32) });
    await expect(page.getByTestId('trace-viewer').getByRole('alert')).toContainText('huge.trc is bigger than 5 MB and was not read.');
    await expect(page.locator('table tbody tr')).toHaveCount(0);
  });
});
