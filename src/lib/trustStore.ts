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
