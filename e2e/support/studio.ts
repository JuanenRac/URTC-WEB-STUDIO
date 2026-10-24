import { expect, type Page } from '@playwright/test';

/** The buttons of the side navigation, in the order the page lists them. */
export const TABS = ['control', 'oled', 'can', 'flasher', 'thermal', 'specs', 'tester'] as const;
export type TabName = (typeof TABS)[number];

export async function openTab(page: Page, tab: TabName): Promise<void> {
  await page.locator('nav button').nth(TABS.indexOf(tab)).click();
}

/** Connects the (modelled) adapter from the header and waits until the page says it is connected. */
export async function connectBoard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect Hardware' }).click();
  await expect(page.getByRole('button', { name: /USB-CAN Adapter \(500 kbit\/s\)/ })).toBeVisible();
}

/** Opens a sub-tab of the Tester Studio by its visible name. */
export async function openTesterPanel(page: Page, name: string | RegExp): Promise<void> {
  await openTab(page, 'tester');
  await page.getByRole('button', { name }).first().click();
}

/** Records every console error and uncaught error of the page, to be checked at the end of a test. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}
