import { expect, test } from '@playwright/test';
import { TABS, collectErrors, openTab } from './support/studio';

test.describe('the built Studio', () => {
  test('opens, shows the title and every tab without an error', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle('URTC Web Studio');
    await expect(page.getByRole('heading', { name: 'URTC Web Studio' })).toBeVisible();
    await expect(page.locator('nav button')).toHaveCount(TABS.length);
    for (const tab of TABS) {
      await openTab(page, tab);
      await expect(page.locator('main')).not.toContainText('Loading...');
    }
    expect(errors).toEqual([]);
  });

  test('breaks no rule of its own content security policy', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/content security policy|refused to/i.test(message.text())) violations.push(message.text());
    });
    await page.goto('/');
    for (const tab of TABS) await openTab(page, tab);
    expect(violations).toEqual([]);
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("worker-src 'self'");
  });

  test('changes language from the header and remembers it after a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Connect Hardware' })).toBeVisible();
    await page.locator('header select').selectOption('es');
    await expect(page.getByRole('button', { name: 'Conectar Hardware' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Conectar Hardware' })).toBeVisible();
    await page.locator('header select').selectOption('pt');
    await expect(page.getByRole('button', { name: 'Ligar Hardware' })).toBeVisible();
  });

  test('offers the eight languages', async ({ page }) => {
    await page.goto('/');
    const values = await page.locator('header select option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).sort());
    expect(values).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja', 'pt', 'zh']);
  });

  test('says up front that the simulator tabs send nothing to the bus', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Simulator: this tab models a board and sends nothing to the bus/)).toBeVisible();
  });
});
