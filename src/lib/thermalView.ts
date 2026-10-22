// What a panel needs to show the thermal inspection tool of the head (tool 22, 0x250 to 0x255): the chunks put back together, the image
// in false colour (the ramp of URTC-VISION-TOOL) and the statistics of a region. Same rules as urtc_common.thermal_view.
export const THERMAL_TRIGGER_ID = 0x250;
export const THERMAL_STATUS_ID = 0x251;
export const THERMAL_CALIBRATED_REQUEST_ID = 0x254;
export const THERMAL_CALIBRATED_CHUNK_ID = 0x255;
export const THERMAL_PIXELS_PER_CHUNK = 16;
export const THERMAL_FRAMES_PER_CHUNK = 4;
export const THERMAL_SHAPES: Record<string, [number, number]> = { '90640': [32, 24], '90641': [16, 12], '90642': [32, 24] };
const MIN_SPAN_C = 1.0;
export const INVALID_COLOR: [number, number, number] = [255, 0, 255];
const STOPS: Array<[number, [number, number, number]]> = [[0, [0, 0, 0]], [0.33, [0, 0, 255]], [0.66, [255, 0, 0]], [0.85, [255, 255, 0]], [1, [255, 255, 255]]];

export class ThermalError extends Error {}

export type ThermalFrame = number[][]; // rows of degrees C; NaN for a pixel without a value

export function thermalChunkCount(variant: string): number {
  const shape = THERMAL_SHAPES[variant];
  if (!shape) throw new ThermalError(`unknown sensor variant ${variant}`);
  return (shape[0] * shape[1]) / THERMAL_PIXELS_PER_CHUNK;
}

export function decodeThermalChunk(data: ArrayLike<number>): number[] {
  if (data.length !== THERMAL_FRAMES_PER_CHUNK * 8) throw new ThermalError('a chunk is 32 bytes (four frames of eight)');
  const out: number[] = [];
  for (let i = 0; i < 16; i++) {
    const raw = (data[i * 2] << 8) | data[i * 2 + 1];
    out.push((raw >= 0x8000 ? raw - 0x10000 : raw) / 100);
  }
  return out;
}

export function assembleThermal(chunks: Map<number, ArrayLike<number>>, variant = '90640'): ThermalFrame {
  const [width, height] = THERMAL_SHAPES[variant] ?? (() => { throw new ThermalError(`unknown sensor variant ${variant}`); })();
  const count = thermalChunkCount(variant);
  for (let i = 0; i < count; i++) if (!chunks.has(i)) throw new ThermalError(`chunk ${i} missing`);
  const flat: number[] = [];
  for (let i = 0; i < count; i++) flat.push(...decodeThermalChunk(chunks.get(i)!));
  return Array.from({ length: height }, (_, y) => flat.slice(y * width, (y + 1) * width));
}

export function syntheticThermalFrame(width = 32, height = 24): ThermalFrame {
  const cx = width / 2, cy = height / 2;
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    Math.round((24 + 55 * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * (width / 4) ** 2)))) * 100) / 100));
}

const finite = (v: number) => Number.isFinite(v);

export function thermalScale(frame: ThermalFrame, range?: [number, number] | null): [number, number] {
  if (range) {
    if (!(range[1] > range[0])) throw new ThermalError('the range must have high above low');
    return [range[0], range[1]];
  }
  const values = frame.flat().filter(finite);
  if (!values.length) return [0, MIN_SPAN_C];
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < MIN_SPAN_C) { const mid = (hi + lo) / 2; lo = mid - MIN_SPAN_C / 2; hi = mid + MIN_SPAN_C / 2; }
  return [lo, hi];
}

export function thermalColor(value: number, lo: number, hi: number): [number, number, number] {
  if (!finite(value)) return INVALID_COLOR;
  const norm = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  let color: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1];
    if (t0 <= norm && norm <= t1) {
      const local = (norm - t0) / (t1 - t0);
      color = [0, 1, 2].map(k => Math.trunc(c0[k] + (c1[k] - c0[k]) * local)) as [number, number, number];
    }
  }
  return color;
}

/** R, G, B bytes row after row. */
export function thermalRgb(frame: ThermalFrame, range?: [number, number] | null): number[] {
  const [lo, hi] = thermalScale(frame, range);
  return frame.flatMap(row => row.flatMap(v => thermalColor(v, lo, hi)));
}

export interface RegionStats { minimum: number; maximum: number; mean: number; pixels: number; invalid: number }

export function thermalRegionStats(frame: ThermalFrame, x0: number, y0: number, x1: number, y1: number): RegionStats | null {
  const height = frame.length, width = height ? frame[0].length : 0;
  if (!(x0 >= 0 && x0 < x1 && x1 <= width && y0 >= 0 && y0 < y1 && y1 <= height)) throw new ThermalError('the region is outside the image or empty');
  const values: number[] = [];
  let invalid = 0;
  for (const row of frame.slice(y0, y1)) for (const v of row.slice(x0, x1)) (finite(v) ? values.push(v) : invalid++);
  if (!values.length) return null;
  return { minimum: Math.min(...values), maximum: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length, pixels: values.length, invalid };
}
