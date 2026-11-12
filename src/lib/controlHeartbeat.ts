// A confirmed setpoint of the Control tab that is refreshed inside the 250 ms window of the firmware, for a bounded time. It ends on STOP, when the time is up, when
// the window loses focus, when the tab is left, when the connection is lost and when the page goes away, and every end sends the frame that switches the tool off.

import { startKeepaliveLoop } from './keepaliveLoop';

/** The firmware drops a command that is not refreshed within 250 ms; the refresh is sent well inside that. */
export const HEARTBEAT_INTERVAL_MS = 100;
export const HOLD_SECONDS_DEFAULT = 30;
export const HOLD_SECONDS_MIN = 5;
export const HOLD_SECONDS_MAX = 120;
export const HOLD_STORAGE_KEY = 'urtc-web-studio-control-hold-seconds';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** A whole number of seconds between the limits; anything else (a text, a fraction, a number outside) is the default. */
export function clampHoldSeconds(value: unknown): number {
  const n = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= HOLD_SECONDS_MIN && n <= HOLD_SECONDS_MAX ? n : HOLD_SECONDS_DEFAULT;
}

export function loadHoldSeconds(storage?: StorageLike): number {
  try { return clampHoldSeconds(storage?.getItem(HOLD_STORAGE_KEY) ?? undefined); } catch { return HOLD_SECONDS_DEFAULT; }
}

export function saveHoldSeconds(storage: StorageLike | undefined, seconds: number): void {
  try { storage?.setItem(HOLD_STORAGE_KEY, String(clampHoldSeconds(seconds))); } catch { /* a convenience only */ }
}

export type CutReason = 'stop' | 'blur' | 'tab' | 'connection' | 'expired' | 'unmount' | 'switch';

export interface Heartbeat {
  readonly running: boolean;
  /** Ends it (once): the refresh stops and the frame that switches the tool off is sent. */
  stop: (reason: CutReason) => void;
}

export interface HeartbeatOptions {
  send: () => unknown | Promise<unknown>;
  off: () => unknown | Promise<unknown>;
  durationMs: number;
  intervalMs?: number;
  onEnd: (reason: CutReason) => void;
}

/** Sends at once and then every interval, for at most `durationMs`. A refresh that fails ends it as a lost connection. */
export function startHeartbeat(options: HeartbeatOptions): Heartbeat {
  let running = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopLoop: () => void = () => undefined;

  const end = (reason: CutReason) => {
    if (!running) return;
    running = false;
    if (timer !== undefined) clearTimeout(timer);
    stopLoop();
    options.onEnd(reason);
  };

  stopLoop = startKeepaliveLoop(options.intervalMs ?? HEARTBEAT_INTERVAL_MS, () => ({
    send: async () => { await options.send(); },
    off: async () => { await options.off(); },
    onFailure: () => end('connection'),
  }));
  timer = setTimeout(() => end('expired'), options.durationMs);
  return { get running() { return running; }, stop: end };
}
