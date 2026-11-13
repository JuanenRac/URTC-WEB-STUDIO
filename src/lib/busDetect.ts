// Finds the speed of a CAN bus without putting a single frame on it, and opens a channel at a speed the person chose.
//
// A channel opened in normal mode that sends a question at a speed the bus does not run at disturbs the heads that do run at it (they count the
// errors of a transmitter that talks at another speed). So the search listens first: each speed is opened in the listen-only mode of the adapter
// (the SLCAN command `L`, which cannot transmit and does not acknowledge), and a speed is the right one when a frame of a URTC head is heard. Only
// then is the channel reopened in normal mode, at the speed that was heard. When nothing is heard at any speed the channel is closed and the person
// is asked to choose the speed by hand; no question is ever sent to guess.
import { BITRATE_TRY_ORDER } from './busRate';
import { CAN_ID_HEALTH_PROFILE } from './busHealth';
import { CAN_ID_HEALTH_INFO } from './healthInfo';

export interface BusRate { label: string; code: string }

/** What the search needs from the serial connection; the hook provides it and the tests provide a fake. */
export interface BusDetectIo {
  /** Writes one SLCAN command (without the closing carriage return). */
  send(command: string): Promise<void>;
  /** Waits a moment for the adapter to take a command. */
  settle(milliseconds: number): Promise<void>;
  /** Drops a partial line left over from the previous speed. */
  clearReceived(): void;
  /** Starts listening and resolves true as soon as a frame with one of these identifiers is dispatched, false after the time. */
  listen(identifiers: readonly number[], milliseconds: number): Promise<boolean>;
}

/** The identifiers that only a head of this family sends on its own (health and identity) or in answer to the version question. */
export function passiveIdentifiers(versionResponse: number, bootloaderVersionResponse: number): number[] {
  return [CAN_ID_HEALTH_PROFILE, CAN_ID_HEALTH_INFO, versionResponse, bootloaderVersionResponse];
}

export interface DetectOptions {
  order?: readonly BusRate[];
  identifiers: readonly number[];
  /** How long each speed is listened to; the heads send their health about once a second. */
  listenMilliseconds?: number;
  settleMilliseconds?: number;
}

const DEFAULT_LISTEN_MS = 1200;
const DEFAULT_SETTLE_MS = 50;

async function closeQuietly(io: BusDetectIo): Promise<void> {
  try { await io.send('C'); } catch { /* the writer may be gone already: nothing is left to close */ }
}

/**
 * Listens at each speed in turn. Returns the label of the speed at which a head was heard, with the channel left open in normal mode at it,
 * or null with the channel closed when no speed gave a frame. Nothing is transmitted while it searches. Any failure closes the channel and is rethrown.
 */
export async function detectBusRate(io: BusDetectIo, options: DetectOptions): Promise<string | null> {
  const order = options.order ?? BITRATE_TRY_ORDER;
  const listenMs = options.listenMilliseconds ?? DEFAULT_LISTEN_MS;
  const settleMs = options.settleMilliseconds ?? DEFAULT_SETTLE_MS;
  try {
    for (const { label, code } of order) {
      await io.send('C'); // SLCAN refuses a speed change while the channel is open
      await io.settle(settleMs);
      io.clearReceived();
      await io.send('S' + code);
      await io.settle(settleMs);
      const heard = io.listen(options.identifiers, listenMs); // registered before the channel opens, so a fast frame cannot be missed
      await io.send('L'); // listen-only: the adapter cannot transmit
      if (await heard) {
        await io.send('C');
        await io.settle(settleMs);
        io.clearReceived();
        await io.send('S' + code);
        await io.settle(settleMs);
        await io.send('O'); // normal mode, at the speed that was heard
        return label;
      }
    }
  } catch (error) {
    await closeQuietly(io);
    throw error;
  }
  await closeQuietly(io);
  return null;
}

export interface OpenOptions {
  /** The frame that asks a head for its version, as an SLCAN command. */
  queryCommand: string;
  /** Identifiers that answer it. */
  answerIdentifiers: readonly number[];
  answerMilliseconds?: number;
  settleMilliseconds?: number;
}

/**
 * Opens the channel in normal mode at the speed the person chose and asks for the version once. Returns true when a head answered; when none did the
 * channel is closed and false is returned. Any failure closes the channel and is rethrown.
 */
export async function openAtBusRate(io: BusDetectIo, rate: BusRate, options: OpenOptions): Promise<boolean> {
  const settleMs = options.settleMilliseconds ?? DEFAULT_SETTLE_MS;
  try {
    await io.send('C');
    await io.settle(settleMs);
    io.clearReceived();
    await io.send('S' + rate.code);
    await io.settle(settleMs);
    await io.send('O');
    await io.settle(settleMs);
    const answered = io.listen(options.answerIdentifiers, options.answerMilliseconds ?? 800);
    await io.send(options.queryCommand);
    if (await answered) return true;
  } catch (error) {
    await closeQuietly(io);
    throw error;
  }
  await closeQuietly(io);
  return false;
}

/** The speed the person chose in the selector: 'auto' or the SLCAN code of one speed of the table; anything else is 'auto'. */
export const AUTO_RATE = 'auto';

export function chosenRate(value: string | null | undefined, order: readonly BusRate[] = BITRATE_TRY_ORDER): BusRate | null {
  if (!value || value === AUTO_RATE) return null;
  return order.find((entry) => entry.code === value) ?? null;
}
