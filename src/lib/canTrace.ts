// The trace viewer: reads a recorded CAN trace (the PCAN-View .trc and Vector .asc files that lib/traceExport.ts writes and
// that the tester records), names every frame with the layouts of the specification (generated/urtcCanIds.ts), marks the
// refusals and the odd things in the recording, filters and sorts the rows, and writes the selection as CSV or JSON.
// Pure functions only: no React, no clock, no network and nothing in the file is ever run, it is only read as text.

import {
  LAYOUTS, dlcAllows, decode, mnSplitId, STATUS_ERROR, STATUS_VERIFY_FAIL, STATUS_VERIFY_OK,
  MN_STATE_CONFLICT, MN_STATE_FAULT, RACK_ID_REPLY, type Layout,
} from './generated/urtcCanIds';
import { RACK_REPLY_REASONS } from './rackSim';
import { TOOL_NAMES } from './canIds';

/** Biggest file the viewer reads: the whole text is kept in the memory of the tab. */
export const MAX_TRACE_BYTES = 5 * 1024 * 1024;
/** Most frames the viewer keeps; the lines after them are counted and left out. */
export const MAX_TRACE_ROWS = 200_000;
/** A line longer than this is not a frame of any of the two formats and is not looked at. */
export const MAX_LINE_CHARS = 200;
/** How many refused lines are listed one by one (all of them are counted). */
export const MAX_LISTED_PROBLEMS = 50;

/** The values that decide what is marked as odd. They are the defaults of the boxes of the page, not constants of the code that reads. */
export interface TraceSettings {
  /** Two identical frames (same identifier, direction and data) at most this far apart are marked as a duplicate. */
  duplicateWindowMs: number;
  /** A silence longer than this before a frame is marked as a gap. */
  gapMs: number;
  /** Identifiers, besides the standard one (0x261, RACK_ID_REPLY), that a bench used to carry the reply of the rack (three bytes: command, tool, reason code). Advanced: empty by default. */
  rackReplyIds: number[];
}

export const DEFAULT_TRACE_SETTINGS: Readonly<TraceSettings> = { duplicateWindowMs: 1, gapMs: 1000, rackReplyIds: [] };

export type TraceDirection = 'Rx' | 'Tx';
export type TraceType = 'request' | 'response' | 'reply' | 'unknown';
export type TraceResult = 'ok' | 'refused' | 'fault' | 'malformed' | 'info';
export type TraceAnomaly = 'short_dlc' | 'bad_length' | 'duplicate' | 'reordered' | 'gap';

export const TRACE_TYPES: readonly TraceType[] = ['request', 'response', 'reply', 'unknown'];
export const TRACE_RESULTS: readonly TraceResult[] = ['ok', 'refused', 'fault', 'malformed', 'info'];
export const TRACE_ANOMALIES: readonly TraceAnomaly[] = ['short_dlc', 'bad_length', 'duplicate', 'reordered', 'gap'];

export interface TraceRow {
  /** Position in the file among the frames, from 1. */
  index: number;
  /** Line of the file, from 1. */
  line: number;
  /** Milliseconds after the first frame of the file (negative when a later line is older: that is what 'reordered' marks). */
  timeMs: number;
  direction: TraceDirection;
  id: number;
  idHex: string;
  /** The length the file says. */
  dlc: number;
  data: number[];
  dataHex: string;
  /** The layout that reads the frame, or '' when the identifier is not in the specification. */
  name: string;
  type: TraceType;
  /** Address of the node for the frames of the multinode extension, otherwise null. */
  node: number | null;
  /** Tool the frame names (the active tool answer and the free tool frames), otherwise null. */
  tool: number | null;
  result: TraceResult;
  anomalies: TraceAnomaly[];
  /** The fields of the frame as `name=value` text, or the reason a frame was refused. */
  summary: string;
}

export interface TraceProblem { line: number; reason: string }

export interface TraceLoad {
  format: 'trc' | 'asc' | 'unknown';
  rows: TraceRow[];
  /** Lines that looked like a frame and were refused (the first MAX_LISTED_PROBLEMS are listed). */
  problems: TraceProblem[];
  problemCount: number;
  /** Frames after the limit that were left out. */
  omitted: number;
  /** The text was bigger than MAX_TRACE_BYTES and was not read at all. */
  tooBig: boolean;
}

