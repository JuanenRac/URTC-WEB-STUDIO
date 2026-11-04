// =============================================================================
// URTC Web Studio - the panel of a tool as it is described in its profile
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The controls, the readings and the commands of most tool panels are data (the `panel` of a tool in spec/tools.json of URTC-COMMON, generated
// into generated/urtcTools.ts). This module holds what does not need a screen: the frame builders a panel may name, the first value of every
// control, the reading of a number from a telemetry frame and the text of a label.
import type { UrtcPanelAction, UrtcPanelControl, UrtcPanelReading, UrtcPanelResult, UrtcPanelText, UrtcToolPanel } from './generated/urtcTools';
import type { CanFrame } from '../types';
import { URTC_TOOL_PROFILES } from './generated/urtcTools';
import { SOLDER_FEEDER_RESET_MAGIC, WELD_PULSE_MAX_MS } from './canIds';
import {
  aoiRingCommand, drillCommand, drillStop, electromagnetCommand, hotAirCommand, hotAirOff, laserCommand, laserOff, motionMove, motionStop,
  pasteJettingConfig, pasteJettingPulse, powerByte, powerOff, solderOff, solderSetpoint, thermalMotionCommand, weldFire,
} from './toolFrames';
import { configWordToBytes } from './toolLimits';

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
  emptyFrame: () => [],
  adsConfig: (word) => configWordToBytes(String(word)),
  feederReset: () => [...SOLDER_FEEDER_RESET_MAGIC],
  solderSetpoint: (celsius) => solderSetpoint(num(celsius)),
  solderOff: () => solderOff(),
  thermalMotion: (celsius, dir, steps) => thermalMotionCommand(num(celsius), dir === 'fwd', num(steps)),
  thermalMotionOff: () => thermalMotionCommand(0, true, 0),
};

// A number in `args` stands for itself; a name is the control whose value goes in that place. With `gateFirst` the first one goes as 0 while the
// repeated command of the section is off (a heater set point must not be armed by a one-off move).
export function encodeAction(name: string, values: PanelValues, args: (string | number)[] | undefined, gateFirst = false, gateOpen = true): number[] {
  const list = (args ?? []).map((a) => (typeof a === 'number' ? a : values[a]));
  if (gateFirst && !gateOpen && list.length) list[0] = 0;
  return PANEL_ENCODERS[name](...list);
}

/** What a panel needs of the bus to ask the board for something (the `ToolCtx` of the tester satisfies it). */
export interface PanelBus {
  sendFrame: (id: number, data: number[], description?: string) => Promise<void>;
  waitForFrame: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
  request: (id: number, data: number[], respId: number, timeoutMs?: number, description?: string) => Promise<CanFrame | null>;
  flushFrames: (id?: number) => void;
}

/** Asks the board for the value of a `query` action: the number its answer holds, or null when nothing came back or the frame was too short. */
export async function askValue(bus: PanelBus, action: UrtcPanelAction): Promise<number | null> {
  const resp = await bus.request(action.canId, [], action.respCanId ?? action.canId, action.timeout_ms, action.description);
  return resp && action.result ? decodeValue(action.result, resp.data) : null;
}

/** Pulls the picture of an `image` action chunk by chunk and returns its temperatures; throws when a frame of a chunk does not arrive in time. */
export async function pullImage(bus: PanelBus, action: UrtcPanelAction, onProgress: (percent: number) => void): Promise<number[]> {
  const chunks = action.chunks as number;
  const respId = action.respCanId ?? action.canId;
  const bytes: number[] = [];
  for (let chunk = 0; chunk < chunks; chunk++) {
    // Frames left over from an earlier, aborted reading must not be mixed into this chunk.
    bus.flushFrames(respId);
    await bus.sendFrame(action.canId, [chunk], `${action.description} ${chunk}`);
    for (let f = 0; f < (action.frames_per_chunk as number); f++) {
      const frame = await bus.waitForFrame(respId, action.timeout_ms);
      if (!frame) throw new Error(`Timeout on chunk ${chunk}, frame ${f}`);
      bytes.push(...frame.data);
    }
    onProgress(Math.floor(((chunk + 1) / chunks) * 100));
  }
  return imagePixels(bytes, action.scale as number);
}

/** What a reading holds after a frame: a counter counts the frames of its event, a last-seen reading keeps their time, any other keeps the number it decodes. */
export function readingStep(
  reading: UrtcPanelReading, frame: { data: number[]; timestamp: string }, prev: { value: number | null; seen: string | null },
): { value: number | null; seen: string | null } {
  if (reading.format === 'count' || reading.format === 'last_seen') {
    if (!isEventFrame(reading, frame.data)) return prev;
    return reading.format === 'count' ? { ...prev, value: (prev.value ?? 0) + 1 } : { ...prev, seen: frame.timestamp };
  }
  const v = readingOf(reading, frame.data);
  return v === null ? prev : { ...prev, value: v };
}

/** The text of a reading and the tone it is drawn in: a yes/no flag, a count, the time of the last event or a number with its unit. */
export function readingShown(
  reading: Pick<UrtcPanelReading, 'format' | 'unit'>, value: number | null, seen: string | null, yes: string, no: string,
): { text: string; tone: 'on' | 'off' | 'plain' } {
  if (reading.format === 'yes_no') return value ? { text: yes, tone: 'on' } : { text: no, tone: 'off' };
  if (reading.format === 'count') return { text: String(value ?? 0), tone: 'plain' };
  if (reading.format === 'last_seen') return { text: seen ?? '--', tone: 'plain' };
  return { text: `${value ?? '--'}${reading.unit ? ` ${reading.unit}` : ''}`, tone: 'plain' };
}

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

/** The number a query answer holds: 1, 2 or 4 bytes big-endian from `offset`, as a signed value when the result says so; null when the frame is too short. */
export function decodeValue(spec: Pick<UrtcPanelResult, 'offset' | 'width' | 'signed'>, data: number[]): number | null {
  if (data.length < spec.offset + spec.width) return null;
  let value = 0;
  for (let i = 0; i < spec.width; i++) value = value * 256 + data[spec.offset + i];
  const range = 2 ** (8 * spec.width);
  return spec.signed && value >= range / 2 ? value - range : value;
}

/** The text a query result shows: the name of the state the number stands for, the number itself, or its hexadecimal form for a state nobody named. */
export function resultText(
  t: (key: string, fallback: string, params?: Record<string, unknown>) => string,
  result: Pick<UrtcPanelResult, 'states'>,
  value: number | null,
): string {
  if (value === null) return '--';
  if (!result.states) return String(value);
  const state = result.states.find((s) => s.value === value);
  return state ? panelText(t, state.label) : `0x${value.toString(16)}`;
}

/** True when a frame is the event a reading counts: the byte at its offset equals `match` (every frame counts when the reading names none). */
export function isEventFrame(reading: Pick<UrtcPanelReading, 'offset' | 'match'>, data: number[]): boolean {
  return reading.match === undefined || data[reading.offset] === reading.match;
}

/** The temperatures of a picture: the bytes of its chunks as signed 16-bit numbers (big-endian) divided by `scale`. */
export function imagePixels(bytes: number[], scale: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    let v = (bytes[i] << 8) | bytes[i + 1];
    if (v & 0x8000) v -= 0x10000;
    out.push(v / scale);
  }
  return out;
}

/** The colour of a pixel: blue at 0 up to red at `max`, held to that range. */
export function heatColor(value: number, max: number): string {
  const clamped = Math.max(0, Math.min(max, value));
  return `hsl(${240 - (clamped / max) * 240}, 90%, 50%)`;
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
