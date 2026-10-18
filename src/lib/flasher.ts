import CRC32 from 'crc-32';
import { CanFrame } from '../types';
import * as generated from './generated/urtcCanIds';

// No signing key lives in this app any more. The bootloaders authenticate an
// image with HMAC-SHA256, and whoever computes that HMAC must hold the key -
// so the URTC build computes it (firmware_signing.py) and publishes it next
// to each application image as "hmac_sha256" in <bin>.manifest.json. This
// app only TRANSPORTS that published signature (see firmwareSignature.ts).
// The only time it signs anything itself is a self-built image for a bench
// board, with a key the user types in at run time and that is never stored.
// See URTC docs/FIRMWARE_SIGNING.TXT.
export const THIS_HARDWARE_ID = generated.HARDWARE_ID_MAIN;
export const FLASH_PAGE_SIZE = generated.FLASH_PAGE_SIZE;

export const CAN_ID_ENTER_BOOTLOADER = generated.CAN_ID_ENTER_BOOTLOADER;
export const CAN_ID_START_UPDATE = generated.CAN_ID_START_UPDATE;
export const CAN_ID_DATA = generated.CAN_ID_DATA;
export const CAN_ID_PAGE_ACK = generated.CAN_ID_PAGE_ACK;
export const CAN_ID_END_UPDATE = generated.CAN_ID_END_UPDATE;
export const CAN_ID_STATUS = generated.CAN_ID_STATUS;
export const CAN_ID_HEARTBEAT = generated.CAN_ID_HEARTBEAT;
export const CAN_ID_HMAC_CHUNK = generated.CAN_ID_HMAC_CHUNK;
export const CAN_ID_QUERY_VERSION = generated.CAN_ID_QUERY_VERSION;
export const CAN_ID_VERSION_RESPONSE = generated.CAN_ID_VERSION_RESPONSE;
export const CAN_ID_BOOTLOADER_VERSION_RESPONSE = generated.CAN_ID_BOOTLOADER_VERSION_RESPONSE;
export const CAN_ID_VERSION_PATCH_RESPONSE = generated.CAN_ID_VERSION_PATCH_RESPONSE; // DLC 3: side, application patch (0xFF = unknown), flags
export const CAN_ID_QUERY_ERROR_COUNTERS = generated.CAN_ID_QUERY_ERROR_COUNTERS;
export const CAN_ID_ERROR_COUNTERS_RESPONSE = generated.CAN_ID_ERROR_COUNTERS_RESPONSE;
export const CAN_ID_AUTHORIZE_DOWNGRADE = generated.CAN_ID_AUTHORIZE_DOWNGRADE;
export const CAN_ID_READBACK = generated.CAN_ID_READBACK; // DLC=4 (size reply) or DLC=8 (data chunk), disambiguated by DLC
export const CAN_ID_READBACK_PAGE_ACK = generated.CAN_ID_READBACK_PAGE_ACK;
export const AUTHORIZE_DOWNGRADE_MAGIC = [...generated.MAGIC_AUTHORIZE_DOWNGRADE];
export const ENTER_BOOTLOADER_MAGIC = [...generated.MAGIC_ENTER_BOOTLOADER];

// --- Expansion slave (STM32F303CBT6) OTA - relayed through the main board's
// own bit-banged I2C bridge, since the slave has no CAN peripheral of its
// own. No page-ACK or heartbeat equivalent exists on this path - progress is
// polled explicitly (0x216) rather than pushed. See CANBUS.TXT / the URTC
// Flasher's flasher_config.py for the authoritative reference. ---
export const CAN_ID_SLAVE_ENTER_BOOTLOADER = generated.CAN_ID_SLAVE_ENTER_BOOTLOADER;
export const CAN_ID_SLAVE_START_UPDATE = generated.CAN_ID_SLAVE_START_UPDATE;
export const CAN_ID_SLAVE_HMAC_CHUNK = generated.CAN_ID_SLAVE_HMAC_CHUNK;
export const CAN_ID_SLAVE_DATA = generated.CAN_ID_SLAVE_DATA;
export const CAN_ID_SLAVE_END_UPDATE = generated.CAN_ID_SLAVE_END_UPDATE;
export const CAN_ID_SLAVE_STATUS = generated.CAN_ID_SLAVE_STATUS; // empty payload = query, same ID answers
export const CAN_ID_SLAVE_PROGRESS = generated.CAN_ID_SLAVE_PROGRESS; // empty payload = query, same ID answers
export const CAN_ID_SLAVE_VERSION_RESP_1 = generated.CAN_ID_SLAVE_VERSION_RESP_1;
export const CAN_ID_SLAVE_VERSION_RESP_2 = generated.CAN_ID_SLAVE_VERSION_RESP_2;
export const CAN_ID_SLAVE_VERIFY_FAIL_REASON = generated.CAN_ID_SLAVE_VERIFY_FAIL_REASON; // empty payload = query, same ID answers