const TRC_ROW = /^\s*\d+\)\s+([0-9.]+)\s+(Rx|Tx)\s+([0-9A-Fa-f]+)\s+(\d+)\s*([0-9A-Fa-f ]*)$/;
const ASC_ROW = /^\s*([0-9.]+)\s+\d+\s+([0-9A-Fa-f]+)\s+(Rx|Tx)\s+d\s+(\d+)\s*([0-9A-Fa-f ]*)$/;
// Lines of the Vector header and footer: they are not frames and are not a problem either.
const ASC_META = /^\s*(date|base|no internal events|internal events|begin triggerblock|end triggerblock|\/\/)/i;

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const bytesHex = (data: number[]) => data.map(hex2).join(' ');
export const formatId = (id: number) => `0x${id.toString(16).toUpperCase().padStart(3, '0')}`;

const ROLE_TYPE: Record<string, TraceType> = { request: 'request', response: 'response' };
const LAYOUTS_BY_ID = new Map<number, Array<[string, Layout]>>();
for (const [name, layout] of Object.entries(LAYOUTS)) {
  const list = LAYOUTS_BY_ID.get(layout.id) ?? [];
  list.push([name, layout]);
  LAYOUTS_BY_ID.set(layout.id, list);
}

const layoutFloor = (rule: Layout['dlc']): number => rule.exact ?? (rule.one_of ? Math.min(...rule.one_of) : rule.min ?? 0);

