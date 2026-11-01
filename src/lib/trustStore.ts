// The trust store of public keys: the keys whose signatures of evidence records the person trusts, by alias. It is written one per line as `alias=<public key>`
// (64 hexadecimal digits) and kept in this browser only. It holds PUBLIC keys only: a line that is not a public key is left out and counted, never kept, and the
// store is never uploaded. The rules are the ones of the common code (record_signing.trust_store_from_config), so a store means the same in every program.
// No React here.

export const TRUST_STORAGE_NAME = 'urtc.trustedKeys';
/** Most lines read; the rest are counted as not read. */
export const TRUST_LINE_LIMIT = 200;
const ALIAS = /^[A-Za-z0-9][A-Za-z0-9 ._@-]{0,39}$/;
const PUBLIC_KEY = /^[0-9a-fA-F]{64}$/;

export type TrustStore = Record<string, string>;

export interface TrustParse {
  store: TrustStore;
  /** Lines (not blank, not comments) that were left out: no `=`, an alias that is not allowed, a key that is not 64 hexadecimal digits, or too many lines. */
  problems: number;
}

/** Reads the text of the store. Blank lines and lines starting with `#` are skipped; the keys are kept in lower case; a later line with the same alias replaces the earlier. */
export function parseTrustStore(text: string): TrustParse {
  const store: TrustStore = Object.create(null) as TrustStore;
  let problems = 0;
  const lines = text.split(/\r?\n/);
  let read = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (read++ >= TRUST_LINE_LIMIT) { problems++; continue; }
    const cut = line.indexOf('=');
    const alias = cut < 0 ? '' : line.slice(0, cut).trim();
    const key = cut < 0 ? '' : line.slice(cut + 1).trim();
    if (!ALIAS.test(alias) || !PUBLIC_KEY.test(key)) { problems++; continue; }
    store[alias] = key.toLowerCase();
  }
  return { store, problems };
}

/** The text of a store, one `alias=key` line each, in the order of the aliases. */
export function formatTrustStore(store: TrustStore): string {
  return Object.keys(store).sort().map(alias => `${alias}=${store[alias]}`).join('\n');
}

/** The alias (first in alphabetical order) of the trusted key `publicKey`, or an empty text. */
export function aliasOfKey(store: TrustStore, publicKey: string): string {
  const wanted = publicKey.toLowerCase();
  for (const alias of Object.keys(store).sort()) if (store[alias] === wanted) return alias;
  return '';
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): KeyStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** The text saved in this browser, or an empty text (storage missing, blocked or empty: the page works without it). */
export function loadTrustText(store: KeyStore | null = defaultStore()): string {
  try { return store?.getItem(TRUST_STORAGE_NAME) ?? ''; } catch { return ''; }
}

/** Saves the text; false when the browser would not (private window, blocked data). */
export function saveTrustText(text: string, store: KeyStore | null = defaultStore()): boolean {
  try { if (!store) return false; store.setItem(TRUST_STORAGE_NAME, text); return true; } catch { return false; }
}

// --- the list as a file, to carry it to another computer ---

export const TRUST_FILE_FORMAT = 'urtc-trusted-keys/1';
/** A file bigger than this is not read. */
export const TRUST_FILE_MAX_BYTES = 64 * 1024;

export type TrustImportRefusal = 'too_big' | 'not_json' | 'wrong_format' | 'bad_entry' | 'too_many' | 'empty';
export type TrustImport = { ok: true; store: TrustStore } | { ok: false; reason: TrustImportRefusal; detail: number };

/** The list as the text of a file: `{ "format": "urtc-trusted-keys/1", "keys": { alias: public key } }`, the aliases in order. Public keys only. */
export function exportTrustFile(store: TrustStore): string {
  const keys: TrustStore = {};
  for (const alias of Object.keys(store).sort()) keys[alias] = store[alias];
  return JSON.stringify({ format: TRUST_FILE_FORMAT, keys }, null, 2) + '\n';
}

/**
 * Reads a file of trusted keys, strictly: it is taken whole or not at all. Anything else than the format name and the `keys` object, an alias that is not allowed,
 * a key that is not 64 hexadecimal digits, a value that is not a text, more than TRUST_LINE_LIMIT keys, an empty list or a file that is too big or not JSON is
 * refused, and `detail` says how many entries were wrong (or the limit). Nothing partial is ever returned, so a half-wrong file cannot slip a key in.
 */
export function importTrustFile(text: string): TrustImport {
  if (text.length > TRUST_FILE_MAX_BYTES) return { ok: false, reason: 'too_big', detail: 0 };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, reason: 'not_json', detail: 0 }; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'wrong_format', detail: 0 };
  const doc = parsed as Record<string, unknown>;
  const extra = Object.keys(doc).filter(key => key !== 'format' && key !== 'keys');
  if (doc.format !== TRUST_FILE_FORMAT || extra.length > 0 || doc.keys === null || typeof doc.keys !== 'object' || Array.isArray(doc.keys)) {
    return { ok: false, reason: 'wrong_format', detail: extra.length };
  }
  const entries = Object.entries(doc.keys as Record<string, unknown>);
  if (entries.length === 0) return { ok: false, reason: 'empty', detail: 0 };
  if (entries.length > TRUST_LINE_LIMIT) return { ok: false, reason: 'too_many', detail: TRUST_LINE_LIMIT };
  const store: TrustStore = Object.create(null) as TrustStore;
  let bad = 0;
  for (const [alias, key] of entries) {
    if (!ALIAS.test(alias) || typeof key !== 'string' || !PUBLIC_KEY.test(key)) { bad++; continue; }
    store[alias] = key.toLowerCase();
  }
  if (bad > 0) return { ok: false, reason: 'bad_entry', detail: bad };
  return { ok: true, store };
}

/** The list with the imported keys added; an imported alias replaces the same alias already there. */
export function mergeTrustStore(current: TrustStore, imported: TrustStore): TrustStore {
  const merged: TrustStore = Object.create(null) as TrustStore;
  for (const alias of Object.keys(current)) merged[alias] = current[alias];
  for (const alias of Object.keys(imported)) merged[alias] = imported[alias];
  return merged;
}
