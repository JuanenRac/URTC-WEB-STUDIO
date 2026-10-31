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
    await expect(page.locator('[data-testid="trace-grid"] tbody tr')).toHaveCount(5);
    await expect(page.getByTestId('trace-viewer')).toContainText('5 frames, 2 refused');
    await expect(page.getByTestId('trace-viewer')).toContainText('1 lines were not valid frames and were skipped');
    await expect(page.locator('[data-testid="trace-grid"] tbody tr').nth(0)).toContainText('set_free_tool');
    await expect(page.locator('[data-testid="trace-grid"] tbody tr').nth(3)).toContainText('status');

    // the text of the file is shown as text, never run
    expect(await page.locator('a[href*="example.invalid"]').count()).toBe(0);

    await page.getByTestId('trace-viewer').locator('select').nth(2).selectOption('refused');
    await expect(page.locator('[data-testid="trace-grid"] tbody tr')).toHaveCount(2);

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
    await expect(page.locator('[data-testid="trace-grid"] tbody tr')).toHaveCount(0);
  });

  test('draws only the rows in view of a long trace and moves through it with the keyboard', async ({ page }) => {
    const errors = collectErrors(page);
    const frames = Array.from({ length: 30000 }, (_, i) => `${String(i + 1).padStart(7)})${(i * 2).toFixed(1).padStart(12)}  Rx  0110  0`);
    await page.goto('/');
    await openTesterPanel(page, 'CAN Traces');
    await page.locator('[data-testid="trace-viewer"] input[type="file"]').setInputFiles({ name: 'long.trc', mimeType: 'text/plain', buffer: Buffer.from(frames.join(String.fromCharCode(13, 10))) });
    const grid = page.getByTestId('trace-grid');
    await expect(grid).toHaveAttribute('aria-rowcount', '30001');
    const drawn = await grid.locator('tbody tr[role="row"]').count();
    expect(drawn).toBeGreaterThan(5);
    expect(drawn).toBeLessThan(80);

    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await expect(grid.locator('tr[aria-selected="true"]')).toContainText('0x110');
    await expect(page.getByRole('status')).toContainText('Row 1 of 30000');
    await page.keyboard.press('End');
    await expect(page.getByRole('status')).toContainText('Row 30000 of 30000');
    await expect(grid.locator('tr[aria-selected="true"]')).toHaveAttribute('aria-rowindex', '30001');
    expect(await grid.locator('tbody tr[role="row"]').count()).toBeLessThan(80);
    await page.keyboard.press('Home');
    await expect(page.getByRole('status')).toContainText('Row 1 of 30000');
    expect(errors).toEqual([]);
  });

  test('reads a candump log and lists what it cannot read', async ({ page }) => {
    await page.goto('/');
    await openTesterPanel(page, 'CAN Traces');
    const log = ['(1436509052.250000) can0 1A2#06', '(1436509052.260000) can0 1A3#1F06', '(1436509052.300000) can0 110#R', '(1436509052.750000) can0 7F5#0502', ''].join(String.fromCharCode(10));
    await page.locator('[data-testid="trace-viewer"] input[type="file"]').setInputFiles({ name: 'bench.log', mimeType: 'text/plain', buffer: Buffer.from(log) });
    await expect(page.locator('[data-testid="trace-grid"] tbody tr')).toHaveCount(3);
    await expect(page.getByTestId('trace-viewer')).toContainText('Format read: candump');
    await expect(page.getByTestId('trace-viewer')).toContainText('1 lines were not valid frames and were skipped');
  });
});