function fieldsText(fields: Record<string, number | number[] | null>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? bytesHex(v) : v}`)
    .join(' ');
}

const toolOf = (selection: unknown): number | null => (typeof selection === 'number' && selection >= 1 && selection <= 25 ? selection - 1 : null);

interface Decoded { name: string; type: TraceType; node: number | null; tool: number | null; result: TraceResult; anomalies: TraceAnomaly[]; summary: string }

/** What the specification says a frame is. `direction` picks between a request and an answer that share an identifier. */
export function decodeTraceFrame(id: number, data: number[], declaredDlc: number, direction: TraceDirection, settings: Pick<TraceSettings, 'rackReplyIds'> = DEFAULT_TRACE_SETTINGS): Decoded {
  const anomalies: TraceAnomaly[] = [];
  const shortDeclared = data.length < declaredDlc;
  if (shortDeclared) anomalies.push('short_dlc');
  const split = mnSplitId(id);
  const node = split && split[1] !== null ? split[1] : null;

  if (id === RACK_ID_REPLY || (settings.rackReplyIds.includes(id) && !LAYOUTS_BY_ID.has(id))) {   // 0x261 has a layout in the specification but is read as the reply, with its reason
    if (data.length !== 3) {
      if (!anomalies.includes('short_dlc') && data.length < 3) anomalies.push('short_dlc'); else if (data.length > 3) anomalies.push('bad_length');
      return { name: 'rack_reply', type: 'reply', node, tool: null, result: 'malformed', anomalies, summary: 'a reply of the rack has three bytes' };
    }
    const code = data[2];
    const reason = RACK_REPLY_REASONS[code];
    if (!reason) return { name: 'rack_reply', type: 'reply', node, tool: null, result: 'malformed', anomalies, summary: `command=${data[0]} tool=${data[1]} reason code ${code} is not defined` };
    const accepted = code < 2;
    return { name: 'rack_reply', type: 'reply', node, tool: data[1] <= 24 ? data[1] : null, result: accepted ? 'ok' : 'refused', anomalies, summary: `command=${data[0]} tool=${data[1]} reason=${reason}` };
  }

  // The frames of an addressed range (one identifier per node) are described once, at the base of the range.
  const candidates = LAYOUTS_BY_ID.get(node === null ? id : id - node) ?? [];
  if (candidates.length === 0) {
    return { name: '', type: 'unknown', node, tool: null, result: 'info', anomalies, summary: '' };
  }
  const wantRole = direction === 'Tx' ? 'request' : 'response';
  const ordered = [...candidates.filter(([, l]) => l.role === wantRole), ...candidates.filter(([, l]) => l.role !== wantRole)];
  // A query takes any length in its layout; in a file where every frame is received, it is only taken for an empty frame, so a short answer is not mistaken for one.
  const hit = ordered.find(([, l]) => dlcAllows(l.dlc, data.length) && (l.role === wantRole || !l.dlc.any || data.length === 0));
  if (!hit) {
    const [name, layout] = ordered[0];
    const shortOfSpec = data.length < Math.min(...ordered.map(([, l]) => layoutFloor(l.dlc)));
    anomalies.push(shortOfSpec ? 'short_dlc' : 'bad_length');
    return {
      name, type: ROLE_TYPE[layout.role] ?? 'unknown', node, tool: null, result: 'malformed', anomalies: [...new Set(anomalies)],
      summary: `${data.length} bytes do not fit ${name}`,
    };
  }
  const [name, layout] = hit;
  const fields = decode(name, data, false) ?? {};
  let result: TraceResult = 'info';
  let tool: number | null = null;
  let summary = fieldsText(fields);
  if (name === 'status') {
    const status = fields.status as number;
    result = status === STATUS_VERIFY_FAIL || status === STATUS_ERROR ? 'refused' : status === STATUS_VERIFY_OK ? 'ok' : 'info';
  } else if (name === 'active_tool_resp') {
    tool = fields.tool_id as number;
    if (fields.system_error === 1 || fields.can_error === 1) result = 'fault';
  } else if (name === 'mn_node_status') {
    const state = fields.state as number;
    if (state & (MN_STATE_FAULT | MN_STATE_CONFLICT) || fields.error !== 0) result = 'fault';
  } else if (name === 'free_tool_config_resp_response') {
    const valid = fields.jumper_reading === 0x1f && toolOf(fields.selection) !== null;
    tool = valid ? toolOf(fields.selection) : null;
    result = valid ? 'ok' : 'refused';
    if (!valid) summary += ' (not a valid free tool answer)';
  } else if (name === 'set_free_tool') {
    tool = toolOf(fields.selection);
  }
  if (tool !== null && TOOL_NAMES[tool]) summary += `${summary ? ' ' : ''}[${TOOL_NAMES[tool]}]`;
  return { name, type: ROLE_TYPE[layout.role] ?? 'unknown', node, tool, result, anomalies, summary };
}

function bytesOf(text: string): number[] | null {
  const compact = text.replace(/\s+/g, '');
  if (compact.length % 2 !== 0) return null;
  const out: number[] = [];
  for (let i = 0; i < compact.length; i += 2) out.push(parseInt(compact.slice(i, i + 2), 16));
  return out;
}

/** Reads the text of a .trc or .asc file. Both directions are kept, in the order of the file, and nothing is sorted. */
export function parseCanTrace(text: string, settings: TraceSettings = DEFAULT_TRACE_SETTINGS): TraceLoad {
  const load: TraceLoad = { format: 'unknown', rows: [], problems: [], problemCount: 0, omitted: 0, tooBig: false };
  if (text.length > MAX_TRACE_BYTES) { load.tooBig = true; return load; }
  const problem = (line: number, reason: string) => {
    load.problemCount++;
    if (load.problems.length < MAX_LISTED_PROBLEMS) load.problems.push({ line, reason });
  };
  const lines = text.split(/\r?\n/);
  let origin: number | null = null;
  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    const line = n + 1;
    if (raw.trim() === '' || raw.startsWith(';') || ASC_META.test(raw.slice(0, 40))) continue;
    if (raw.length > MAX_LINE_CHARS) { problem(line, 'line_too_long'); continue; }
    let timeMs: number; let direction: string; let idText: string; let dlcText: string; let dataText: string;
    const trc = TRC_ROW.exec(raw);
    if (trc) {
      if (load.format === 'unknown') load.format = 'trc';
      timeMs = parseFloat(trc[1]);
      [direction, idText, dlcText, dataText] = [trc[2], trc[3], trc[4], trc[5]];
    } else {
      const asc = ASC_ROW.exec(raw);
      if (!asc) { problem(line, 'not_a_frame'); continue; }
      if (load.format === 'unknown') load.format = 'asc';
      timeMs = parseFloat(asc[1]) * 1000;
      [idText, direction, dlcText, dataText] = [asc[2], asc[3], asc[4], asc[5]];
    }
    const data = bytesOf(dataText);
    const dlc = parseInt(dlcText, 10);
    const id = idText.length <= 8 ? parseInt(idText, 16) : Number.NaN;
    if (!Number.isFinite(timeMs)) { problem(line, 'bad_time'); continue; }
    if (!(id >= 0 && id <= 0x7ff)) { problem(line, 'id_out_of_range'); continue; }
    if (!(dlc <= 8)) { problem(line, 'dlc_out_of_range'); continue; }
    if (data === null) { problem(line, 'bad_data'); continue; }
    if (data.length > dlc) { problem(line, 'data_longer_than_dlc'); continue; }
    if (load.rows.length >= MAX_TRACE_ROWS) { load.omitted++; continue; }
    if (origin === null) origin = timeMs;
    const d = decodeTraceFrame(id, data, dlc, direction as TraceDirection, settings);
    load.rows.push({
      index: load.rows.length + 1, line, timeMs: timeMs - origin, direction: direction as TraceDirection, id, idHex: formatId(id), dlc, data, dataHex: bytesHex(data),
      name: d.name, type: d.type, node: d.node, tool: d.tool, result: d.result, anomalies: d.anomalies, summary: d.summary,
    });
  }
  markSequenceAnomalies(load.rows, settings);
  return load;
}

/** Duplicates, frames older than the one before and silences: they depend on the neighbours, so they are marked after the rows are read. */
export function markSequenceAnomalies(rows: TraceRow[], settings: Pick<TraceSettings, 'duplicateWindowMs' | 'gapMs'> = DEFAULT_TRACE_SETTINGS): void {
  const lastOfId = new Map<string, TraceRow>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const add = (a: TraceAnomaly) => { if (!row.anomalies.includes(a)) row.anomalies.push(a); };
    if (i > 0) {
      const gap = row.timeMs - rows[i - 1].timeMs;
      if (gap < 0) add('reordered');
      else if (gap > settings.gapMs) add('gap');
    }
    const key = `${row.id}:${row.direction}`;
    const previous = lastOfId.get(key);
    if (previous && previous.dataHex === row.dataHex && previous.dlc === row.dlc && Math.abs(row.timeMs - previous.timeMs) <= settings.duplicateWindowMs) add('duplicate');
    lastOfId.set(key, row);
  }
}

// --- filters and order ---

export interface TraceFilter {
  /** Identifiers as typed ("0x1A2, 7f5"); nothing readable means all. */
  ids?: string;
  types?: TraceType[];
  results?: TraceResult[];
  directions?: TraceDirection[];
  /** A node address; null means "frames without a node". Undefined means any. */
  node?: number | null;
  /** Only the rows with this mark, or any mark when 'any'. */
  anomaly?: TraceAnomaly | 'any';
  fromMs?: number;
  toMs?: number;
  /** Case-insensitive text found in the identifier, the name, the data or the summary. */
  text?: string;
}

/** The identifiers in a box: separated by spaces or commas, `0x` allowed. What cannot be read is returned apart and ignored. */
export function parseIdList(text: string): { ids: number[]; unreadable: string[] } {
  const ids: number[] = [];
  const unreadable: string[] = [];
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const body = token.replace(/^0x/i, '');
    const value = /^[0-9a-f]{1,3}$/i.test(body) ? parseInt(body, 16) : Number.NaN;
    if (value >= 0 && value <= 0x7ff) ids.push(value); else unreadable.push(token.slice(0, 20));
  }
  return { ids, unreadable };
}

export function filterRows(rows: TraceRow[], filter: TraceFilter): TraceRow[] {
  const wanted = filter.ids ? new Set(parseIdList(filter.ids).ids) : null;
  const text = filter.text?.trim().toLowerCase() ?? '';
  return rows.filter((r) => {
    if (wanted && wanted.size > 0 && !wanted.has(r.id)) return false;
    if (filter.types && filter.types.length > 0 && !filter.types.includes(r.type)) return false;
    if (filter.results && filter.results.length > 0 && !filter.results.includes(r.result)) return false;
    if (filter.directions && filter.directions.length > 0 && !filter.directions.includes(r.direction)) return false;
    if (filter.node !== undefined && r.node !== filter.node) return false;
    if (filter.anomaly === 'any' && r.anomalies.length === 0) return false;
    if (filter.anomaly && filter.anomaly !== 'any' && !r.anomalies.includes(filter.anomaly)) return false;
    if (filter.fromMs !== undefined && Number.isFinite(filter.fromMs) && r.timeMs < filter.fromMs) return false;
    if (filter.toMs !== undefined && Number.isFinite(filter.toMs) && r.timeMs > filter.toMs) return false;
    if (text && !`${r.idHex} ${r.name} ${r.dataHex} ${r.summary}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

