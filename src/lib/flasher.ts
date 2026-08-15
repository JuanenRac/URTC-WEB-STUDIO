import CRC32 from 'crc-32';
import { CanFrame } from '../types';

// Real CSPRNG-generated keys (2026-08-15), matching bootloader_crypto.c
// (master) and slaveboot_crypto.c (slave) in the URTC firmware repo -
// deliberately different from each other (see slaveboot_common.h's own
// comment on why: a master-signed image must never verify against the
// slave's key, or vice versa). Committed to a public repo, so treat
// these as non-confidential functional defaults, not a real security
// boundary - see bootloader_crypto.c's own comment for the full
// reasoning on rotating them for real production use.
export const HMAC_KEY = new Uint8Array([
  0x25, 0x26, 0xCC, 0x3E, 0x90, 0x11, 0xEC, 0x7C,
  0x49, 0xEC, 0xD2, 0xD2, 0xB7, 0xF3, 0x89, 0xE3,
  0x59, 0xAA, 0x24, 0x60, 0x14, 0xFF, 0x51, 0x54,
  0xA0, 0xAF, 0x8A, 0x3C, 0x3B, 0xF9, 0x55, 0x81
]);
export const SLAVE_HMAC_KEY = new Uint8Array([
  0xF6, 0xFC, 0x5E, 0xC3, 0xC7, 0xC0, 0xB8, 0x32,
  0x5F, 0x08, 0x83, 0x85, 0xCD, 0x10, 0x9E, 0x63,
  0x7D, 0x45, 0x58, 0xD4, 0x53, 0x5F, 0x61, 0x9C,
  0xD0, 0x6F, 0x3D, 0xF2, 0xAF, 0xDC, 0x38, 0x1D
]);
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

export async function computeHmacSha256(data: ArrayBuffer, signingKey: Uint8Array<ArrayBuffer> = HMAC_KEY): Promise<Uint8Array> {
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
}

// Mirrors URTCFlasher._check_manifest from the Python flasher: a <file>.manifest.json
// sidecar is optional. Its "version" field (if parseable as "major.minor") takes
// priority over the tool's own compiled FIRMWARE_VERSION_MAJOR/MINOR when reporting
// what's being installed in the END_UPDATE payload - this matters specifically for a
// deliberate downgrade, so the bootloader's anti-rollback check sees the file's real,
// older version rather than whatever this tool would otherwise claim as "current".
// The sha256 field, if present, is only a non-blocking early sanity warning - the
// bootloader's own CRC32+HMAC check during the real transfer remains the sole
// authoritative gate either way.
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
  return manifest;
}
