// A signature on the record of a saved session, made with a key that stays in this browser. The desktop programs sign their records the
// same way (urtc_common/record_signing.py): the message is "urtc-record/1", the kind and the payload on three lines, the signature is Ed25519
// and the block that goes into the record has the algorithm, the key id (the start of the SHA-256 of the public key), the public key and the
// signature in hexadecimal. A signature shows the record was not edited after it was signed; it does not say who holds the key (the key is
// made on first use, nobody vouches for it). The browser makes the signature with WebCrypto, which not every browser has for Ed25519: where
// it is missing the record is saved without a signature. No React here.

export const SIGNATURE_ALGORITHM = 'Ed25519';
export const SESSION_KIND = 'session';
export const KEY_STORAGE_NAME = 'urtc.recordSigningKey';

export interface SignatureBlock {
  algorithm: string;
  key_id: string;
  public_key: string;
  signature: string;
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (text: string): Uint8Array | null => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(text)) return null;
  return Uint8Array.from(text.match(/../g) ?? [], (pair) => parseInt(pair, 16));
};
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function signingMessage(kind: string, payload: string): Uint8Array {
  return new TextEncoder().encode(`urtc-record/1\n${kind}\n${payload}`);
}

/** What a session record signs: the name of the log, its SHA-256 and its size, one per line (as the desktop programs do). */
export function sessionPayload(record: { log_file: unknown; log_sha256: unknown; log_bytes: unknown }): string {
  return `${String(record.log_file)}\n${String(record.log_sha256)}\n${String(record.log_bytes)}`;
}

async function keyId(publicKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', publicKey as BufferSource);
  return toHex(new Uint8Array(digest)).slice(0, 16);
}

/** True when this browser can make and check Ed25519 signatures. */
export async function signingAvailable(): Promise<boolean> {
  try {
    await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    return true;
  } catch {
    return false;
  }
}

function defaultStore(): KeyStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The key pair of this browser as a JSON Web Key: read from the store, or made and kept (null where Ed25519 or the storage is missing). */
export async function loadOrCreateKey(store: KeyStore | null = defaultStore()): Promise<JsonWebKey | null> {
  try {
    const kept = store?.getItem(KEY_STORAGE_NAME);
    if (kept) {
      const parsed = JSON.parse(kept) as JsonWebKey;
      if (parsed.kty === 'OKP' && parsed.crv === 'Ed25519' && parsed.d && parsed.x) return parsed;
    }
    const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    store?.setItem(KEY_STORAGE_NAME, JSON.stringify(jwk));
    return jwk;
  } catch {
    return null;
  }
}

/** The signature block for a payload, or null when the browser cannot sign. */
export async function signPayload(kind: string, payload: string, jwk: JsonWebKey | null): Promise<SignatureBlock | null> {
  if (!jwk?.x) return null;
  try {
    const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, signingMessage(kind, payload) as BufferSource));
    const publicKey = fromBase64Url(jwk.x);
    return { algorithm: SIGNATURE_ALGORITHM, key_id: await keyId(publicKey), public_key: toHex(publicKey), signature: toHex(signature) };
  } catch {
    return null;
  }
}

export type SignatureCheck = { state: 'absent' } | { state: 'valid'; keyId: string } | { state: 'invalid' } | { state: 'unchecked' };

/** Checks the block of a record against its payload. `unchecked` when the browser cannot verify Ed25519 (the record may be fine). */
export async function checkSignature(block: unknown, kind: string, payload: string): Promise<SignatureCheck> {
  if (block === undefined || block === null) return { state: 'absent' };
  if (typeof block !== 'object') return { state: 'invalid' };
  const b = block as Record<string, unknown>;
  if (b.algorithm !== SIGNATURE_ALGORITHM || typeof b.public_key !== 'string' || typeof b.signature !== 'string' || typeof b.key_id !== 'string') return { state: 'invalid' };
  const publicKey = fromHex(b.public_key);
  const signature = fromHex(b.signature);
  if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64) return { state: 'invalid' };
  if ((await keyId(publicKey)) !== b.key_id) return { state: 'invalid' };
  try {
    const key = await crypto.subtle.importKey('raw', publicKey as BufferSource, { name: 'Ed25519' }, false, ['verify']);
    const good = await crypto.subtle.verify({ name: 'Ed25519' }, key, signature as BufferSource, signingMessage(kind, payload) as BufferSource);
    return good ? { state: 'valid', keyId: b.key_id } : { state: 'invalid' };
  } catch {
    return { state: 'unchecked' };
  }
}
