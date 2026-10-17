import CRC32 from 'crc-32';
import { CanFrame } from '../types';

// No signing key lives in this app any more. The bootloaders authenticate an
// image with HMAC-SHA256, and whoever computes that HMAC must hold the key -
// so the URTC build computes it (firmware_signing.py) and publishes it next
// to each application image as "hmac_sha256" in <bin>.manifest.json. This
// app only TRANSPORTS that published signature (see firmwareSignature.ts).
// The only time it signs anything itself is a self-built image for a bench
// board, with a key the user types in at run time and that is never stored.
// See URTC docs/FIRMWARE_SIGNING.TXT.
export const THIS_HARDWARE_ID = 0x0303CC01;
export const FLASH_PAGE_SIZE = 2048;

export const CAN_ID_ENTER_BOOTLOADER = 0x7F0;
export const CAN_ID_START_UPDATE = 0x7F1;
export const CAN_ID_DATA = 0x7F2;
export const CAN_ID_PAGE_ACK = 0x7F3;
export const CAN_ID_END_UPDATE = 0x7F4;
export const CAN_ID_STATUS = 0x7F5;
export const CAN_ID_HEARTBEAT = 0x7F6;
export const CAN_ID_HMAC_CHUNK = 0x7F7;
export const CAN_ID_QUERY_VERSION = 0x7F8;
export const CAN_ID_VERSION_RESPONSE = 0x7F9;
export const CAN_ID_BOOTLOADER_VERSION_RESPONSE = 0x7FA;
export const CAN_ID_QUERY_ERROR_COUNTERS = 0x7FB;
export const CAN_ID_ERROR_COUNTERS_RESPONSE = 0x7FC;
export const CAN_ID_AUTHORIZE_DOWNGRADE = 0x7FD;
export const CAN_ID_READBACK = 0x7FE; // DLC=4 (size reply) or DLC=8 (data chunk), disambiguated by DLC
export const CAN_ID_READBACK_PAGE_ACK = 0x7FF;
export const AUTHORIZE_DOWNGRADE_MAGIC = [0xD0, 0x9E, 0x12, 0xAD];
export const ENTER_BOOTLOADER_MAGIC = [0xB0, 0x07, 0x1D, 0x5A];
export const FIRMWARE_VERSION_MAJOR = 1;
export const FIRMWARE_VERSION_MINOR = 1;

// --- Expansion slave (STM32F303CBT6) OTA - relayed through the main board's
// own bit-banged I2C bridge, since the slave has no CAN peripheral of its
// own. No page-ACK or heartbeat equivalent exists on this path - progress is
// polled explicitly (0x216) rather than pushed. See CANBUS.TXT / the URTC
// Flasher's flasher_config.py for the authoritative reference. ---
export const CAN_ID_SLAVE_ENTER_BOOTLOADER = 0x210;
export const CAN_ID_SLAVE_START_UPDATE = 0x211;
export const CAN_ID_SLAVE_HMAC_CHUNK = 0x212;
export const CAN_ID_SLAVE_DATA = 0x213;
export const CAN_ID_SLAVE_END_UPDATE = 0x214;
export const CAN_ID_SLAVE_STATUS = 0x215; // empty payload = query, same ID answers
export const CAN_ID_SLAVE_PROGRESS = 0x216; // empty payload = query, same ID answers
export const CAN_ID_SLAVE_VERSION_RESP_1 = 0x217;
export const CAN_ID_SLAVE_VERSION_RESP_2 = 0x218;
export const CAN_ID_SLAVE_VERIFY_FAIL_REASON = 0x219; // empty payload = query, same ID answers

export const SLAVE_HARDWARE_ID = 0x0303CB01;
export const SLAVE_APP_MAX_SIZE = 54 * 1024;
export const SLAVE_DATA_PACING_MS = 4; // I2C bit-banging is slower per-byte than the main board's direct flash write

export const APP_MAX_SIZE = 112 * 1024;

export async function computeHmacSha256(data: ArrayBuffer, signingKey: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    signingKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(signature);
}

export function packUInt32BE(value: number): number[] {
  return [
    (value >>> 24) & 0xFF,
    (value >>> 16) & 0xFF,
    (value >>> 8) & 0xFF,
    value & 0xFF
  ];
}

export function packUInt16BE(value: number): number[] {
  return [
    (value >>> 8) & 0xFF,
    value & 0xFF
  ];
}

export function getCrc32(data: Uint8Array): number {
  return CRC32.buf(data) >>> 0;
}

export function unpackUInt32BE(bytes: number[] | Uint8Array): number {
  return (((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0);
}

export function unpackUInt16BE(bytes: number[] | Uint8Array): number {
  return ((bytes[0] << 8) | bytes[1]) & 0xFFFF;
}

export async function computeSha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface FirmwareManifest {
  version?: string;
  versionMajor?: number;
  versionMinor?: number;
  buildDate?: string;
  sha256?: string;
  hmacSha256?: string;      // 64 lowercase hex chars - the signature the bootloader expects
  signingKeyKind?: string;  // "release" or "dev" (signed with the PUBLIC development key)
  signingKeyId?: string;
}

// Mirrors URTCFlasher._check_manifest from the Python flasher: a <file>.manifest.json
// sidecar is optional. Its "version" field (if parseable as "major.minor") takes
// priority over the tool's own compiled FIRMWARE_VERSION_MAJOR/MINOR when reporting
// what's being installed in the END_UPDATE payload - this matters specifically for a
// deliberate downgrade, so the bootloader's anti-rollback check sees the file's real,
// older version rather than whatever this tool would otherwise claim as "current".
// The sha256 field, if present, MUST match the selected file (the flash is
// refused otherwise - see resolveSignature), and hmac_sha256 is the signature
// sent to the bootloader.
export function parseManifest(json: any): FirmwareManifest {
  const manifest: FirmwareManifest = {};
  if (typeof json?.version === 'string') {
    const parts = json.version.split('.');
    if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      manifest.version = json.version;
      manifest.versionMajor = parseInt(parts[0], 10);
      manifest.versionMinor = parseInt(parts[1], 10);
    }
  }
  if (typeof json?.build_date === 'string') manifest.buildDate = json.build_date;
  if (typeof json?.sha256 === 'string') manifest.sha256 = json.sha256.trim().toLowerCase().replace(/^0x/, '');
  if (typeof json?.hmac_sha256 === 'string') {
    const hex = json.hmac_sha256.trim().toLowerCase().replace(/^0x/, '');
    if (/^[0-9a-f]{64}$/.test(hex)) manifest.hmacSha256 = hex;
  }
  if (typeof json?.signing_key_kind === 'string') manifest.signingKeyKind = json.signing_key_kind;
  if (typeof json?.signing_key_id === 'string') manifest.signingKeyId = json.signing_key_id;
  return manifest;
}

/**
 * The real bootloader writes (and acknowledges) a page when its buffer is FULL; the last page of an image that is not a whole number of pages is written and acknowledged only when
 * END_UPDATE arrives. Waiting for that acknowledgement before sending END_UPDATE waits for a frame the board sends only after one this tool sends only afterwards.
 */
export function isLastPartialPage(imageSize: number, pageEnd: number, pageSize: number): boolean {
  return pageEnd === imageSize && imageSize % pageSize !== 0;
}

/** How many bytes of a readback data frame belong to the image: a frame of 1 to 8 bytes (the last one is shorter when the size is not a multiple of 8), never more than what is left. */
export function readbackChunkLength(frameLength: number, remaining: number): number {
  if (frameLength < 1 || frameLength > 8) return 0;
  return Math.min(frameLength, remaining);
}
