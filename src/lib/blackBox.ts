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
