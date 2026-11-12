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
  await expect(page.getByRole('button', { name: /USB-CAN Adapter \(1 Mbit\/s\)/ })).toBeVisible();
}

/** Opens a sub-tab of the Tester Studio by its visible name. */
export async function openTesterPanel(page: Page, name: string | RegExp): Promise<void> {
  await openTab(page, 'tester');
  await page.getByRole('button', { name }).first().click();
}

/**
 * Answers the requests that the page makes to the GitHub API itself (the newest release of the firmware), so that a check of the built page does not depend on
 * the network or on the rate limit of the machine that runs it (an unauthenticated runner is answered 403 now and then, which the browser logs as an error).
 */
export async function mockGithubApi(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ tag_name: 'v0.0.0', assets: [] }),
  }));
}

/** Records every console error and uncaught error of the page, to be checked at the end of a test. */
export function collectErrors(page: Page): string[] {
  void mockGithubApi(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}
