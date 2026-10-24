import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { installFakeBoard } from './support/fakeBoard';
import { connectBoard, openTesterPanel } from './support/studio';

// With a board modelled behind the adapter (e2e/support/fakeBoard.ts): the thermal counters over time and the saved session.

test.describe('the thermal counters over time', () => {
  test('draw a chart from the second reading, export it and clear it', async ({ page }) => {
    await installFakeBoard(page, [
      { faults: 0, heaterOnSeconds: 3600, lastFault: 0, persisted: true },
      { faults: 0, heaterOnSeconds: 5400, lastFault: 0, persisted: true },
      { faults: 1, heaterOnSeconds: 7200, lastFault: 2, persisted: true },
    ]);
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Black Box');

    const read = page.getByRole('button', { name: 'Read the thermal counters' });
    await read.click();
    await expect(page.getByTestId('thermal-counters')).toContainText('Heater on: 1.00 h');
    await expect(page.getByText('The chart appears from the second reading.')).toBeVisible();
    await expect(page.getByTestId('thermal-history-chart')).toHaveCount(0);

    await read.click();
    await expect(page.getByTestId('thermal-counters')).toContainText('Heater on: 1.50 h');
    await expect(page.getByTestId('thermal-history-chart')).toBeVisible();
    await expect(page.getByTestId('thermal-history-chart')).toContainText('2 readings');

    await read.click();
    await expect(page.getByTestId('thermal-counters')).toContainText('Thermal runaway faults ever: 1');
    await expect(page.getByTestId('thermal-history-chart')).toContainText('3 readings');
    await expect(page.getByTestId('thermal-history-chart')).toContainText('1 faults added');

    // the history is still there after a reload (the counters are lifetime counters)
    await page.reload();
    await connectBoard(page);
    await openTesterPanel(page, 'Black Box');
    await expect(page.getByTestId('thermal-history-chart')).toContainText('3 readings');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).last().click();
    const file = await (await download).path();
    const csv = (await readFile(file!, 'utf8')).trim().split('\n');
    expect(csv[0]).toBe('time,fault_count,heater_on_seconds,heater_on_hours,last_fault');
    expect(csv).toHaveLength(4);
    expect(csv[3]).toMatch(/,1,7200,2\.0000,2$/);

    await page.getByRole('button', { name: 'Clear the history' }).click();
    await expect(page.getByTestId('thermal-history-chart')).toHaveCount(0);
  });

  test('restart the history when a counter goes down: another board', async ({ page }) => {
    await installFakeBoard(page, [
      { faults: 2, heaterOnSeconds: 36000, lastFault: 1, persisted: true },
      { faults: 0, heaterOnSeconds: 60, lastFault: 0, persisted: true },
      { faults: 0, heaterOnSeconds: 120, lastFault: 0, persisted: true },
    ]);
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Black Box');
    const read = page.getByRole('button', { name: 'Read the thermal counters' });
    await read.click();
    await expect(page.getByTestId('thermal-counters')).toContainText('Heater on: 10.00 h');
    await read.click();
    await expect(page.getByTestId('thermal-counters')).toContainText('Heater on: 0.02 h');
    await expect(page.getByText('The chart appears from the second reading.')).toBeVisible();
    await read.click();
    await expect(page.getByTestId('thermal-history-chart')).toContainText('2 readings');
  });

  test('read again by themselves at the interval the person chose', async ({ page }) => {
    await installFakeBoard(page, [
      { faults: 0, heaterOnSeconds: 10, lastFault: 0, persisted: true },
      { faults: 0, heaterOnSeconds: 20, lastFault: 0, persisted: true },
      { faults: 0, heaterOnSeconds: 30, lastFault: 0, persisted: true },
    ]);
    await page.clock.install();
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Black Box');
    await page.getByTestId('thermal-poll').selectOption('10');
    await page.clock.runFor(10_500);
    await expect(page.getByTestId('thermal-counters')).toContainText('Heater on: 0.00 h');
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('thermal-history-chart')).toContainText('2 readings');
    await page.getByTestId('thermal-poll').selectOption('');
    await page.clock.runFor(60_000);
    await expect(page.getByTestId('thermal-history-chart')).toContainText('2 readings');
  });
});

