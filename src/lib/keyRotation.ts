import { CAN_ID_BOOTLOADER_KEY_ID, CAN_ID_BOOTLOADER_SELECT, CAN_ID_BOOTLOADER_SELECT_RESPONSE } from './generated/urtcCanIds';
import type { VersionBus } from './boardVersion';
import { type KeyCheck, compareSigningKey } from './signingKeyCheck';

// Rotation of the signing key. While one is in progress a bootloader trusts two keys: the current one and the previous one, the previous only for a window that
// the HOST opens with a signed command carrying its own time. The bootloader answers the question 0x7EA operation 05 with a status on 0x7EB (05, number of keys,
// flags, seconds left, big-endian, 0xFFFFFFFF without a window) and the fingerprints on 0x7ED, the current key first. Anything that does not add up is "no data",
// never a guess: a malformed status, a silent bootloader or a number of fingerprints that differs from the count.

export const ROTATION_STATUS_OP = 0x05;
const NO_WINDOW = 0xffffffff;
const KEY_ID_BYTES = 8;
const KEY_WAIT_MS = 30;

export interface RotationStatus {
  count: number;
  rotating: boolean;
  currentRevoked: boolean;
  /** Seconds until the previous key stops verifying; undefined when there is no window. */
  secondsLeft?: number;
}

export interface KeyRotationInfo extends RotationStatus {
  /** Fingerprints (eight bytes, hex) the bootloader trusts now: the current key first, the previous one second while the window lasts. */
  keys: string[];
}

export function parseRotationStatus(data: number[]): RotationStatus | null {
  if (data.length !== 7 || data[0] !== ROTATION_STATUS_OP || data[1] > 2 || (data[2] & ~0x03) !== 0) return null;
  const left = ((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6]) >>> 0;
  return { count: data[1], rotating: (data[2] & 0x01) !== 0, currentRevoked: (data[2] & 0x02) !== 0, secondsLeft: left === NO_WINDOW ? undefined : left };
}

function hex(data: number[]): string {
  return data.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Whole minutes left, rounded up (a window with seconds left never shows 0). */
export function minutesLeft(seconds: number | undefined): number {
  return seconds === undefined ? 0 : Math.max(1, Math.ceil(seconds / 60));
}

/** Asks which signing keys the bootloader trusts now. Null when it does not answer or the answer cannot be attributed. */
export async function queryKeyRotation(bus: VersionBus): Promise<KeyRotationInfo | null> {
  bus.flushFrames(CAN_ID_BOOTLOADER_KEY_ID);
  const resp = await bus.request(CAN_ID_BOOTLOADER_SELECT, [ROTATION_STATUS_OP], CAN_ID_BOOTLOADER_SELECT_RESPONSE, 600, 'Query the signing keys of the bootloader');
  if (!resp) return null;
  const status = parseRotationStatus(resp.data);
  if (!status) return null;
  const keys: string[] = [];
  for (let i = 0; i < 3; i++) {
    const frame = await bus.waitForFrame(CAN_ID_BOOTLOADER_KEY_ID, KEY_WAIT_MS);
    if (!frame) break;
    if (frame.data.length === KEY_ID_BYTES && !keys.includes(hex(frame.data))) keys.push(hex(frame.data));
  }
  if (keys.length !== status.count) return null;
  return { ...status, keys };
}

export interface RotationVerdict {
  check: KeyCheck;
  /** The fingerprint of the board that matched, or the current one when none did. */
  fingerprint?: string;
  /** True when the image matched the previous key: it works now, and not for much longer. */
  usesPreviousKey: boolean;
}

/** The image against the keys the bootloader trusts: it matches if it names either of them. */
export function compareWithRotation(rotation: KeyRotationInfo | null, imageKeyId: string | undefined | null): RotationVerdict | null {
  if (!rotation || rotation.keys.length === 0 || !imageKeyId) return null;
  for (let i = 0; i < rotation.keys.length; i++) {
    if (compareSigningKey(rotation.keys[i], imageKeyId) === 'match') return { check: 'match', fingerprint: rotation.keys[i], usesPreviousKey: i === 1 };
  }
  return { check: 'mismatch', fingerprint: rotation.keys[0], usesPreviousKey: false };
}
