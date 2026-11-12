// =============================================================================
// URTC Web Studio - src/lib/imageHeader.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================

// The header INSIDE a firmware image (32 bytes, big-endian, at the fixed offset 0x200, after the vector table): the TypeScript reading of
// URTC-COMMON's docs/IMAGE_HEADER.md. An image built with the header slot sealed states the hardware it is for, its version, its length
// and its CRC-32 inside the file; a page reads that before it sends a frame. The same cases (conformance/image_header_embedded_vectors.json,
// copied to generated/) are held by the Python reference, the C header and this module.

export const IMAGE_HEADER_MAGIC = 0x55524948; // "URIH"
export const IMAGE_HEADER_SIZE = 32;
export const IMAGE_EMBED_OFFSET = 0x200;
export const FLAG_SIGNED = 0x0001;
export const FLAG_EMBEDDED = 0x0002;

export type HeaderStatus =
  | 'ok' | 'short' | 'bad_magic' | 'bad_version' | 'bad_size' | 'bad_header_crc' | 'bad_length' | 'bad_payload_crc' | 'bad_flags' | 'not_sealed';

export interface ImageHeaderInfo {
  hardwareId: number;
  version: [number, number, number, number];
  flags: number;
  payloadLength: number;
  payloadCrc32: number;
}

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  const out = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    out[n] = c >>> 0;
  }
  crcTable = out;
  return out;
}

/** CRC-32 as zlib computes it, over `data` with the bytes from `zeroFrom` for `zeroLength` taken as zeros. */
export function crc32(data: Uint8Array, zeroFrom = -1, zeroLength = 0): number {
  const t = table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = i >= zeroFrom && i < zeroFrom + zeroLength ? 0 : data[i];
    crc = t[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** The header at the fixed offset and the whole image: it must hold, be sealed, say it is embedded, state the length of the image and its CRC-32. */
export function verifyEmbedded(image: Uint8Array): { status: HeaderStatus; info?: ImageHeaderInfo } {
  if (image.length < IMAGE_EMBED_OFFSET + IMAGE_HEADER_SIZE) return { status: 'short' };
  const view = new DataView(image.buffer, image.byteOffset + IMAGE_EMBED_OFFSET, IMAGE_HEADER_SIZE);
  if (view.getUint32(0, false) !== IMAGE_HEADER_MAGIC) return { status: 'bad_magic' };
  if (view.getUint32(28, false) === 0) return { status: 'not_sealed' };
  if (view.getUint8(4) !== 1) return { status: 'bad_version' };
  if (view.getUint8(5) !== IMAGE_HEADER_SIZE) return { status: 'bad_size' };
  const header = image.subarray(IMAGE_EMBED_OFFSET, IMAGE_EMBED_OFFSET + 28);
  if (view.getUint32(28, false) !== crc32(header)) return { status: 'bad_header_crc' };
  const flags = view.getUint16(6, false);
  if (!(flags & FLAG_EMBEDDED) || flags & FLAG_SIGNED) return { status: 'bad_flags' };
  const payloadLength = view.getUint32(20, false);
  const payloadCrc32 = view.getUint32(24, false);
  if (payloadLength !== image.length) return { status: 'bad_length' };
  if (crc32(image, IMAGE_EMBED_OFFSET, IMAGE_HEADER_SIZE) !== payloadCrc32) return { status: 'bad_payload_crc' };
  const info: ImageHeaderInfo = {
    hardwareId: view.getUint32(8, false),
    version: [view.getUint16(12, false), view.getUint8(14), view.getUint8(15), view.getUint16(16, false)],
    flags,
    payloadLength,
    payloadCrc32,
  };
  return { status: 'ok', info };
}

// ---- what the page does with a file: classify it and apply the compatibility switch -------------------------------------------------------

export type HeaderPolicy = 'accept' | 'warn' | 'require';
export const HEADER_POLICIES: readonly HeaderPolicy[] = ['accept', 'warn', 'require'];
export const DEFAULT_HEADER_POLICY: HeaderPolicy = 'warn';

/** The switch from a setting: a known word, else the strictest one (an unknown value never loosens the check). */
export function parseHeaderPolicy(value: unknown): HeaderPolicy {
  const text = value === null || value === undefined ? '' : String(value).trim().toLowerCase();
  if (text === '') return DEFAULT_HEADER_POLICY;
  return (HEADER_POLICIES as readonly string[]).includes(text) ? (text as HeaderPolicy) : 'require';
}

export type ImageKind = 'embedded' | 'legacy' | 'stamped_file';

export interface ImageCheck {
  accepted: boolean;
  kind: ImageKind;
  /** ok, no_header (accepted with a warning), header_required, stamped_file, wrong_hardware, wrong_version or header_<status> */
  reason: string;
  info?: ImageHeaderInfo;
  warn: boolean;
}

function startsWithMagic(data: Uint8Array, at: number): boolean {
  if (data.length < at + 4) return false;
  return new DataView(data.buffer, data.byteOffset + at, 4).getUint32(0, false) === IMAGE_HEADER_MAGIC;
}

/**
 * The decision for the bytes of a file about to be flashed. A header that is there is always checked and a bad one is always refused; an image without one is
 * accepted or refused by the switch. `hardwareId` (and `version`, three or four components: the first ones are compared) are what the caller expects.
 */
export function inspectImage(
  data: Uint8Array,
  policy: unknown = DEFAULT_HEADER_POLICY,
  hardwareId?: number,
  version?: number[],
): ImageCheck {
  const mode = parseHeaderPolicy(policy);
  if (startsWithMagic(data, 0)) return { accepted: false, kind: 'stamped_file', reason: 'stamped_file', warn: false };
  if (startsWithMagic(data, IMAGE_EMBED_OFFSET)) {
    const { status, info } = verifyEmbedded(data);
    if (status !== 'ok' || !info) return { accepted: false, kind: 'embedded', reason: `header_${status}`, warn: false };
    if (hardwareId !== undefined && info.hardwareId !== hardwareId >>> 0) return { accepted: false, kind: 'embedded', reason: 'wrong_hardware', info, warn: false };
    if (version && version.some((part, index) => info.version[index] !== part)) return { accepted: false, kind: 'embedded', reason: 'wrong_version', info, warn: false };
    return { accepted: true, kind: 'embedded', reason: 'ok', info, warn: false };
  }
  if (mode === 'require') return { accepted: false, kind: 'legacy', reason: 'header_required', warn: false };
  return { accepted: true, kind: 'legacy', reason: mode === 'accept' ? 'ok' : 'no_header', warn: mode === 'warn' };
}

/** The components a file name states ("URTC_MAIN_FIRMWARE_v0.8.1.3.bin": three or four of them), else undefined. */
export function versionPartsFromName(fileName: string): number[] | undefined {
  const m = /_[vV](\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/.exec(fileName);
  if (!m) return undefined;
  return m.slice(1).filter((part) => part !== undefined).map((part) => parseInt(part, 10));
}

export function headerVersionText(info: ImageHeaderInfo): string {
  return info.version.join('.');
}

export function hex32(value: number): string {
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
