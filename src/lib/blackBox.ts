// The fault recorder ("black box") of the board: put the 22 chunks of its record (0x1A8 / 0x1A9) back together, check the
// record, and export it as CSV or JSON. Same rules as urtc_common.blackbox (the shared vectors check both).
export const BLACK_BOX_QUERY_ID = 0x1A8;
export const BLACK_BOX_CHUNK_ID = 0x1A9;
export const BLACK_BOX_MAGIC = 0x424C4B42;
export const BLACK_BOX_VERSION = 2;
export const BLACK_BOX_SAMPLES = 67;
export const BLACK_BOX_SAMPLE_SIZE = 10;
export const BLACK_BOX_RECORD_SIZE = 4 + 3 + BLACK_BOX_SAMPLES * BLACK_BOX_SAMPLE_SIZE + 1; // 678
export const BLACK_BOX_CHUNK_BYTES = 32;
export const BLACK_BOX_CHUNK_COUNT = Math.ceil(BLACK_BOX_RECORD_SIZE / BLACK_BOX_CHUNK_BYTES); // 22
export const BLACK_BOX_FRAMES_PER_CHUNK = 4;
export const THERMAL_FAULT_NAMES = ["none", "max_temperature", "heating_without_rise", "dropped_at_target"] as const;

export const CSV_COLUMNS = ["index", "tick_ms", "ms_before_last", "tool_id", "current_temperature", "target_temperature", "endstop", "system_error", "thermal_fault", "thermal_fault_name"] as const;

export class BlackBoxError extends Error {}

export interface BlackBoxSample {
  tickMs: number;
  toolId: number;
  currentTemperature: number;
  targetTemperature: number;
  flags: number;
}

export interface BlackBoxRecord {
  version: number;
  sampleCount: number;
  writeIndex: number;
  samples: BlackBoxSample[]; // oldest first
}

export interface BlackBoxRow {
  index: number; tick_ms: number; ms_before_last: number; tool_id: number; current_temperature: number; target_temperature: number;
  endstop: number; system_error: number; thermal_fault: number; thermal_fault_name: string;
}

export function crc8(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
  }
  return crc;
}

export function chunkRequest(index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= BLACK_BOX_CHUNK_COUNT) throw new BlackBoxError(`chunk index ${index} out of range 0..${BLACK_BOX_CHUNK_COUNT - 1}`);
  return [index];
}

export function joinFrames(frames: number[][]): Uint8Array {
  const out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
  let pos = 0;
  for (const f of frames) { out.set(f, pos); pos += f.length; }
  if (out.length !== BLACK_BOX_CHUNK_BYTES) throw new BlackBoxError(`a chunk is ${BLACK_BOX_CHUNK_BYTES} bytes, got ${out.length}`);
  return out;
}

export function parseBlackBox(raw: Uint8Array): BlackBoxRecord {
  if (raw.length < BLACK_BOX_RECORD_SIZE) throw new BlackBoxError(`record is ${BLACK_BOX_RECORD_SIZE} bytes, got ${raw.length}`);
  const bytes = raw.subarray(0, BLACK_BOX_RECORD_SIZE);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== BLACK_BOX_MAGIC) throw new BlackBoxError('no record (magic number does not match)');
  const version = view.getUint8(4);
  if (version !== BLACK_BOX_VERSION) throw new BlackBoxError(`record version ${version}, this reader knows ${BLACK_BOX_VERSION}`);
  if (crc8(bytes.subarray(0, BLACK_BOX_RECORD_SIZE - 1)) !== bytes[BLACK_BOX_RECORD_SIZE - 1]) throw new BlackBoxError('checksum mismatch: the record is damaged');
  const sampleCount = view.getUint8(5);
  const writeIndex = view.getUint8(6);
  if (sampleCount > BLACK_BOX_SAMPLES || writeIndex >= BLACK_BOX_SAMPLES) throw new BlackBoxError('sample count or write index out of range');
  const ring: BlackBoxSample[] = [];
  for (let i = 0; i < BLACK_BOX_SAMPLES; i++) {
    const at = 7 + i * BLACK_BOX_SAMPLE_SIZE;
    ring.push({ tickMs: view.getUint32(at, true), toolId: view.getUint8(at + 4), currentTemperature: view.getUint16(at + 5, true), targetTemperature: view.getUint16(at + 7, true), flags: view.getUint8(at + 9) });
  }
  const samples = sampleCount === BLACK_BOX_SAMPLES ? [...ring.slice(writeIndex), ...ring.slice(0, writeIndex)] : ring.slice(0, sampleCount);
  return { version, sampleCount, writeIndex, samples };
}