export type TraceSortKey = 'index' | 'time' | 'id' | 'name' | 'type' | 'node' | 'result' | 'dlc';

/** A new array in the order asked; equal rows keep the order of the file. */
export function sortRows(rows: TraceRow[], key: TraceSortKey, descending = false): TraceRow[] {
  const value = (r: TraceRow): number | string => {
    switch (key) {
      case 'time': return r.timeMs;
      case 'id': return r.id;
      case 'name': return r.name;
      case 'type': return r.type;
      case 'node': return r.node ?? -1;
      case 'result': return r.result;
      case 'dlc': return r.dlc;
      default: return r.index;
    }
  };
  const sign = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a); const y = value(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en');
    return c !== 0 ? sign * c : a.index - b.index;
  });
}

// --- summary and timeline ---

export interface TraceSummary { frames: number; refused: number; faults: number; malformed: number; flagged: number; durationMs: number }

export function summarizeRows(rows: TraceRow[]): TraceSummary {
  let min = Infinity; let max = -Infinity;
  const s: TraceSummary = { frames: rows.length, refused: 0, faults: 0, malformed: 0, flagged: 0, durationMs: 0 };
  for (const r of rows) {
    if (r.result === 'refused') s.refused++;
    if (r.result === 'fault') s.faults++;
    if (r.result === 'malformed') s.malformed++;
    if (r.anomalies.length > 0) s.flagged++;
    if (r.timeMs < min) min = r.timeMs;
    if (r.timeMs > max) max = r.timeMs;
  }
  s.durationMs = rows.length > 0 ? max - min : 0;
  return s;
}

