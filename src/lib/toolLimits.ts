// Limits the firmware enforces, so the panels never offer a value it would
// turn into a latched fault or reinterpret as another command.

/** Above this the firmware latches a critical thermal error. */
export const MAX_HEATER_SETPOINT_C = 445;
/** Step counts are 32-bit; 0 means "stop", so a move is 1..MAX. */
export const MAX_MOTION_STEPS = 4294967295;
/** The firmware strobe period is in milliseconds and capped. */
export const AOI_STROBE_MIN_MS = 1;
export const AOI_STROBE_MAX_MS = 500;
/** 0 ms would keep the output on with nothing left to stop it. */
export const PASTE_PULSE_MIN_MS = 1;
export const PASTE_PULSE_MAX_MS = 255;

export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

/** Big-endian 32-bit step count of a move frame; rejects what does not fit instead of wrapping it into a different count. */
export function stepsToBytes(steps: number): number[] {
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_MOTION_STEPS) throw new RangeError('steps must be an integer from 1 to 4294967295');
  return [(steps >>> 24) & 0xFF, (steps >>> 16) & 0xFF, (steps >>> 8) & 0xFF, steps & 0xFF];
}
