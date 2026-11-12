// The Control tab is a simulator. It may send one real frame to the connected board, and only when the person has switched that on (off by default, kept
// in this browser), only for a tool whose setpoint is one single frame, only inside the limits of the tool, and only after the person confirms that very
// frame. With the switch off, or with no board connected, nothing reaches the bus.

import { solderSetpoint } from './toolFrames';
import { MAX_HEATER_SETPOINT_C } from './toolLimits';
import { CAN_ID_SOLDER_SETPOINT } from './canIds';
import type { ActionKind } from './dangerousActions';

export const CONTROL_SEND_STORAGE_KEY = 'urtc-web-studio-control-real-send';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The switch: off unless it was explicitly saved as on; a storage that cannot be read means off. */
export function loadControlSend(storage?: StorageLike): boolean {
  try { return storage?.getItem(CONTROL_SEND_STORAGE_KEY) === '1'; } catch { return false; }
}

export function saveControlSend(storage: StorageLike | undefined, value: boolean): void {
  try { storage?.setItem(CONTROL_SEND_STORAGE_KEY, value ? '1' : '0'); } catch { /* a convenience only: the default is the protective one */ }
}

interface RealSetpoint { canId: number; kind: ActionKind; min: number; max: number; encode: (value: number) => number[] }

/** The tools whose setpoint is a single frame of its own: the soldering iron (tool 0), in whole degrees up to the limit the firmware enforces. */
const REAL_SETPOINTS: Record<number, RealSetpoint> = {
  0: { canId: CAN_ID_SOLDER_SETPOINT, kind: 'heater', min: 1, max: MAX_HEATER_SETPOINT_C, encode: solderSetpoint },
};

export type ControlSendPlan =
  | { kind: 'simulate' }
  | { kind: 'unsupported' }
  | { kind: 'out_of_range' }
  | { kind: 'confirm'; id: number; data: number[]; action: ActionKind; value: number };

export interface ControlSendInput { allowReal: boolean; connected: boolean; toolId: number; value: number; toolMin?: number; toolMax?: number }

/** What the button of the Control tab may do. Anything but `confirm` sends nothing. */
export function planControlSend(input: ControlSendInput): ControlSendPlan {
  if (!input.allowReal || !input.connected) return { kind: 'simulate' };
  const entry = REAL_SETPOINTS[input.toolId];
  if (!entry) return { kind: 'unsupported' };
  const value = Math.round(input.value);
  const low = Math.max(entry.min, input.toolMin ?? entry.min);
  const high = Math.min(entry.max, input.toolMax ?? entry.max);
  if (!Number.isFinite(input.value) || value < low || value > high) return { kind: 'out_of_range' };
  return { kind: 'confirm', id: entry.canId, data: entry.encode(value), action: entry.kind, value };
}

export type ControlSendOutcome = 'simulated' | 'unsupported' | 'out_of_range' | 'cancelled' | 'sent';

/** Runs a plan: the frame goes out only when `confirm` answers true for it, and one confirmation covers one frame. */
export async function runControlSend(
  plan: ControlSendPlan,
  confirm: (kind: ActionKind, options: { value?: number }) => Promise<boolean>,
  send: (id: number, data: number[]) => Promise<unknown>,
): Promise<ControlSendOutcome> {
  if (plan.kind === 'simulate') return 'simulated';
  if (plan.kind === 'unsupported') return 'unsupported';
  if (plan.kind === 'out_of_range') return 'out_of_range';
  if ((await confirm(plan.action, { value: plan.value })) !== true) return 'cancelled';
  await send(plan.id, plan.data);
  return 'sent';
}
