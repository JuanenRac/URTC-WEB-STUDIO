import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  allowUnsignedDefault, configFlag, loadAllowUnsigned, loadRealSend, loadRequireSignature, realSendDefault, requireSignatureDefault, saveAllowUnsigned, saveRealSend, saveRequireSignature, signatureRefused, unsignedDecision, signedWithDevKey,
} from './sendSettings';
import controlConfig from './controlConfig.json';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
}

describe('send settings', () => {
  it('ship real sending on and the signature requirement off', () => {
    expect(controlConfig).toMatchObject({ real_send_enabled: true, require_release_signature: false, allow_unsigned_image: false });
    expect(allowUnsignedDefault()).toBe(false);
    expect(allowUnsignedDefault({ allow_unsigned_image: 'true' })).toBe(false);
    expect(allowUnsignedDefault({ allow_unsigned_image: true })).toBe(true);
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
    expect(loadAllowUnsigned(storage)).toBe(false);
    saveAllowUnsigned(storage, true);
    expect(loadAllowUnsigned(storage)).toBe(true);
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
    // the default: no signature and no permission is a refusal; the permission turns it into a confirmation; the requirement wins over the permission
    expect(unsignedDecision('signed', false, false)).toBe('go');
    expect(unsignedDecision('signed', true, true)).toBe('go');
    expect(unsignedDecision('none', false, false)).toBe('refuse_not_allowed');
    expect(unsignedDecision('unchecked', false, false)).toBe('refuse_not_allowed');
    expect(unsignedDecision('none', false, true)).toBe('confirm');
    expect(unsignedDecision('none', true, true)).toBe('refuse_required');
    expect(unsignedDecision('none', true, false)).toBe('refuse_required');
  });
});

describe('an image of the public development key', () => {
  it('is known from the manifest, whatever the letters', () => {
    expect(signedWithDevKey('dev')).toBe(true);
    expect(signedWithDevKey(' DEV ')).toBe(true);
    expect(signedWithDevKey('release')).toBe(false);
    expect(signedWithDevKey(undefined)).toBe(false);
  });

  it('is confirmed before the update starts, also when the signature is the record and not a value of the manifest', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const asked = app.indexOf('if (signedWithDevKey(manifest?.signingKeyKind))');
    expect(asked).toBeGreaterThan(-1);
    expect(app.indexOf("confirm('dev_key')", asked)).toBeGreaterThan(asked);
    expect(app.indexOf('await resolveSignature(', asked)).toBeGreaterThan(asked);
    expect(app.split("confirm('dev_key')").length).toBe(2);
  });
});
