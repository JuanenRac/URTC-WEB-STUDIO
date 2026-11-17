// Two switches of the page, both with a conservative default that keeps what the page did before:
//  - real_send_enabled: the Control tab may put a confirmed frame on the real bus (default on; off keeps the tab as a simulator and nothing reaches the bus).
//  - require_release_signature: an image without a verified release signature is refused instead of only noted in the log (default off, because the images
//    published before the signature existed have none).
// The default comes from controlConfig.json; the person's choice in the page is kept in the browser and wins over the file.

import controlConfig from './controlConfig.json';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const REAL_SEND_STORAGE_KEY = 'urtc-web-studio-real-send-enabled';
export const REQUIRE_SIGNATURE_STORAGE_KEY = 'urtc-web-studio-require-release-signature';

export interface SendConfig { real_send_enabled?: unknown; require_release_signature?: unknown }

/** The switch of the file: only a real boolean counts; anything else is the default. */
export function configFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function realSendDefault(config: SendConfig = controlConfig as SendConfig): boolean {
  return configFlag(config?.real_send_enabled, true);
}

export function requireSignatureDefault(config: SendConfig = controlConfig as SendConfig): boolean {
  return configFlag(config?.require_release_signature, false);
}

function loadFlag(storage: StorageLike | undefined, key: string, fallback: boolean): boolean {
  try {
    const stored = storage?.getItem(key);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* a convenience only */ }
  return fallback;
}

function saveFlag(storage: StorageLike | undefined, key: string, value: boolean): void {
  try { storage?.setItem(key, value ? '1' : '0'); } catch { /* a convenience only */ }
}

export const loadRealSend = (storage?: StorageLike, config?: SendConfig): boolean => loadFlag(storage, REAL_SEND_STORAGE_KEY, realSendDefault(config));
export const saveRealSend = (storage: StorageLike | undefined, value: boolean): void => saveFlag(storage, REAL_SEND_STORAGE_KEY, value);
export const loadRequireSignature = (storage?: StorageLike, config?: SendConfig): boolean => loadFlag(storage, REQUIRE_SIGNATURE_STORAGE_KEY, requireSignatureDefault(config));
export const saveRequireSignature = (storage: StorageLike | undefined, value: boolean): void => saveFlag(storage, REQUIRE_SIGNATURE_STORAGE_KEY, value);

/** True when an image whose signature state is `state` must be refused: the setting is on and the signature was not verified. */
export function signatureRefused(state: string, required: boolean): boolean {
  return required && state !== 'signed';
}