export const hasSystemError = (s: BlackBoxSample) => (s.flags & 2) !== 0;
export const thermalFaultOf = (s: BlackBoxSample) => (s.flags >> 2) & 3;

export function triggerIndex(record: BlackBoxRecord): number | null {
  const i = record.samples.findIndex(hasSystemError);
  return i < 0 ? null : i;
}

export function blackBoxRows(record: BlackBoxRecord): BlackBoxRow[] {
  const last = record.samples.length ? record.samples[record.samples.length - 1].tickMs : 0;
  return record.samples.map((s, i) => ({
    index: i, tick_ms: s.tickMs, ms_before_last: ((last - s.tickMs) >>> 0), tool_id: s.toolId,
    current_temperature: s.currentTemperature, target_temperature: s.targetTemperature,
    endstop: s.flags & 1, system_error: hasSystemError(s) ? 1 : 0, thermal_fault: thermalFaultOf(s), thermal_fault_name: THERMAL_FAULT_NAMES[thermalFaultOf(s)],
  }));
}

export function blackBoxCsv(record: BlackBoxRecord): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of blackBoxRows(record)) lines.push(CSV_COLUMNS.map(c => String(row[c])).join(','));
  return lines.join('\n') + '\n';
}

export function blackBoxJson(record: BlackBoxRecord, capturedAt: string | null): string {
  const trigger = triggerIndex(record);
  return JSON.stringify({
    format: 'urtc-blackbox/1', record_version: record.version, captured_at: capturedAt, sample_count: record.sampleCount,
    trigger_index: trigger, trigger_tick_ms: trigger === null ? null : record.samples[trigger].tickMs, samples: blackBoxRows(record),
  }, null, 2) + '\n';
}

/** Fires once for each rising edge of the error flag in the answers to 0x110 (byte 1 of 0x111). */
export class FaultTrigger {
  private wasSet = false;
  feed(payload: number[]): boolean {
    if (payload.length < 2) return false;
    const isSet = payload[1] !== 0;
    const fire = isSet && !this.wasSet;
    this.wasSet = isSet;
    return fire;
  }
  reset() { this.wasSet = false; }
}

// ---- Records saved earlier: open the JSON or CSV this tool wrote, with no board ----------------------------------------------
const intOf = (value: unknown, max: number, what: string): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > max) throw new BlackBoxError(`${what} is not a whole number from 0 to ${max}`);
  return n;
};

function recordFromRows(rows: Array<Record<string, unknown>>): BlackBoxRecord {
  if (rows.length === 0) throw new BlackBoxError('the record holds no samples');
  if (rows.length > BLACK_BOX_SAMPLES) throw new BlackBoxError(`a record holds at most ${BLACK_BOX_SAMPLES} samples, this one has ${rows.length}`);
  const samples = rows.map((row, i): BlackBoxSample => {
    const where = `sample ${i}`;
    const fault = intOf(row.thermal_fault, 3, `${where}: thermal_fault`);
    const error = intOf(row.system_error, 1, `${where}: system_error`);
    const endstop = intOf(row.endstop, 1, `${where}: endstop`);
    return {
      tickMs: intOf(row.tick_ms, 0xFFFFFFFF, `${where}: tick_ms`),
      toolId: intOf(row.tool_id, 255, `${where}: tool_id`),
      currentTemperature: intOf(row.current_temperature, 0xFFFF, `${where}: current_temperature`),
      targetTemperature: intOf(row.target_temperature, 0xFFFF, `${where}: target_temperature`),
      flags: endstop | (error << 1) | (fault << 2),
    };
  });
  return { version: BLACK_BOX_VERSION, sampleCount: samples.length, writeIndex: samples.length % BLACK_BOX_SAMPLES, samples };
}