export interface TimelineBucket { fromMs: number; toMs: number; count: number; refused: number; flagged: number }

/** The recording cut into equal parts of time, with how many frames, refusals and marked frames fall in each. */
export function timelineBuckets(rows: TraceRow[], buckets = 60): TimelineBucket[] {
  if (rows.length === 0 || buckets < 1) return [];
  let min = Infinity; let max = -Infinity;
  for (const r of rows) { if (r.timeMs < min) min = r.timeMs; if (r.timeMs > max) max = r.timeMs; }
  const span = max - min;
  const width = span > 0 ? span / buckets : 1;
  const out: TimelineBucket[] = Array.from({ length: buckets }, (_, i) => ({ fromMs: min + i * width, toMs: min + (i + 1) * width, count: 0, refused: 0, flagged: 0 }));
  for (const r of rows) {
    const i = Math.min(buckets - 1, Math.floor((r.timeMs - min) / width));
    out[i].count++;
    if (r.result === 'refused' || r.result === 'fault') out[i].refused++;
    if (r.anomalies.length > 0) out[i].flagged++;
  }
  return out;
}

// --- export ---

export const TRACE_CSV_COLUMNS = ['index', 'line', 'time_ms', 'direction', 'id', 'dlc', 'data', 'name', 'type', 'node', 'tool', 'result', 'anomalies', 'summary'] as const;

/** A cell that a spreadsheet would read as a formula gets a quote in front, and a cell with a separator, a quote or a line break is quoted. */
export function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // A number written as text (the time) stays a number: only a minus that does not start a plain number counts as a formula.
  if (typeof value === 'string' && (/^[=+@\t\r]/.test(text) || (text.startsWith('-') && !/^-\d+(\.\d+)?$/.test(text)))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowFields(r: TraceRow): Array<string | number | null> {
  return [r.index, r.line, r.timeMs.toFixed(3), r.direction, r.idHex, r.dlc, r.dataHex, r.name, r.type, r.node, r.tool, r.result, r.anomalies.join(' '), r.summary];
}

/** The rows as CSV with a header line. The same rows give the same text: nothing about the moment of the export is in it. */
export function traceCsv(rows: TraceRow[]): string {
  return [TRACE_CSV_COLUMNS.join(','), ...rows.map((r) => rowFields(r).map(csvCell).join(','))].join('\n') + '\n';
}

export const TRACE_JSON_FORMAT = 'urtc-trace-view/1';

/** The rows as JSON with a fixed order of keys. `source` is the name of the file read, cut to 120 characters. */
export function traceJson(rows: TraceRow[], source = ''): string {
  const body = {
    format: TRACE_JSON_FORMAT,
    source: source.slice(0, 120),
    frames: rows.length,
    rows: rows.map((r) => ({
      index: r.index, line: r.line, time_ms: Number(r.timeMs.toFixed(3)), direction: r.direction, id: r.idHex, dlc: r.dlc, data: r.dataHex, name: r.name,
      type: r.type, node: r.node, tool: r.tool, result: r.result, anomalies: [...r.anomalies], summary: r.summary,
    })),
  };
  return JSON.stringify(body, null, 2) + '\n';
}
