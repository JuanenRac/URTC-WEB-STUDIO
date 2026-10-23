// Heater PID frames (0x1B9 / 0x1BA): the gains, the autotune orders and the state the board reports.
import {
  PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_AUTOTUNE_START, PID_ACTION_QUERY, PID_ACTION_SET_GAINS,
  PID_STATE_AUTOTUNE_DONE, PID_STATE_AUTOTUNE_FAILED, PID_STATE_AUTOTUNING, PID_STATE_OFF, PID_STATE_RUNNING,
} from './generated/urtcCanIds';

export { PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_AUTOTUNE_START, PID_ACTION_QUERY, PID_ACTION_SET_GAINS };

/** The firmware refuses a gain above 600.00: it keeps them times 100 in 16 bits and limits them to 60000. */
export const PID_GAIN_MAX = 600;

export const PID_STATE_KEYS: Record<number, string> = {
  [PID_STATE_OFF]: 'pid_state_off',
  [PID_STATE_RUNNING]: 'pid_state_running',
  [PID_STATE_AUTOTUNING]: 'pid_state_autotuning',
  [PID_STATE_AUTOTUNE_DONE]: 'pid_state_autotune_done',
  [PID_STATE_AUTOTUNE_FAILED]: 'pid_state_autotune_failed',
};

export type PidState = { kp: number; ki: number; kd: number; state: number; dutyPercent: number };

/** A gain as the board keeps it (times 100, 0 to 600.00). Text that is not a number, a negative value or one above 600 is refused, never clamped. */
export function pidGainX100(value: string | number): number | null {
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number <= PID_GAIN_MAX ? Math.round(number * 100) : null;
}

/** The 0x1B9 payload. The gains are read only when storing them; null when one is not a valid gain. */
export function encodePidConfig(action: number, gains?: { kp: string | number; ki: string | number; kd: string | number }): number[] | null {
  if (![PID_ACTION_SET_GAINS, PID_ACTION_AUTOTUNE_START, PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_QUERY].includes(action)) return null;
  let values = [0, 0, 0];
  if (action === PID_ACTION_SET_GAINS) {
    if (!gains) return null;
    const parsed = [pidGainX100(gains.kp), pidGainX100(gains.ki), pidGainX100(gains.kd)];
    if (parsed.some(v => v === null)) return null;
    values = parsed as number[];
  }
  return [...values.flatMap(v => [(v >> 8) & 0xFF, v & 0xFF]), action];
}

/** The 0x1BA answer; null when it is not 8 bytes. */
export function decodePidState(data: number[]): PidState | null {
  if (data.length !== 8) return null;
  const word = (i: number) => (data[i] << 8) | data[i + 1];
  return { kp: word(0) / 100, ki: word(2) / 100, kd: word(4) / 100, state: data[6], dutyPercent: data[7] };
}
