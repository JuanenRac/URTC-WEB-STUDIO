// Which actions ask "are you sure?" before anything leaves for the board, and
// how serious each one is. The rule is the same in every panel: anything that
// moves, heats, fires, cuts or writes to the board's memory is confirmed;
// reading and plain telemetry are not.

export type Risk = 'caution' | 'danger';

export type ActionKind =
  | 'laser' | 'drill' | 'uv' | 'weld'       // can hurt a person: danger
  | 'heater'                                // hot: caution, only when a setpoint above 0 is going to be sent
  | 'motion' | 'paste' | 'feeder_reset'     // moves or dispenses: caution
  | 'program_config' | 'erase_fram' | 'raw_frame' // writes to the board or can change its mode: danger
  | 'dev_key';                              // an image signed with the public development key: caution

const RISK: Record<ActionKind, Risk> = {
  laser: 'danger', drill: 'danger', uv: 'danger', weld: 'danger',
  heater: 'caution',
  motion: 'caution', paste: 'caution', feeder_reset: 'caution',
  program_config: 'danger', erase_fram: 'danger', raw_frame: 'danger',
  dev_key: 'caution',
};

/** The risk level of an action, or null when nothing needs to be confirmed. `value` is the setpoint for a heater. */
export function confirmationRisk(kind: ActionKind, value?: number): Risk | null {
  if (kind === 'heater') return value !== undefined && value > 0 ? RISK.heater : null;
  return RISK[kind];
}

// Raw frames typed by hand (Custom Frame, Inject Raw CAN Frame).
const PERSISTENT_WRITE_IDS = new Set([0x192, 0x1a0, 0x1a2, 0x1a4, 0x1a6]);
const BOOTLOADER_CONTROL_IDS = new Set([0x7f0, 0x7f1, 0x7f2, 0x7f4, 0x7f7, 0x7fd, 0x210, 0x211, 0x212, 0x213, 0x214]);
const ACTUATOR_COMMAND_IDS = new Set([
  0x100, 0x120, 0x130, 0x131, 0x140, 0x150, 0x160, 0x170, 0x173, 0x178, 0x1b0, 0x1c0, 0x1d0, 0x1e0, 0x1f0, 0x200, 0x230, 0x231, 0x240, 0x241, 0x250,
]);
// Identifiers only the board transmits: sending one from the host would collide with the board itself and feed false data to every listener.
const BOARD_TO_HOST_ONLY_IDS = new Set([
  0x095, 0x111, 0x135, 0x145, 0x147, 0x155, 0x165, 0x175, 0x177, 0x179, 0x181, 0x183, 0x191, 0x217, 0x218, 0x243, 0x253, 0x255, 0x7e9, 0x7f3, 0x7f5, 0x7f6, 0x7f9, 0x7fa, 0x7fc,
]);

export type RawSendPolicy = { kind: 'blocked' } | { kind: 'confirm'; reason: 'memory' | 'bootloader' | 'actuator' } | { kind: 'ok' };

/** What a hand-typed frame with this identifier may do when it goes to a real board. */
export function rawSendPolicy(id: number): RawSendPolicy {
  if (BOARD_TO_HOST_ONLY_IDS.has(id)) return { kind: 'blocked' };
  if (PERSISTENT_WRITE_IDS.has(id)) return { kind: 'confirm', reason: 'memory' };
  if (BOOTLOADER_CONTROL_IDS.has(id)) return { kind: 'confirm', reason: 'bootloader' };
  if (ACTUATOR_COMMAND_IDS.has(id)) return { kind: 'confirm', reason: 'actuator' };
  return { kind: 'ok' };
}