/** The record in a JSON file written by `blackBoxJson` (format `urtc-blackbox/1`). */
export function blackBoxFromJson(text: string): BlackBoxRecord {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { throw new BlackBoxError('not a JSON file'); }
  if (!doc || typeof doc !== 'object' || (doc as { format?: unknown }).format !== 'urtc-blackbox/1') throw new BlackBoxError('not a urtc-blackbox/1 file');
  const samples = (doc as { samples?: unknown }).samples;
  if (!Array.isArray(samples)) throw new BlackBoxError('the file has no list of samples');
  return recordFromRows(samples as Array<Record<string, unknown>>);
}

/** The record in a CSV file written by `blackBoxCsv` (the header names the columns, in any order). */
export function blackBoxFromCsv(text: string): BlackBoxRecord {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new BlackBoxError('the file has no samples');
  const header = lines[0].split(',').map((h) => h.trim());
  for (const column of CSV_COLUMNS) if (!header.includes(column)) throw new BlackBoxError(`the file has no ${column} column`);
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, unknown> = {};
    header.forEach((name, i) => { row[name] = cells[i]; });
    return row;
  });
  return recordFromRows(rows);
}

/** A saved record of either kind, by what the text looks like. */
export function blackBoxFromText(text: string): BlackBoxRecord {
  return text.trimStart().startsWith('{') ? blackBoxFromJson(text) : blackBoxFromCsv(text);
}

// ---- The chart ----------------------------------------------------------------------------------------------------------------
export interface BlackBoxChart {
  /** SVG `points` of the measured temperature and of the setpoint. */
  current: string;
  target: string;
  /** X of the first sample that carries the error flag, or null. */
  triggerX: number | null;
  minTemperature: number;
  maxTemperature: number;
  /** Length of the record in milliseconds. */
  spanMs: number;
  /** Y of the horizontal grid lines with the temperature they mark. */
  grid: Array<{ y: number; temperature: number }>;
}

/** Scales the samples into a `width` x `height` box with `pad` pixels around it: time runs left to right, temperature bottom to top. */
export function blackBoxChart(record: BlackBoxRecord, width: number, height: number, pad = 8): BlackBoxChart {
  const samples = record.samples;
  const first = samples.length ? samples[0].tickMs : 0;
  const spanMs = samples.length ? ((samples[samples.length - 1].tickMs - first) >>> 0) : 0;
  const temperatures = samples.flatMap((s) => [s.currentTemperature, s.targetTemperature]);
  const low = temperatures.length ? Math.min(...temperatures) : 0;
  const high = temperatures.length ? Math.max(...temperatures) : 0;
  const minTemperature = Math.max(0, Math.floor((low - 5) / 10) * 10);
  const maxTemperature = Math.max(minTemperature + 10, Math.ceil((high + 5) / 10) * 10);
  const x = (tick: number) => pad + (spanMs === 0 ? 0 : (((tick - first) >>> 0) / spanMs) * (width - 2 * pad));
  const y = (temperature: number) => height - pad - ((temperature - minTemperature) / (maxTemperature - minTemperature)) * (height - 2 * pad);
  const points = (pick: (s: BlackBoxSample) => number) => samples.map((s) => `${x(s.tickMs).toFixed(1)},${y(pick(s)).toFixed(1)}`).join(' ');
  const trigger = triggerIndex(record);
  const steps = 4;
  const grid = Array.from({ length: steps + 1 }, (_, i) => {
    const temperature = minTemperature + ((maxTemperature - minTemperature) * i) / steps;
    return { y: y(temperature), temperature: Math.round(temperature) };
  });
  return {
    current: points((s) => s.currentTemperature), target: points((s) => s.targetTemperature),
    triggerX: trigger === null ? null : x(samples[trigger].tickMs), minTemperature, maxTemperature, spanMs, grid,
  };
}
