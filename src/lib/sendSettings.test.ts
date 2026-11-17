import { describe, expect, it } from 'vitest';
import {
  configFlag, loadRealSend, loadRequireSignature, realSendDefault, requireSignatureDefault, saveRealSend, saveRequireSignature, signatureRefused,
} from './sendSettings';
import controlConfig from './controlConfig.json';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
}

describe('send settings', () => {
  it('ship real sending on and the signature requirement off', () => {
    expect(controlConfig).toMatchObject({ real_send_enabled: true, require_release_signature: false });
    expect(realSendDefault()).toBe(true);
    expect(requireSignatureDefault()).toBe(false);
  });

  it('take only a real boolean from the file', () => {
    expect(configFlag('yes', true)).toBe(true);
    expect(configFlag(1, false)).toBe(false);
    expect(realSendDefault({ real_send_enabled: false })).toBe(false);
    expect(requireSignatureDefault({ require_release_signature: true })).toBe(true);
    expect(requireSignatureDefault({ require_release_signature: 'true' })).toBe(false);
  });

  it('let the choice kept in the browser win over the file', () => {
    const storage = memory();
    expect(loadRealSend(storage)).toBe(true);
    saveRealSend(storage, false);
    expect(loadRealSend(storage)).toBe(false);
    saveRequireSignature(storage, true);
    expect(loadRequireSignature(storage)).toBe(true);
    expect(loadRequireSignature(memory({ 'urtc-web-studio-require-release-signature': 'x' }))).toBe(false);
  });

  it('fall back to the default when the storage fails', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadRealSend(broken)).toBe(true);
    expect(() => saveRealSend(broken, false)).not.toThrow();
    expect(loadRequireSignature(undefined)).toBe(false);
  });

  it('refuse an image without a verified signature only when the setting is on', () => {
    expect(signatureRefused('none', true)).toBe(true);
    expect(signatureRefused('unchecked', true)).toBe(true);
    expect(signatureRefused('signed', true)).toBe(false);
    expect(signatureRefused('none', false)).toBe(false);
  });
});
