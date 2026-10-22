// URTC-WEB-STUDIO - release signature check in the browser
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
//
// Every file of an official URTC release has a detached Ed25519 signature (<file>.sig, 128 hexadecimal digits) of the text
//   urtc-rel/1|<file name>|<sha256 of the file in lowercase hexadecimal>
// made with the key of the releases. This checks it with the browser's own Web Crypto, so a page that fetches an image
// (the bundled one or one from a GitHub release) knows the maintainer published it before anything is sent to a board.
// It is a layer in front of the signature the bootloader checks; it never replaces it.

import { computeSha256Hex } from './flasher';

/** The public key of the releases (Ed25519, 32 bytes in hexadecimal); the same one pinned in scripts/sync-firmware.mjs. */
export const RELEASE_PUBLIC_KEY_HEX = '4020c46d76c8ebacb64c5c7b9f3e7c62475afeb133d7421591988174e0f5dc90';

/** 'signed' (the signature is valid), 'unsigned' (there is no signature file), 'invalid' (wrong, malformed or made by another key) or 'unavailable' (this browser cannot check Ed25519). */
export type ReleaseSignatureState = 'signed' | 'unsigned' | 'invalid' | 'unavailable';

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** The text that is signed for a file. */
export function signedMessage(fileName: string, sha256Hex: string): string {
  return `urtc-rel/1|${fileName}|${sha256Hex.toLowerCase()}`;
}

/**
 * Checks `signatureText` (the content of <file>.sig, or null when the release has none) for the file `fileName` whose bytes are `data`.
 * The file name is the one the release published, because it carries the component and the version.
 */
export async function checkReleaseSignature(
  fileName: string,
  data: Uint8Array,
  signatureText: string | null,
  publicKeyHex: string = RELEASE_PUBLIC_KEY_HEX,
): Promise<ReleaseSignatureState> {
  if (signatureText === null) return 'unsigned';
  const text = signatureText.trim();
  if (!/^[0-9a-f]{128}$/i.test(text)) return 'invalid';
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return 'unavailable';
  let key: CryptoKey;
  try {
    key = await subtle.importKey('raw', hexToBytes(publicKeyHex), { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return 'unavailable'; // a browser without Ed25519 in Web Crypto
  }
  const digest = await computeSha256Hex(data.slice().buffer as ArrayBuffer);
  const message = new TextEncoder().encode(signedMessage(fileName, digest));
  try {
    return (await subtle.verify({ name: 'Ed25519' }, key, hexToBytes(text), message)) ? 'signed' : 'invalid';
  } catch {
    return 'invalid';
  }
}
