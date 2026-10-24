import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { openTab } from './support/studio';

// The Studio as an installable page that also opens without a network: the service worker the build writes keeps the page, its
// scripts and the bundled firmware, and the page says so.

test.describe('the offline copy', () => {
  test('links a manifest the browser can install from', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const response = await request.get(new URL(href!, page.url()).href);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: 'URTC Web Studio', display: 'standalone', start_url: './', scope: './' });
    expect(manifest.icons.length).toBeGreaterThan(0);
    const icon = await request.get(new URL(manifest.icons[0].src, new URL(href!, page.url())).href);
    expect(icon.ok()).toBe(true);
  });

  test('stores the page, says so, and opens again with no network', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect(page.getByTestId('pwa-ready')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'URTC Web Studio' })).toBeVisible();
    await expect(page.getByTestId('pwa-offline')).toBeVisible();

    // the tabs that are loaded when first opened come out of the stored copy too
    await openTab(page, 'tester');
    await expect(page.getByRole('heading', { name: 'URTC Tester Studio' })).toBeVisible();
    await openTab(page, 'flasher');
    await expect(page.locator('main')).not.toContainText('Loading...');
  });

  test('keeps the bundled firmware and its signatures for the bench with no internet', async ({ page, context }) => {
    test.skip(!existsSync(join(process.cwd(), 'dist', 'firmware', 'firmware_manifest.json')), 'the firmware of the release was not downloaded for this build');
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    const answers = await page.evaluate(async () => {
      const manifest = await fetch('firmware/firmware_manifest.json');
      const signature = await fetch('firmware/firmware_manifest.json.sig');
      const listed = (await manifest.json()) as { files?: Array<{ name?: string }> } | Record<string, unknown>;
      return { manifest: manifest.ok, signature: signature.ok, listed: Object.keys(listed).length };
    });
    expect(answers.manifest).toBe(true);
    expect(answers.signature).toBe(true);
    expect(answers.listed).toBeGreaterThan(0);
  });

  test('never answers version.json from the stored copy, so a newer Studio is noticed', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    const online = await page.evaluate(async () => (await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' })).ok);
    expect(online).toBe(true);
    await context.setOffline(true);
    const offline = await page.evaluate(async () => fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' }).then(() => 'answered', () => 'failed'));
    expect(offline).toBe('failed');
  });
});
