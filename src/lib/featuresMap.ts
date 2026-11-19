// The optional functions of a tool head (0x1AE / 0x1AF) have two mask bytes: the first one has its eight bits taken, the second one starts with the switch that
// makes the communication watchdog count only frames of the host side. A head that only knows the first byte answers with three bytes and is written with five.
import { ESTOP_ALIVE_TIMEOUT_MAX_MS, ESTOP_ALIVE_TIMEOUT_MIN_MS } from './generated/urtcCanIds';
import { FEATURES_MAGIC } from './toolFrames';

/** The query that asks for the six-byte answer; any other query is answered with the three bytes of before. */
export const FEATURES_QUERY_EXTENDED = [0x02];

/** The second byte of the map: bit 0x01 = with the communication watchdog, only frames of the host side count as a sign of life. */
export const FEATURE_EXT_WATCHDOG_HOST_ONLY = 0x01;
/** The second byte, bit 0x02: the end of an update of a slave board is accepted while a tool of the head is active (without it the end is refused). Off by default. */
export const FEATURE_EXT_ALLOW_UPDATE_ACTIVE_ACTUATOR = 0x02;
export const FEATURE_COMMS_WATCHDOG = 0x20;

export interface FeaturesAnswer {
  stored: number;
  running: number;
  supported: number;
  storedExt: number;
  runningExt: number;
  /** 0 for a head that answered with three bytes: it has no switch in the second byte. */
  supportedExt: number;
  /** true when the answer had six bytes. */
  extended: boolean;
}

/** The answer of 0x1AF in either form, or null when it is neither three nor six bytes. */
export function parseFeaturesAnswer(data: ArrayLike<number> | undefined | null): FeaturesAnswer | null {
  if (!data || (data.length !== 3 && data.length !== 6)) return null;
  const extended = data.length === 6;
  return {
    stored: data[0] & 0xFF, running: data[1] & 0xFF, supported: data[2] & 0xFF,
    storedExt: extended ? data[3] & 0xFF : 0, runningExt: extended ? data[4] & 0xFF : 0, supportedExt: extended ? data[5] & 0xFF : 0,
    extended,
  };
}

/**
 * The frame that writes the switches. The second byte is only sent to a head that said it has one; to an older head the five-byte form goes, which is what it
 * understands. The switch of the second byte that needs the communication watchdog (host-only frames) is switched off when the watchdog is not on, as the electromagnet
 * release is; the switch for the end of a slave update does not depend on it and goes as asked.
 */
export function featuresWriteFor(mask: number, maskExt: number, supportedExt: number): number[] {
  const first = mask & 0xFF;
  if (supportedExt === 0) return [...FEATURES_MAGIC, first];
  const wanted = maskExt & supportedExt & 0xFF;
  const ext = (first & FEATURE_COMMS_WATCHDOG) !== 0 ? wanted : wanted & ~FEATURE_EXT_WATCHDOG_HOST_ONLY;
  return [...FEATURES_MAGIC, first, ext];
}

// ---- The silence of the master of the emergency stop (ESTOP_FOLLOW) ----
// The silence after which a ready head that hears no heartbeat goes back to its safe state. It is read with the one-byte queries 3 (in force now) and 4 (stored in
// the record, 0 = the default) of 0x1AF, which are answered with eight bytes ending in the silence in milliseconds (big endian), and written with the eight-byte form
// of 0x1AE. A value outside 0 and the limits is refused here: the firmware would ignore the whole command.
export const ESTOP_TIMEOUT_MIN_MS = ESTOP_ALIVE_TIMEOUT_MIN_MS;
export const ESTOP_TIMEOUT_MAX_MS = ESTOP_ALIVE_TIMEOUT_MAX_MS;
/** The query for the silence in force now. */
export const FEATURES_QUERY_ESTOP_IN_FORCE = [0x03];
/** The query for the silence stored in the record. */
export const FEATURES_QUERY_ESTOP_STORED = [0x04];

/** True for 0 (the default) and for a whole number of milliseconds inside the limits; a fraction, a text or NaN is not guessed at. */
export function estopTimeoutValid(ms: unknown): ms is number {
  return typeof ms === 'number' && Number.isInteger(ms) && (ms === 0 || (ms >= ESTOP_TIMEOUT_MIN_MS && ms <= ESTOP_TIMEOUT_MAX_MS));
}

export interface EstopTimeoutAnswer extends FeaturesAnswer {
  /** The silence in milliseconds: in force (query 3, 0 while the stop following does not run) or stored (query 4, 0 = the default). */
  timeoutMs: number;
}

/** The eight-byte answer of 0x1AF, or null for any other length (a head with an older firmware answers with three or six bytes). */
export function parseEstopTimeoutAnswer(data: ArrayLike<number> | undefined | null): EstopTimeoutAnswer | null {
  if (!data || data.length !== 8) return null;
  return {
    stored: data[0] & 0xFF, running: data[1] & 0xFF, supported: data[2] & 0xFF,
    storedExt: data[3] & 0xFF, runningExt: data[4] & 0xFF, supportedExt: data[5] & 0xFF,
    extended: true,
    timeoutMs: ((data[6] & 0xFF) << 8) | (data[7] & 0xFF),
  };
}

/** The eight-byte write: the switches of both bytes as they are, then the silence. Throws for a silence outside 0 and the limits. */
export function estopTimeoutWrite(mask: number, maskExt: number, ms: number): number[] {
  if (!estopTimeoutValid(ms)) throw new RangeError('the silence must be 0 or inside the limits');
  return [...FEATURES_MAGIC, mask & 0xFF, maskExt & 0xFF, (ms >> 8) & 0xFF, ms & 0xFF];
}
