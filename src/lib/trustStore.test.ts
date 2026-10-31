import { describe, expect, it } from 'vitest';
import { aliasOfKey, formatTrustStore, loadTrustText, parseTrustStore, saveTrustText, TRUST_LINE_LIMIT, TRUST_STORAGE_NAME } from './trustStore';
import { parseEvidenceFile, signatureView } from './evidenceHistory';

const PUB_A = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';   // the public key of RFC 8032 test 1
const PUB_B = '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c';

// The record TEST signed with the key of RFC 8032 test 1 by the common code in Python (record_signing.sign_evidence).
const TEST = {
  format: 'urtc-evidence/1', kind: 'test', outcome: 'fail', timestamp_utc: '2026-02-01T10:00:00+01:00', tool: 'URTC-TESTER', tool_version: '0.4.3',
  subject: { name: 'head-2' }, evidence_sha256: '860ab4ef57b3ee1439a1e8aee9166944a8fdb480fdfac8733e1aa27d8ad11911',
};
const SIGNATURE = {
  algorithm: 'Ed25519', key_id: '21fe31dfa154a261', public_key: PUB_A,
  signature: '431933761ae9a09daae3657c18ee8d628d51fd2a948446a8253af68e80908e06fb70f84291614559887ce4af5ee85c7818230424364ca3344dfa20c23a090101',
};

describe('reading the trust store', () => {
  it('reads alias=key lines, keeps the keys in lower case and skips blank lines and comments', () => {
    const { store, problems } = parseTrustStore('# my keys\n\nAna bench=' + PUB_A.toUpperCase() + '\r\nBea.2 = ' + PUB_B + '\n');
    expect(store).toEqual({ 'Ana bench': PUB_A, 'Bea.2': PUB_B });
    expect(problems).toBe(0);
  });
  it('leaves out and counts what is not an alias and a public key', () => {
    const { store, problems } = parseTrustStore([
      'Good=' + PUB_A, 'no equals sign', '=' + PUB_A, 'Short=' + 'ab'.repeat(31), 'Long=' + 'ab'.repeat(33), 'Text=' + 'zz'.repeat(32), 'A<b>=' + PUB_A, 'Amp & Co=' + PUB_A,
      'x'.repeat(41) + '=' + PUB_A,
    ].join('\n'));
    expect(Object.keys(store)).toEqual(['Good']);
    expect(problems).toBe(8);
  });
  it('lets a later line replace an earlier one with the same alias', () => {
    expect(parseTrustStore('Ana=' + PUB_A + '\nAna=' + PUB_B).store).toEqual({ Ana: PUB_B });
  });
  it('is not tripped by names that are properties of every object', () => {
    const { store } = parseTrustStore('__proto__=' + PUB_A + '\nconstructor=' + PUB_B);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(store)).toContain('constructor');
    expect(aliasOfKey(store, PUB_B)).toBe('constructor');
  });
  it('reads a limited number of lines and counts the rest', () => {
    const lines = Array.from({ length: TRUST_LINE_LIMIT + 5 }, (_, i) => 'K' + i + '=' + PUB_A).join('\n');
    const { store, problems } = parseTrustStore(lines);
    expect(Object.keys(store)).toHaveLength(TRUST_LINE_LIMIT);
    expect(problems).toBe(5);
  });
  it('writes the store back as sorted lines that read the same', () => {
    const { store } = parseTrustStore('Zed=' + PUB_B + '\nAbe=' + PUB_A);
    expect(formatTrustStore(store)).toBe('Abe=' + PUB_A + '\nZed=' + PUB_B);
    expect(parseTrustStore(formatTrustStore(store)).store).toEqual(store);
  });
  it('names the first alias in order when two aliases name one key', () => {
    expect(aliasOfKey(parseTrustStore('Zed=' + PUB_A + '\nAbe=' + PUB_A).store, PUB_A.toUpperCase())).toBe('Abe');
    expect(aliasOfKey({}, PUB_A)).toBe('');
  });
});

describe('keeping the store in the browser', () => {
  it('saves and loads the text, and works without storage', () => {
    const data: Record<string, string> = {};
    const fake = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
    expect(loadTrustText(fake)).toBe('');
    expect(saveTrustText('Ana=' + PUB_A, fake)).toBe(true);
    expect(data[TRUST_STORAGE_NAME]).toBe('Ana=' + PUB_A);
    expect(loadTrustText(fake)).toBe('Ana=' + PUB_A);
    expect(loadTrustText(null)).toBe('');
    expect(saveTrustText('x', null)).toBe(false);
  });
  it('survives a storage that throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadTrustText(broken)).toBe('');
    expect(saveTrustText('x', broken)).toBe(false);
  });
});

describe('the state of a signature against the store', () => {
  const entryOf = async (record: object) => (await parseEvidenceFile('t.json', JSON.stringify(record)))[0];

  it('is the state of the entry when there is no store', async () => {
    const entry = await entryOf({ ...TEST, signature: SIGNATURE });
    expect(signatureView(entry)).toEqual({ state: 'valid', alias: '' });
    expect(signatureView(entry, {})).toEqual({ state: 'valid', alias: '' });
  });
  it('says trusted with the alias when the key is in the store', async () => {
    const entry = await entryOf({ ...TEST, signature: SIGNATURE });
    expect(signatureView(entry, { Ana: PUB_A })).toEqual({ state: 'trusted', alias: 'Ana' });
  });
  it('says unknown key when the signature is good and the key is not in the store', async () => {
    const entry = await entryOf({ ...TEST, signature: SIGNATURE });
    expect(signatureView(entry, { Bea: PUB_B })).toEqual({ state: 'unknown_key', alias: '' });
  });
  it('never changes a signature that fails, a record that is not signed or one that fails its own check', async () => {
    const store = { Ana: PUB_A };
    const forged = await entryOf({ ...TEST, outcome: 'pass', signature: SIGNATURE });
    expect(forged.valid).toBe(false);
    expect(signatureView(forged, store).state).toBe('invalid');
    const unsigned = await entryOf(TEST);
    expect(signatureView(unsigned, store).state).toBe('unsigned');
    const otherRecord = await entryOf({ ...TEST, detail: 'another record with the same signature', evidence_sha256: '0'.repeat(64), signature: SIGNATURE });
    expect(signatureView(otherRecord, store).state).toBe('invalid');
  });
});
