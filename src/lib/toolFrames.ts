/**
 * The data bytes of the commands that the tool panels of the tester send, as pure functions.
 *
 * Each function returns the payload of one frame (the identifier stays with the panel, which names it with the constant of `canIds`). A
 * value that does not fit its field is brought to the nearest value that does, never wrapped around into a different command: a speed of
 * 300 is 255, not 44, and a negative number is 0.
 */

import { stepsToBytes } from './toolLimits';

/** One unsigned byte: rounded, and kept between 0 and 255. */
export function byte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Two bytes, big-endian, as every multi-byte value of the bus is. */
export function be16(value: number): [number, number] {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(0xFFFF, Math.round(value))) : 0;
  return [(v >> 8) & 0xFF, v & 0xFF];
}

/** Soldering iron set point in degrees; `solderOff` is the same frame with the heater off. */
export const solderSetpoint = (celsius: number): number[] => be16(celsius);
export const solderOff = (): number[] => [0, 0];

/** Drill: speed (0 to 255) and the direction (`ccw` is 1, anything else 0). */
export const drillCommand = (speed: number, direction: 'cw' | 'ccw'): number[] => [byte(speed), direction === 'ccw' ? 1 : 0];
export const drillStop = (): number[] => [0, 0];

/** Inspection ring: mode byte and the period in milliseconds. */
export const aoiRingCommand = (mode: number, periodMs: number): number[] => [byte(mode), ...be16(periodMs)];

/** Laser: power and the interlock flag. */
export const laserCommand = (power: number, interlock: boolean): number[] => [byte(power), interlock ? 1 : 0];
export const laserOff = (): number[] => [0, 0];

/** The two fans of the 3D printer head and the UV lamp take one power byte. */
export const powerByte = (power: number): number[] => [byte(power)];
export const powerOff = (): number[] => [0];

/** Electromagnet: 1 on, 0 off. */
export const electromagnetCommand = (on: boolean): number[] => [on ? 1 : 0];

/** Hot air: set point (degrees) and the blower. */
export const hotAirCommand = (celsius: number, blower: number): number[] => [...be16(celsius), byte(blower)];
export const hotAirOff = (): number[] => [0, 0, 0];

/** A stepper move (feeder, extruder, axes): the direction and the number of steps in four bytes (a count that does not fit is an error, never a different move). */
export const motionMove = (forward: boolean, steps: number): number[] => [forward ? 1 : 0, ...stepsToBytes(steps)];
export const motionStop = (forward: boolean): number[] => [forward ? 1 : 0, 0, 0, 0, 0];

/** Global controls (0x100): the status LED, the OLED mode and the ring LED. Each colour component is one byte. */
export type OledMode = 'standard' | 'night' | 'standby';
export const OLED_MODE_BYTE: Record<OledMode, number> = { standard: 0x00, night: 0x01, standby: 0x0F };
export type Rgb = { r: number; g: number; b: number };
export const statusLedCommand = (status: Rgb, oled: OledMode, ring: Rgb, ringOn: boolean): number[] =>
  [byte(status.r), byte(status.g), byte(status.b), OLED_MODE_BYTE[oled], byte(ring.r), byte(ring.g), byte(ring.b), ringOn ? 1 : 0];

/** Expansion SPI passthrough: the number of bytes, then up to seven bytes to shift out. */
export function spiPassthrough(values: number[]): number[] {
  const bytes = values.slice(0, 7).map(byte);
  return [bytes.length, ...bytes];
}

/** Optional functions: the magic word ("FEAT") followed by the mask of the four functions. */
export const FEATURES_MAGIC = [0x46, 0x45, 0x41, 0x54];
export const featuresWrite = (mask: number): number[] => [...FEATURES_MAGIC, byte(mask) & 0x0F];

/** 3D printer head: nozzle set point, extruder direction and a 24-bit step count in one frame. */
export function thermalMotionCommand(celsius: number, forward: boolean, steps: number): number[] {
  const s = Number.isFinite(steps) ? Math.max(0, Math.min(0xFFFFFF, Math.round(steps))) : 0;
  return [...be16(celsius), forward ? 1 : 0, (s >> 16) & 0xFF, (s >> 8) & 0xFF, s & 0xFF];
}

/** A weld pulse: the fire flag and the length in milliseconds, held between 1 and `maxMs`. */
export function weldFire(pulseMs: number, maxMs: number): number[] {
  const ms = Number.isFinite(pulseMs) ? Math.max(1, Math.min(maxMs, Math.round(pulseMs))) : 1;
  return [1, ...be16(ms)];
}

/** Paste jetting: the channel with its frequency, and one pulse (channel, duty, length in milliseconds). */
export const pasteJettingConfig = (channel: number, hertz: number): number[] => [byte(channel), ...be16(hertz)];
export const pasteJettingPulse = (channel: number, duty: number, pulseMs: number): number[] => [byte(channel), byte(duty), byte(pulseMs)];
