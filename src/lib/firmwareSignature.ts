import { FirmwareManifest, computeHmacSha256, computeSha256Hex } from './flasher';

// Decides which HMAC-SHA256 signature goes to the bootloader for an image,
// mirroring URTC-FLASHER's own rules (see URTC docs/FIRMWARE_SIGNING.TXT):
//
//  1. a manifest sha256 that does not match the file -> refuse (wrong or
//     corrupted download, or a manifest for a different build);
//  2. a published hmac_sha256 -> send it as is (the normal path - this app
//     never needs the key);
//  3. no published signature -> only possible with a key the user typed in
//     for this one flash (a self-built image on a bench board); otherwise
//     refuse rather than send something the bootloader is bound to reject.

export class SignatureError extends Error {}

export interface ResolvedSignature {
  signature: Uint8Array;
  source: 'manifest' | 'runtime-key';
  keyKind?: string;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^([0-9a-f]{2})+$/.test(clean)) throw new SignatureError('not a hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function parseSigningKey(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '').replace(/[\s,]/g, '');
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new SignatureError('a signing key is exactly 64 hex characters (32 bytes)');
  return hexToBytes(clean) as Uint8Array<ArrayBuffer>;
}

export async function resolveSignature(
  data: Uint8Array,
  manifest: FirmwareManifest | null,
  runtimeKeyHex?: string | null
): Promise<ResolvedSignature> {
  const buffer = data.slice().buffer as ArrayBuffer;
  if (manifest?.sha256) {
    const actual = await computeSha256Hex(buffer);
    if (actual !== manifest.sha256) {
      throw new SignatureError(`sha256 of the selected file (${actual}) does not match its manifest (${manifest.sha256})`);
    }
  }
  if (manifest?.hmacSha256) {
    return { signature: hexToBytes(manifest.hmacSha256), source: 'manifest', keyKind: manifest.signingKeyKind };
  }
  if (runtimeKeyHex && runtimeKeyHex.trim()) {
    const key = parseSigningKey(runtimeKeyHex);
    return { signature: await computeHmacSha256(buffer, key), source: 'runtime-key' };
  }
  throw new SignatureError('this image has no published signature (hmac_sha256 in <file>.manifest.json) and no signing key was entered');
}