export const PATCH_UNKNOWN = generated.PATCH_UNKNOWN;
export const PATCH_FLAG = generated.PATCH_FLAG; // in the high byte of the minor field of END_UPDATE: 0x80 | PATCH
export const PATCH_FLAG_ACCEPTS_IN_END_UPDATE = generated.PATCH_FLAG_ACCEPTS_IN_END_UPDATE; // bit 0 of the flags of 0x7E9
export const PATCH_GRACE_MS = generated.VERSION_PATCH_GRACE_MS;

export const SLAVE_HARDWARE_ID = generated.HARDWARE_ID_SLAVE;
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
  versionPatch?: number;    // third component of "major.minor.patch", when the manifest carries one
  buildDate?: string;
  sha256?: string;
  hmacSha256?: string;      // 64 lowercase hex chars - the signature the bootloader expects
  signingKeyKind?: string;  // "release" or "dev" (signed with the PUBLIC development key)
  signingKeyId?: string;
  hmacMalformed?: boolean;  // hmac_sha256 is present but is not 64 hex characters
  component?: string;       // "main_application", "slave_application", ...
  hardwareId?: number;      // parsed hardware_id; NaN when it is present but not a number
}

// Mirrors URTCFlasher._check_manifest from the Python flasher: a <file>.manifest.json
// sidecar is optional. Its "version" field (if parseable as "major.minor") takes
// priority over the version in the file name when reporting
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
      if (parts.length >= 3 && /^\d+$/.test(parts[2])) manifest.versionPatch = parseInt(parts[2], 10);
    }
  }
  if (typeof json?.build_date === 'string') manifest.buildDate = json.build_date;
  if (typeof json?.sha256 === 'string') manifest.sha256 = json.sha256.trim().toLowerCase().replace(/^0x/, '');
  if (json?.hmac_sha256 !== undefined && json?.hmac_sha256 !== null) {
    // A signature that is present but malformed is an error (the Python flasher refuses it too), never silently ignored.
    const hex = typeof json.hmac_sha256 === 'string' ? json.hmac_sha256.trim().toLowerCase().replace(/^0x/, '') : '';
    if (/^[0-9a-f]{64}$/.test(hex)) manifest.hmacSha256 = hex;
    else manifest.hmacMalformed = true;
  }
  if (typeof json?.component === 'string') manifest.component = json.component;
  if (json?.hardware_id !== undefined && json?.hardware_id !== null && json?.hardware_id !== '') {
    const raw = String(json.hardware_id).trim();
    manifest.hardwareId = /^(0x[0-9a-f]+|\d+)$/i.test(raw) ? Number(raw) : NaN;
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

// --- Version with an optional PATCH (CANBUS.TXT, "FIRMWARE PATCH NUMBER") ---

export interface FirmwareVersion {
  major: number;
  minor: number;
  patch?: number; // undefined = this side does not carry a patch
}

/** "0.3.5", or "0.3" when no patch is known. */
export function formatVersion(v: FirmwareVersion): string {
  return v.patch === undefined ? `${v.major}.${v.minor}` : `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Orders two versions by major, then minor; the patch decides only when BOTH carry one
 * (the same rule as the bootloader's anti-rollback). -1: candidate is older, 0: same, 1: newer.
 */
export function compareVersions(installed: FirmwareVersion, candidate: FirmwareVersion): -1 | 0 | 1 {
  if (candidate.major !== installed.major) return candidate.major > installed.major ? 1 : -1;
  if (candidate.minor !== installed.minor) return candidate.minor > installed.minor ? 1 : -1;
  if (installed.patch !== undefined && candidate.patch !== undefined && candidate.patch !== installed.patch) {
    return candidate.patch > installed.patch ? 1 : -1;
  }
  return 0;
}

export interface PatchInfo {
  side: 'application' | 'bootloader';
  patch: number | undefined; // undefined when the board reported 0xFF
  acceptsPatchInEndUpdate: boolean;
}

/** Reads a 0x7E9 frame: length 3 or more (extra bytes ignored), anything shorter is not one. */
export function parsePatchFrame(data: number[]): PatchInfo | null {
  if (data.length < 3) return null;
  return {
    side: data[0] === 0x00 ? 'application' : 'bootloader',
    patch: data[1] === PATCH_UNKNOWN ? undefined : data[1],
    acceptsPatchInEndUpdate: (data[2] & PATCH_FLAG_ACCEPTS_IN_END_UPDATE) !== 0,
  };
}

/**
 * The 16-bit minor field of END_UPDATE: the plain minor for a legacy bootloader, or 0x80 | PATCH in the high
 * byte only towards a bootloader that announced it (bit 0 of the flags of its own 0x7E9) and for a patch of 0 to 127.
 */
export function minorField(minor: number, patch: number | undefined, bootloaderAcceptsPatch: boolean): number {
  if (bootloaderAcceptsPatch && patch !== undefined && patch >= 0 && patch <= 0x7F) {
    return ((PATCH_FLAG | patch) << 8) | (minor & 0xFF);
  }
  return minor;
}