test.describe('the saved session', () => {
  test('is written with a record that names the log by its SHA-256, and is checked back', async ({ page }) => {
    await installFakeBoard(page);
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Bus Monitor');

    await page.getByRole('button', { name: 'Save the session' }).click();
    await expect(page.getByTestId('session-message')).toHaveText('There are no frames to save yet.');

    // frames on the bus: what the page sends and what the board answers
    await page.getByRole('button', { name: 'Detect Hardware' }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    const downloads: Array<{ name: string; path: string }> = [];
    page.on('download', async (download) => { downloads.push({ name: download.suggestedFilename(), path: (await download.path()) ?? '' }); });
    await page.getByRole('button', { name: 'Save the session' }).click();
    await expect.poll(() => downloads.length).toBe(2);
    const log = downloads.find((d) => d.name.endsWith('.log'))!;
    const record = downloads.find((d) => d.name.endsWith('.json'))!;
    expect(log.name).toMatch(/^urtc_web_session_\d{8}_\d{6}\.log$/);

    const logText = await readFile(log.path, 'utf8');
    const recordBytes = await readFile(record.path);
    const manifest = JSON.parse(recordBytes.toString('utf8'));
    const payload = (name: string, buffer: Buffer) => ({ name, mimeType: name.endsWith('.json') ? 'application/json' : 'text/plain', buffer });
    expect(manifest.log_file).toBe(log.name);
    expect(manifest.log_sha256).toBe(createHash('sha256').update(logText, 'utf8').digest('hex'));
    expect(manifest.log_bytes).toBe(Buffer.byteLength(logText, 'utf8'));
    expect(logText).toMatch(/Tx 0x/);

    const check = page.getByTestId('session-check');
    await check.setInputFiles([payload(record.name, recordBytes), payload(log.name, Buffer.from(logText))]);
    await expect(page.getByTestId('session-message')).toContainText('matches its record');

    await check.setInputFiles([
      payload(record.name, recordBytes),
      payload(log.name, Buffer.from(logText.replace('Tx', 'Rx'))),
    ]);
    await expect(page.getByTestId('session-message')).toContainText('does NOT match its record');

    await check.setInputFiles([payload('a.json', Buffer.from('{}')), payload(log.name, Buffer.from(logText))]);
    await expect(page.getByTestId('session-message')).toContainText('is not a session record that can be read');

    await check.setInputFiles([payload(record.name, recordBytes)]);
    await expect(page.getByTestId('session-message')).toHaveText('Choose the record (.json) and its log together.');
  });
});

test.describe('the filter of the bus monitor', () => {
  test('shows only the chosen IDs', async ({ page }) => {
    await installFakeBoard(page);
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Bus Monitor');
    await page.getByTestId('monitor-ids').fill('111');
    await page.getByRole('button', { name: 'Detect Hardware' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table tbody tr').first()).toContainText('0x111');
    await page.getByTestId('monitor-ids').fill('');
    await page.getByRole('button', { name: 'Detect Hardware' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(5);
  });

  test('shows only the frames whose data changed', async ({ page }) => {
    await installFakeBoard(page);
    await page.goto('/');
    await connectBoard(page);
    await openTesterPanel(page, 'Bus Monitor');
    await page.getByTestId('monitor-changes').check();
    await page.getByRole('button', { name: 'Detect Hardware' }).click();
    await expect(page.locator('table tbody tr')).toHaveCount(4);
    await page.getByRole('button', { name: 'Detect Hardware' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table tbody tr')).toHaveCount(4);
  });
});
