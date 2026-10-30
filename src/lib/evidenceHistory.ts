/**
 * The history of the evidence the programs wrote: records of the shape `urtc-evidence/1` read from files, checked and listed.
 *
 * The flasher, the tester and the updater leave these records; this is the same view of them that the programs have on the command line. A record is
 * checked as the common code checks it: the format, the fields, the shape of each value and the digest, so one edited after it was written is listed as not
 * valid, with what is wrong, and never trusted. Nothing here touches the network or changes a file.
 */

export const EVIDENCE_FORMAT = 'urtc-evidence/1';
export const EVIDENCE_KINDS = ['flash', 'test', 'install', 'session'] as const;
export const EVIDENCE_OUTCOMES = ['pass', 'fail', 'error', 'skipped'] as const;
const FIELDS = ['format', 'kind', 'outcome', 'timestamp_utc', 'tool', 'tool_version', 'operator', 'subject', 'transport', 'artifacts', 'detail', 'evidence_sha256'];
const SUBJECT_FIELDS = ['name', 'hardware_id', 'version_before', 'version_after', 'commit_before', 'commit_after', 'key_id'];
const TRANSPORT_FIELDS = ['adapter', 'bus', 'bitrate'];
const ARTIFACT_FIELDS = ['name', 'sha256', 'bytes'];
const DETAIL_LIMIT = 500;
const SHA256 = /^[0-9a-f]{64}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const HARDWARE_ID = /^0x[0-9A-F]{8}$/;
const VERSION = /^\d+(?:\.\d+){1,3}$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const KEY_ID = /^[0-9a-f]{8,64}$/;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface EvidenceEntry {
  file: string;
  /** The line of a `.jsonl` file (1-based); 0 for a file that holds one record. */
  line: number;
  record: { [key: string]: Json };
  problems: string[];
  valid: boolean;
  time: string;
}

/** The text a digest is made of: the record without its own digest, keys sorted at every level, no spaces (the same text the common code hashes). */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function evidenceDigest(record: { [key: string]: Json }): Promise<string> {
  const body: { [key: string]: Json } = {};
  for (const key of Object.keys(record)) if (key !== 'evidence_sha256') body[key] = record[key];
  return sha256Hex(canonicalJson(body));
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const matches = (re: RegExp) => (v: unknown) => typeof v === 'string' && re.test(v);

function checkGroup(name: string, value: unknown, allowed: string[], rules: { [key: string]: (v: unknown) => boolean }, problems: string[]) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) { problems.push(`${name} must be a non-empty object`); return; }
  for (const [key, item] of Object.entries(value as { [key: string]: unknown })) {
    if (!allowed.includes(key)) problems.push(`${name}.${key} is not a field of ${EVIDENCE_FORMAT}`);
    else if (rules[key] && !rules[key](item)) problems.push(`${name}.${key} is not valid`);
  }
}

/** Everything that is wrong with a record; an empty list means it is well formed and its digest matches. */
export async function verifyEvidence(record: unknown): Promise<string[]> {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) return ['a record is a JSON object'];
  const r = record as { [key: string]: Json };
  const problems: string[] = [];
  if (r.format !== EVIDENCE_FORMAT) problems.push(`format must be '${EVIDENCE_FORMAT}'`);
  for (const key of Object.keys(r)) if (!FIELDS.includes(key)) problems.push(`${key} is not a field of ${EVIDENCE_FORMAT}`);
  if (!(EVIDENCE_KINDS as readonly unknown[]).includes(r.kind)) problems.push(`kind must be one of ${EVIDENCE_KINDS.join(', ')}`);
  if (!(EVIDENCE_OUTCOMES as readonly unknown[]).includes(r.outcome)) problems.push(`outcome must be one of ${EVIDENCE_OUTCOMES.join(', ')}`);
  if (!(typeof r.timestamp_utc === 'string' && TIME.test(r.timestamp_utc))) problems.push('timestamp_utc must be an ISO 8601 time with Z or an offset');
  for (const key of ['tool', 'tool_version']) if (!isText(r[key])) problems.push(`${key} must be a non-empty text`);
  for (const key of ['operator', 'detail']) if (key in r && typeof r[key] !== 'string') problems.push(`${key} must be a text`);
  if (typeof r.detail === 'string' && r.detail.length > DETAIL_LIMIT) problems.push(`detail is longer than ${DETAIL_LIMIT} characters`);
  if ('subject' in r) {
    checkGroup('subject', r.subject, SUBJECT_FIELDS, {
      name: isText, hardware_id: matches(HARDWARE_ID), version_before: matches(VERSION), version_after: matches(VERSION),
      commit_before: matches(COMMIT), commit_after: matches(COMMIT), key_id: matches(KEY_ID),
    }, problems);
  }
  if ('transport' in r) checkGroup('transport', r.transport, TRANSPORT_FIELDS, { adapter: isText, bus: isText, bitrate: (v) => isInt(v) && v > 0 }, problems);
  if ('artifacts' in r) {
    const items = r.artifacts;
    if (!Array.isArray(items) || items.length === 0) problems.push('artifacts must be a non-empty list');
    else {
      items.forEach((item, index) => {
        checkGroup(`artifacts[${index}]`, item, ARTIFACT_FIELDS, { name: isText, sha256: matches(SHA256), bytes: (v) => isInt(v) && v >= 0 }, problems);
        if (item !== null && typeof item === 'object' && !Array.isArray(item) && !('name' in item && 'sha256' in item)) problems.push(`artifacts[${index}] needs a name and a sha256`);
      });
    }
  }
  const declared = r.evidence_sha256;
  if (!(typeof declared === 'string' && SHA256.test(declared))) problems.push('evidence_sha256 must be 64 lowercase hexadecimal digits');
  else if (problems.length === 0 && declared !== await evidenceDigest(r)) problems.push('evidence_sha256 does not match the record (edited after it was written?)');
  return problems;
}

