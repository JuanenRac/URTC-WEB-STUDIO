import { describe, expect, it } from 'vitest';
import {
  canonicalJson, evidenceCsv, evidenceDigest, evidenceRow, parseEvidenceFile, selectEvidence, summarizeEvidence, verifyEvidence,
} from './evidenceHistory';

// Two records written by the common code in Python (evidence.build), digest included: the digest here must be the one Python computes, character for character.
const FLASH = {
  format: 'urtc-evidence/1', kind: 'flash', outcome: 'pass', timestamp_utc: '2026-01-01T10:00:00Z', tool: 'URTC-FLASHER', tool_version: '0.4.2', operator: 'Zoë',
  subject: { name: 'head-ñ', hardware_id: '0x0303CC01', version_before: '0.3.9', version_after: '0.4.1' },
  transport: { adapter: 'SLCAN', bus: 'can', bitrate: 500000 },
  artifacts: [{ name: 'fw.bin', sha256: 'a'.repeat(64), bytes: 1234 }], detail: 'ok "quoted" / slash',
  evidence_sha256: '1b302f15715173c2ef461d3f2a0ad818c7200481de410b998bc82ee5177f45d0',
};
const TEST = {
  format: 'urtc-evidence/1', kind: 'test', outcome: 'fail', timestamp_utc: '2026-02-01T10:00:00+01:00', tool: 'URTC-TESTER', tool_version: '0.4.3',
  subject: { name: 'head-2' }, evidence_sha256: '860ab4ef57b3ee1439a1e8aee9166944a8fdb480fdfac8733e1aa27d8ad11911',
};

describe('the digest of a record', () => {
  it('is the one the common code computes in Python', async () => {
    expect(await evidenceDigest(FLASH)).toBe(FLASH.evidence_sha256);
    expect(await evidenceDigest(TEST)).toBe(TEST.evidence_sha256);
  });
  it('sorts the keys at every level and leaves out spaces', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: 'é' } })).toBe('{"a":{"c":"é","d":[3,{"x":2,"y":1}]},"b":1}');
  });
});

describe('checking a record', () => {
  it('accepts a record that is well formed and whose digest matches', async () => {
    expect(await verifyEvidence(FLASH)).toEqual([]);
    expect(await verifyEvidence(TEST)).toEqual([]);
  });
  it('lists what is wrong with a record edited after it was written', async () => {
    expect((await verifyEvidence({ ...TEST, outcome: 'pass' }))[0]).toContain('does not match');
    expect(await verifyEvidence({ ...TEST, outcome: 'maybe' })).toContain('outcome must be one of pass, fail, error, skipped');
    expect(await verifyEvidence({ ...TEST, extra: 1 })).toContain('extra is not a field of urtc-evidence/1');
    expect(await verifyEvidence({ ...TEST, timestamp_utc: 'yesterday' })).toContain('timestamp_utc must be an ISO 8601 time with Z or an offset');
    expect(await verifyEvidence({ ...TEST, subject: { name: 'x', version_after: 'abc' } })).toContain('subject.version_after is not valid');
    expect(await verifyEvidence({ ...FLASH, artifacts: [{ name: 'fw.bin' }] })).toContain('artifacts[0] needs a name and a sha256');
    expect(await verifyEvidence({ ...TEST, evidence_sha256: 'nope' })).toContain('evidence_sha256 must be 64 lowercase hexadecimal digits');
    expect(await verifyEvidence([1])).toEqual(['a record is a JSON object']);
    expect(await verifyEvidence(null)).toEqual(['a record is a JSON object']);
  });
});

describe('the history of the files', () => {
  const file = (name: string, text: string) => parseEvidenceFile(name, text);

  it('reads a file with one record and a jsonl file with a record per line, and lists a bad file instead of skipping it', async () => {
    const one = await file('a.json', JSON.stringify(FLASH));
    const many = await file('b.jsonl', `${JSON.stringify(TEST)}\n\n${JSON.stringify(FLASH)}\r\n`);
    const garbage = await file('c.json', '{ nope');
    const list = await file('d.json', '[1]');
    expect([one.length, many.length, garbage.length, list.length]).toEqual([1, 2, 1, 1]);
    expect(many.map(e => e.line)).toEqual([1, 3]);
    expect(garbage[0].valid).toBe(false);
    expect(garbage[0].problems[0]).toContain('not JSON');
    expect(list[0].problems).toEqual(['a record is a JSON object']);
  });

  it('lists newest first and filters by kind, outcome, tool, time, text and validity', async () => {
    const entries = [...await file('a.json', JSON.stringify(FLASH)), ...await file('b.json', JSON.stringify(TEST)), ...await file('c.json', JSON.stringify({ ...TEST, outcome: 'pass' }))];
    expect(selectEvidence(entries).map(e => e.file)).toEqual(['c.json', 'b.json', 'a.json']);
    expect(selectEvidence(entries, { kind: 'flash' }).map(e => e.file)).toEqual(['a.json']);
    expect(selectEvidence(entries, { outcome: 'fail' }).map(e => e.file)).toEqual(['b.json']);
    expect(selectEvidence(entries, { tool: 'urtc-flasher' }).map(e => e.file)).toEqual(['a.json']);
    expect(selectEvidence(entries, { since: '2026-01-15T00:00:00Z' }).map(e => e.file)).toEqual(['c.json', 'b.json']);
    expect(selectEvidence(entries, { until: '2026-01-15T00:00:00Z' }).map(e => e.file)).toEqual(['a.json']);
    expect(selectEvidence(entries, { text: 'QUOTED' }).map(e => e.file)).toEqual(['a.json']);
    expect(selectEvidence(entries, { onlyInvalid: true }).map(e => e.file)).toEqual(['c.json']);
    expect(selectEvidence(entries, { kind: 'session' })).toEqual([]);
  });

  it('counts the records, the outcomes and the kinds, and writes the rows and the csv', async () => {
    const entries = [...await file('a.json', JSON.stringify(FLASH)), ...await file('b.json', JSON.stringify(TEST)), ...await file('x.json', 'not json')];
    const summary = summarizeEvidence(entries);
    expect(summary).toMatchObject({ records: 3, valid: 2, invalid: 1, first: '2026-01-01T10:00:00Z', last: '2026-02-01T10:00:00+01:00' });
    expect(summary.outcomes).toEqual({ pass: 1, fail: 1, error: 0, skipped: 0 });
    expect(summary.kinds).toEqual({ flash: 1, test: 1, install: 0, session: 0 });
    expect(evidenceRow(entries[0])).toEqual({ time: FLASH.timestamp_utc, kind: 'flash', outcome: 'pass', tool: 'URTC-FLASHER', subject: 'head-ñ', versionBefore: '0.3.9', versionAfter: '0.4.1', artifacts: 1, valid: true, file: 'a.json' });
    const csv = evidenceCsv(entries).split('\n');
    expect(csv[0]).toBe('time,kind,outcome,tool,subject,versionBefore,versionAfter,artifacts,valid,file');
    expect(csv).toHaveLength(5);
    expect(csv[1]).toBe('2026-01-01T10:00:00Z,flash,pass,URTC-FLASHER,head-ñ,0.3.9,0.4.1,1,true,a.json');
    expect(summarizeEvidence([])).toMatchObject({ records: 0, first: '', last: '' });
  });
});
