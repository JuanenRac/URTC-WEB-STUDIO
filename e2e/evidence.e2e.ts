import { expect, test } from '@playwright/test';
import { collectErrors, openTesterPanel } from './support/studio';

// The Evidence tab: a record signed in Python (record_signing.sign_evidence, RFC 8032 test 1 key) is checked in the page, and the trusted keys the person lists
// (kept in this browser only) change what the list says about the signature.

const PUBLIC = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
const SIGNED = {
  format: 'urtc-evidence/1', kind: 'test', outcome: 'fail', timestamp_utc: '2026-02-01T10:00:00+01:00', tool: 'URTC-TESTER', tool_version: '0.4.3',
  subject: { name: 'head-2' }, evidence_sha256: '860ab4ef57b3ee1439a1e8aee9166944a8fdb480fdfac8733e1aa27d8ad11911',
  signature: {
    algorithm: 'Ed25519', key_id: '21fe31dfa154a261', public_key: PUBLIC,
    signature: '431933761ae9a09daae3657c18ee8d628d51fd2a948446a8253af68e80908e06fb70f84291614559887ce4af5ee85c7818230424364ca3344dfa20c23a090101',
  },
};

test.describe('the evidence history with the trusted keys', () => {
  test('says who signed, keeps the list in the browser and ignores what is not a public key', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await openTesterPanel(page, 'Evidence');
    const file = { name: 'signed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(SIGNED)) };
    await page.locator('input[type="file"]').setInputFiles(file);
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('signed, signature matches');

    await page.getByTestId('evidence-trust').locator('summary').click();
    const box = page.getByTestId('evidence-trust').locator('textarea');
    await box.fill('Bea=3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c');
    await expect(rows.first()).toContainText('valid signature, unknown key');

    await box.fill('Ana=' + PUBLIC + '\nnot a key line\nBad=' + 'ab'.repeat(31));
    await expect(rows.first()).toContainText('signed by Ana');
    await expect(page.getByTestId('evidence-trust').getByRole('alert')).toContainText('2 line(s) were not read');

    // the list is kept in this browser, and only the lines that read as a public key
    await page.reload();
    await openTesterPanel(page, 'Evidence');
    await page.getByTestId('evidence-trust').locator('summary').click();
    await expect(page.getByTestId('evidence-trust').locator('textarea')).toHaveValue('Ana=' + PUBLIC);
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.locator('table tbody tr').first()).toContainText('signed by Ana');
    expect(errors).toEqual([]);
  });
});
