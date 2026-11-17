// The optional functions of a tool head (0x1AE / 0x1AF) have two mask bytes: the first one has its eight bits taken, the second one starts with the switch that
// makes the communication watchdog count only frames of the host side. A head that only knows the first byte answers with three bytes and is written with five.
import { FEATURES_MAGIC } from './toolFrames';

/** The query that asks for the six-byte answer; any other query is answered with the three bytes of before. */
export const FEATURES_QUERY_EXTENDED = [0x02];

/** The second byte of the map: bit 0x01 = with the communication watchdog, only frames of the host side count as a sign of life. */
export const FEATURE_EXT_WATCHDOG_HOST_ONLY = 0x01;
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
 * understands. A switch of the second byte that needs the communication watchdog is switched off when the watchdog is not on, as the electromagnet release is.
 */
export function featuresWriteFor(mask: number, maskExt: number, supportedExt: number): number[] {
  const first = mask & 0xFF;
  if (supportedExt === 0) return [...FEATURES_MAGIC, first];
  const ext = (first & FEATURE_COMMS_WATCHDOG) !== 0 ? maskExt & supportedExt & 0xFF : 0;
  return [...FEATURES_MAGIC, first, ext];
}
