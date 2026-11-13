// The Control tab models a board, and with a board connected it sends real frames to the bus (always real; the simulator stays for the slider and for no board).
// It sends only for a tool whose setpoint is one single frame, only inside the limits of the tool, and only after the person confirms that very frame (the drill
// and the laser ask twice, the second time with an explicit text). A drill or a laser that is on is asked again only when the power changes by more than the
// percentage of the configuration file (controlConfig.json). With no board connected, nothing reaches the bus.

import { byte, drillCommand, drillStop, laserCommand, laserOff, solderOff, solderSetpoint } from './toolFrames';
import { MAX_HEATER_SETPOINT_C } from './toolLimits';
import { CAN_ID_DRILL_CMD, CAN_ID_LASER_CMD, CAN_ID_SOLDER_SETPOINT } from './canIds';
import type { ActionKind } from './dangerousActions';
import controlConfig from './controlConfig.json';

export const DEFAULT_RECONFIRM_PERCENT = 10;
export const MAX_RECONFIRM_PERCENT = 500;

/** The percentage of change of the power of a drill or a laser that is on above which it asks again: a number from 0 to 500, else the default. */
export function reconfirmPercent(config: { power_change_reconfirm_percent?: unknown } = controlConfig): number {
  const value = config?.power_change_reconfirm_percent;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_RECONFIRM_PERCENT ? value : DEFAULT_RECONFIRM_PERCENT;
}

/**
 * True when changing the power of a tool that is on from `current` to `next` needs a new confirmation: the change (up or down) is over `percent` of the current
 * power. A current power of zero (or one that is not a number) is a tool that is off, which always asks.
 */
export function powerChangeNeedsConfirmation(current: number | null | undefined, next: number, percent: number = reconfirmPercent()): boolean {
  if (typeof current !== 'number' || !Number.isFinite(current) || current <= 0 || !Number.isFinite(next)) return true;
  return Math.abs(next - current) > (current * percent) / 100;
}

export type SecondConfirmation = 'drill' | 'laser';

interface RealSetpoint {
  canId: number;
  kind: ActionKind;
  min: number;
  max: number;
  /** The payload for `value` in the units of the profile; `toolMax` is the top of the slider, for the tools whose byte is a fraction of it. */
  encode: (value: number, toolMax: number) => number[];
  off: () => number[];
  /** Asked a second time, with an explicit text, because the tool can hurt a person. */
  second: SecondConfirmation | null;
  /** A refreshed session (the heartbeat) is offered; the drill and the laser are only ever one confirmed frame. */
  heartbeat: boolean;
}

/** A value of the slider as the byte the firmware takes: the fraction of the top of the slider, rounded and kept between 0 and 255. */
export function scaleToByte(value: number, top: number): number {
  return top > 0 ? byte((value / top) * 255) : 0;
}

/**
 * The tools whose setpoint is a single frame of their own: the soldering iron (tool 0, whole degrees up to the limit the firmware enforces), the drill (tool 5,
 * the speed as a byte, clockwise) and the laser (tool 9, the power as a byte with the interlock flag set).
 */
const REAL_SETPOINTS: Record<number, RealSetpoint> = {
  0: { canId: CAN_ID_SOLDER_SETPOINT, kind: 'heater', min: 1, max: MAX_HEATER_SETPOINT_C, encode: (v) => solderSetpoint(v), off: solderOff, second: null, heartbeat: true },
  5: { canId: CAN_ID_DRILL_CMD, kind: 'drill', min: 1, max: 24000, encode: (v, top) => drillCommand(scaleToByte(v, top), 'cw'), off: drillStop, second: 'drill', heartbeat: false },
  9: { canId: CAN_ID_LASER_CMD, kind: 'laser', min: 1, max: 100, encode: (v, top) => laserCommand(scaleToByte(v, top), true), off: laserOff, second: 'laser', heartbeat: false },
};

export type ControlSendPlan =
  | { kind: 'simulate' }
  | { kind: 'unsupported' }
  | { kind: 'out_of_range' }
  | {
      kind: 'confirm'; id: number; data: number[]; offData: number[]; action: ActionKind; value: number;
      second: SecondConfirmation | null; heartbeat: boolean;
      /** False when the tool is already on and the change of power is within the percentage: the frame goes out without asking again. */
      ask: boolean;
    };

export interface ControlSendInput {
  connected: boolean; toolId: number; value: number; toolMin?: number; toolMax?: number;
  /** The power the drill or the laser was last set to and is still on at (null when it is off); a change within the percentage does not ask again. */
  activePower?: number | null; reconfirmPercent?: number;
}

/** What the button of the Control tab may do. Anything but `confirm` sends nothing. */
export function planControlSend(input: ControlSendInput): ControlSendPlan {
  if (!input.connected) return { kind: 'simulate' };
  const entry = REAL_SETPOINTS[input.toolId];
  if (!entry) return { kind: 'unsupported' };
  const value = Math.round(input.value);
  const low = Math.max(entry.min, input.toolMin ?? entry.min);
  const high = Math.min(entry.max, input.toolMax ?? entry.max);
  if (!Number.isFinite(input.value) || value < low || value > high) return { kind: 'out_of_range' };
  return {
    kind: 'confirm', id: entry.canId, data: entry.encode(value, input.toolMax ?? entry.max), offData: entry.off(), action: entry.kind, value,
    second: entry.second, heartbeat: entry.heartbeat,
    ask: entry.second === null || powerChangeNeedsConfirmation(input.activePower, value, input.reconfirmPercent),
  };
}

/** True for the tool whose confirmed setpoint can be held (refreshed for a bounded time). */
export function canHoldTool(toolId: number): boolean {
  return REAL_SETPOINTS[toolId]?.heartbeat === true;
}

/** The frame that switches the tool off, or null for a tool this tab cannot actuate: what STOP sends. */
export function stopFrameFor(toolId: number): { id: number; data: number[] } | null {
  const entry = REAL_SETPOINTS[toolId];
  return entry ? { id: entry.canId, data: entry.off() } : null;
}

export type Confirm = (kind: ActionKind, options: { value?: number; second?: boolean }) => Promise<boolean>;

/** Asks what the plan needs: the confirmation of the action and, for the drill and the laser, a second one. Only a true answer to each counts. */
export async function confirmPlan(plan: ControlSendPlan, confirm: Confirm): Promise<boolean> {
  if (plan.kind !== 'confirm') return false;
  if (!plan.ask) return true;
  if ((await confirm(plan.action, { value: plan.value })) !== true) return false;
  if (plan.second && (await confirm(plan.second, { value: plan.value, second: true })) !== true) return false;
  return true;
}

export type ControlSendOutcome = 'simulated' | 'unsupported' | 'out_of_range' | 'cancelled' | 'sent';

/** Runs a plan: the frame goes out only when every confirmation it needs is true, and one confirmation covers one frame. */
export async function runControlSend(
  plan: ControlSendPlan,
  confirm: Confirm,
  send: (id: number, data: number[]) => Promise<unknown>,
): Promise<ControlSendOutcome> {
  if (plan.kind === 'simulate') return 'simulated';
  if (plan.kind === 'unsupported') return 'unsupported';
  if (plan.kind === 'out_of_range') return 'out_of_range';
  if (!(await confirmPlan(plan, confirm))) return 'cancelled';
  await send(plan.id, plan.data);
  return 'sent';
}
