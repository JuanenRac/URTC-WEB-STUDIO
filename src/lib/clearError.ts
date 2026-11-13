// The button that lifts a latched critical error of a head, and the three switches that go with it and with the communication watchdog.
//
// The command (0x1B2, the magic "CLER") works only on a head whose CLEAR_ERROR switch was turned on, and the head refuses it unless the tool is cool and every
// actuator is at zero; it answers with the quick state (0x111), whose last two bytes say why the error was latched and what the command did. This file builds the
// frame, reads the answer and holds the one setting (controlConfig.json: `clear_error_confirm`), true by default. The decisions are those of the firmware
// (urtc_common.safety_policy); nothing here has run against a real board.

import { CAN_ID_CLEAR_ERROR, decodeActiveToolResp } from './generated/urtcCanIds';
import controlConfig from './controlConfig.json';

export { CAN_ID_CLEAR_ERROR };

/** The payload of the command: the magic word "CLER". */
export const CLEAR_ERROR_MAGIC = [0x43, 0x4c, 0x45, 0x52];
export const clearErrorCommand = (): number[] => [...CLEAR_ERROR_MAGIC];

/** The text key (after `testerextras.`) of each outcome of the command that the head can report. */
export const CLEAR_RESULT_KEYS: Readonly<Record<number, string>> = {
  1: 'clear_result_cleared', 2: 'clear_result_switch_off', 3: 'clear_result_no_error', 4: 'clear_result_not_clearable', 5: 'clear_result_hot', 6: 'clear_result_actuator_on',
};
/** The text key (after `testerextras.`) of each reason of a latched error. */
export const ERROR_REASON_KEYS: Readonly<Record<number, string>> = {
  1: 'error_reason_unknown', 2: 'error_reason_thermal', 3: 'error_reason_sensor', 4: 'error_reason_tool_id', 5: 'error_reason_comms_watchdog',
  6: 'error_reason_fan_stall', 7: 'error_reason_stepper_silence', 8: 'error_reason_magnet_release',
};

export interface ClearErrorAnswer {
  /** The error is still latched after the command. */
  systemError: boolean;
  /** Why it is latched (0 when it is not). */
  errorReason: number;
  /** What the last command did (1 lifted, 2 to 6 the reason it refused). */
  clearResult: number;
}

/** The answer of a head, or null when the frame does not carry the last two bytes (a head without the clear-error command answers with six or fewer). */
export function parseClearErrorAnswer(data: ArrayLike<number>): ClearErrorAnswer | null {
  const fields = decodeActiveToolResp(data);
  if (!fields || fields.error_reason == null || fields.clear_result == null) return null;
  return { systemError: Number(fields.system_error) !== 0, errorReason: Number(fields.error_reason), clearResult: Number(fields.clear_result) };
}

/** Whether the button asks before it sends: true unless the configuration file says exactly `false`. */
export function clearErrorNeedsConfirmation(config: { clear_error_confirm?: unknown } = controlConfig): boolean {
  return config?.clear_error_confirm !== false;
}
