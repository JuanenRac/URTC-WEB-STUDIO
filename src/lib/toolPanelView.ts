// =============================================================================
// URTC Web Studio - the panel of a tool as it is described in its profile
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The controls, the readings and the commands of most tool panels are data (the `panel` of a tool in spec/tools.json of URTC-COMMON, generated
// into generated/urtcTools.ts). This module holds what does not need a screen: the frame builders a panel may name, the first value of every
// control, the reading of a number from a telemetry frame and the text of a label.
import type { UrtcPanelControl, UrtcPanelReading, UrtcPanelText, UrtcToolPanel } from './generated/urtcTools';
import { URTC_TOOL_PROFILES } from './generated/urtcTools';
import { WELD_PULSE_MAX_MS } from './canIds';
import {
  aoiRingCommand, drillCommand, drillStop, electromagnetCommand, hotAirCommand, hotAirOff, laserCommand, laserOff, motionMove, motionStop,
  pasteJettingConfig, pasteJettingPulse, powerByte, powerOff, weldFire,
} from './toolFrames';

export type PanelValue = number | string | boolean;
export type PanelValues = Record<string, PanelValue>;

const num = (v: PanelValue): number => (typeof v === 'number' ? v : Number(v));

/**
 * The frame builders a panel may name. Each one receives the values of the controls the panel lists for it, in that order; the name is the one
 * toolFrames.ts exports (the specification checks the name and the number of arguments).
 */
export const PANEL_ENCODERS: Record<string, (...values: PanelValue[]) => number[]> = {
  drillCommand: (speed, dir) => drillCommand(num(speed), dir === 'ccw' ? 'ccw' : 'cw'),
  drillStop: () => drillStop(),
  aoiRingCommand: (mode, period) => aoiRingCommand(num(mode), num(period)),
  laserCommand: (power, interlock) => laserCommand(num(power), interlock === true),
  laserOff: () => laserOff(),
  powerByte: (power) => powerByte(num(power)),
  powerOff: () => powerOff(),
  electromagnetCommand: (on) => electromagnetCommand(on === true),
  hotAirCommand: (celsius, blower) => hotAirCommand(num(celsius), num(blower)),
  hotAirOff: () => hotAirOff(),
  motionMove: (dir, steps) => motionMove(dir === 'fwd', num(steps)),
  motionStop: (dir) => motionStop(dir === 'fwd'),
  weldFire: (ms) => weldFire(num(ms), WELD_PULSE_MAX_MS),
  pasteJettingConfig: (channel, hertz) => pasteJettingConfig(num(channel), num(hertz)),
  pasteJettingPulse: (channel, duty, pulseMs) => pasteJettingPulse(num(channel), num(duty), num(pulseMs)),
};

export function panelOf(toolId: number): UrtcToolPanel | null {
  return URTC_TOOL_PROFILES.find((p) => p.id === toolId)?.panel ?? null;
}

export function panelControls(panel: UrtcToolPanel): UrtcPanelControl[] {
  return panel.sections.flatMap((s) => s.controls ?? []);
}

/** The first value of every control of the panel. */
export function initialValues(panel: UrtcToolPanel): PanelValues {
  const out: PanelValues = {};
  for (const control of panelControls(panel)) out[control.id] = control.default;
  return out;
}

/** A value held to the range of its control; anything that is not a number falls back to the lowest one. */
export function clampControl(control: UrtcPanelControl, raw: string | number): number {
  if (control.type !== 'range' && control.type !== 'number') return Number(raw);
  const parsed = typeof raw === 'number' ? raw : parseInt(raw, 10);
  const n = Number.isFinite(parsed) ? parsed : control.min;
  return Math.max(control.min, Math.min(control.max, n));
}

/** The number a reading has in a telemetry frame (big-endian), or null when the frame is too short. */
export function readingOf(reading: Pick<UrtcPanelReading, 'offset' | 'width'>, data: number[]): number | null {
  if (data.length < reading.offset + reading.width) return null;
  return reading.width === 1 ? data[reading.offset] : (data[reading.offset] << 8) | data[reading.offset + 1];
}

/** The text of a label: the translation of its key (with the value of its control and the range as parameters), or its plain text. */
export function panelText(
  t: (key: string, fallback: string, params?: Record<string, unknown>) => string,
  text: UrtcPanelText,
  params: Record<string, unknown> = {},
): string {
  if ('text' in text) return text.text.replace('{tool}', String(params.tool ?? ''));
  return t(text.key, text.default, params);
}

/** The values a label may use: the control's value under the name the label gives it, and the range of the control as min and max. */
export function labelParams(control: UrtcPanelControl, value: PanelValue): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if ('param' in control.label && control.label.param) params[control.label.param] = value;
  if (control.type === 'range' || control.type === 'number') {
    params.min = control.min;
    params.max = control.max;
  }
  return params;
}