async function entryOf(file: string, line: number, text: string): Promise<EvidenceEntry> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (error) {
    return { file, line, record: {}, problems: [`not JSON: ${error instanceof Error ? error.message : String(error)}`], valid: false, time: '' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { file, line, record: {}, problems: ['a record is a JSON object'], valid: false, time: '' };
  const record = parsed as { [key: string]: Json };
  const problems = await verifyEvidence(record);
  return { file, line, record, problems, valid: problems.length === 0, time: typeof record.timestamp_utc === 'string' ? record.timestamp_utc : '' };
}

/** The records of one file: a `.jsonl` file holds one per line, anything else one in all. */
export async function parseEvidenceFile(name: string, text: string): Promise<EvidenceEntry[]> {
  if (name.toLowerCase().endsWith('.jsonl')) {
    const out: EvidenceEntry[] = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length && i < 100_000; i++) if (lines[i].trim()) out.push(await entryOf(name, i + 1, lines[i]));
    return out;
  }
  return [await entryOf(name, 0, text)];
}

export interface EvidenceFilter { kind?: string; outcome?: string; tool?: string; since?: string; until?: string; text?: string; onlyInvalid?: boolean }

/** The entries that match every given condition, newest first. */
export function selectEvidence(entries: EvidenceEntry[], filter: EvidenceFilter = {}): EvidenceEntry[] {
  const needle = filter.text?.toLowerCase();
  const chosen = entries.filter(entry => {
    const r = entry.record;
    if (filter.kind && r.kind !== filter.kind) return false;
    if (filter.outcome && r.outcome !== filter.outcome) return false;
    if (filter.tool && String(r.tool ?? '').toLowerCase() !== filter.tool.toLowerCase()) return false;
    if (filter.since && entry.time < filter.since) return false;
    if (filter.until && entry.time > filter.until) return false;
    if (filter.onlyInvalid && entry.valid) return false;
    if (needle && !JSON.stringify({ subject: r.subject, tool: r.tool, detail: r.detail, artifacts: r.artifacts }).toLowerCase().includes(needle)) return false;
    return true;
  });
  return chosen.sort((a, b) => (a.time === b.time ? (a.file === b.file ? b.line - a.line : (a.file < b.file ? 1 : -1)) : (a.time < b.time ? 1 : -1)));
}

export interface EvidenceSummary { records: number; valid: number; invalid: number; outcomes: Record<string, number>; kinds: Record<string, number>; first: string; last: string }

export function summarizeEvidence(entries: EvidenceEntry[]): EvidenceSummary {
  const outcomes: Record<string, number> = Object.fromEntries(EVIDENCE_OUTCOMES.map(o => [o, 0]));
  const kinds: Record<string, number> = Object.fromEntries(EVIDENCE_KINDS.map(k => [k, 0]));
  for (const entry of entries) {
    const outcome = entry.record.outcome, kind = entry.record.kind;
    if (typeof outcome === 'string' && outcome in outcomes) outcomes[outcome]++;
    if (typeof kind === 'string' && kind in kinds) kinds[kind]++;
  }
  const times = entries.map(e => e.time).filter(Boolean).sort();
  const valid = entries.filter(e => e.valid).length;
  return { records: entries.length, valid, invalid: entries.length - valid, outcomes, kinds, first: times[0] ?? '', last: times[times.length - 1] ?? '' };
}

/** The columns of the list for one entry. */
export function evidenceRow(entry: EvidenceEntry) {
  const r = entry.record;
  const subject = (r.subject !== null && typeof r.subject === 'object' && !Array.isArray(r.subject) ? r.subject : {}) as { [key: string]: Json };
  return {
    time: entry.time, kind: String(r.kind ?? ''), outcome: String(r.outcome ?? ''), tool: String(r.tool ?? ''), subject: String(subject.name ?? ''),
    versionBefore: String(subject.version_before ?? ''), versionAfter: String(subject.version_after ?? ''),
    artifacts: Array.isArray(r.artifacts) ? r.artifacts.length : 0, valid: entry.valid, file: entry.file + (entry.line ? `:${entry.line}` : ''),
  };
}

const csvCell = (value: string | number | boolean) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function evidenceCsv(entries: EvidenceEntry[]): string {
  const columns = ['time', 'kind', 'outcome', 'tool', 'subject', 'versionBefore', 'versionAfter', 'artifacts', 'valid', 'file'] as const;
  return [columns.join(','), ...entries.map(e => { const row = evidenceRow(e); return columns.map(c => csvCell(row[c])).join(','); })].join('\n') + '\n';
}
