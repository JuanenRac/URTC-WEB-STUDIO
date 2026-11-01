import { describe, expect, it } from "vitest";
import { MAX_LISTED_PROBLEMS, parseCanTrace } from "./canTrace";
import { parseEvidenceFile, verifyEvidence } from "./evidenceHistory";
import { importTrustFile, parseTrustStore, TRUST_FILE_FORMAT, TRUST_LINE_LIMIT } from "./trustStore";

// Properties of the parsers that read what other people write: whatever they are given they answer with their own refusal and never with an exception, they never
// accept what they should refuse, and what they accept is what the rules allow. The inputs are made from fixed seeds (the same run every time).

/** A small seeded generator (mulberry32): the same numbers for the same seed, on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)];
const text = (r: () => number, alphabet: string, max: number) => Array.from({ length: Math.floor(r() * max) }, () => alphabet[Math.floor(r() * alphabet.length)]).join("");
const SEEDS = Array.from({ length: 40 }, (_, i) => i);

const HOSTILE = ["__proto__", "constructor", "prototype", "<script>alert(1)</script>", "../../etc/passwd", "\u0000", "‮", "=HYPERLINK(\"x\")", "x".repeat(5000)];

describe("the trace reader", () => {
  it.each(SEEDS)("answers a file of noise (seed %i) with counted problems, never an exception, and keeps only frames that fit the bus", (seed) => {
    const r = rng(seed);
    const lines = Array.from({ length: 60 }, () => (r() < 0.3 ? text(r, "0123456789abcdefABCDEF .()#[]{}:,\"RxTxdl", 80) : pick(r, [
      "     1)         0.0  Rx  0110  0", "(1.000000) can0 110#AABB", "{\"time_ms\":1,\"direction\":\"Rx\",\"id\":\"110\",\"dlc\":0,\"data\":\"\"}",
      "   0.0100 1 1A3 Rx d 2 1F 06", pick(r, HOSTILE),
    ])));
    const load = parseCanTrace(lines.join("\n"));
    expect(load.problems.length).toBeLessThanOrEqual(MAX_LISTED_PROBLEMS);
    expect(load.problemCount).toBeGreaterThanOrEqual(load.problems.length);
    for (const row of load.rows) {
      expect(row.id).toBeGreaterThanOrEqual(0);
      expect(row.id).toBeLessThanOrEqual(0x7ff);
      expect(row.data.length).toBeLessThanOrEqual(8);
      expect(row.data.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)).toBe(true);
      expect(Number.isFinite(row.timeMs)).toBe(true);
    }
  });

  it.each(SEEDS)("never lets one of the lines of a hostile JSON document through unless it is a frame (seed %i)", (seed) => {
    const r = rng(100 + seed);
    const value = () => pick(r, [null, true, 0, -1, 1e999, "x", "0x1A2", "ZZ", [], {}, "__proto__", 2 ** 53, "1F 06", "Rx", "Tx"] as unknown[]);
    const rows = Array.from({ length: 10 }, () => ({ time_ms: value(), direction: value(), id: value(), dlc: value(), data: value() }));
    const load = parseCanTrace(rows.map((o) => JSON.stringify(o)).join("\n"));
    expect(load.rows.length + load.problemCount).toBeGreaterThan(0);
    for (const row of load.rows) expect(["Rx", "Tx"]).toContain(row.direction);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("the evidence reader", () => {
  const GOOD = {
    format: "urtc-evidence/1", kind: "test", outcome: "fail", timestamp_utc: "2026-02-01T10:00:00+01:00", tool: "URTC-TESTER", tool_version: "0.4.3",
    subject: { name: "head-2" }, evidence_sha256: "860ab4ef57b3ee1439a1e8aee9166944a8fdb480fdfac8733e1aa27d8ad11911",
  };

  it("accepts the good record, so the mutations below mean something", async () => {
    expect(await verifyEvidence(GOOD)).toEqual([]);
  });

  it.each(SEEDS)("never calls a changed record valid and never raises (seed %i)", async (seed) => {
    const r = rng(200 + seed);
    const record = JSON.parse(JSON.stringify(GOOD)) as Record<string, unknown>;
    const key = pick(r, Object.keys(record));
    record[key] = pick(r, [null, true, 0, "", "x", [], {}, "2026-13-45T99:99:99Z", "a".repeat(64), 2 ** 60, ...HOSTILE] as unknown[]);
    if (JSON.stringify(record) === JSON.stringify(GOOD)) return;
    const problems = await verifyEvidence(record);
    expect(problems.length).toBeGreaterThan(0);
  });

  it.each(SEEDS)("lists a file of garbage lines, never raises and never calls a garbage line valid (seed %i)", async (seed) => {
    const r = rng(300 + seed);
    const lines = Array.from({ length: 12 }, () => (r() < 0.5 ? text(r, "{}[]\":,0123456789abcxyz \\", 60) : JSON.stringify(pick(r, [null, 1, "x", [], [1], { a: 1 }, GOOD, { ...GOOD, outcome: "pass" }] as unknown[]))));
    const entries = await parseEvidenceFile("x.jsonl", lines.join("\n"));
    for (const entry of entries) {
      expect(entry.valid).toBe(entry.problems.length === 0);
      if (entry.valid) expect(entry.record.evidence_sha256).toBe(GOOD.evidence_sha256);       // the only record of the lot that is whole
    }
  });

  it("refuses a document nested thousands of levels deep and does not follow it", async () => {
    const entries = await parseEvidenceFile("deep.json", "[".repeat(100_000));
    expect(entries).toHaveLength(1);
    expect(entries[0].valid).toBe(false);
  });
});

describe("the trusted keys", () => {
  it.each(SEEDS)("keep only aliases and public keys whatever the text holds (seed %i)", (seed) => {
    const r = rng(400 + seed);
    const lines = Array.from({ length: 30 }, () => pick(r, [
      () => `${text(r, "abcXYZ019 ._@-<>&()=", 12)}=${text(r, "0123456789abcdefg", 70)}`, () => `${pick(r, HOSTILE)}=${"ab".repeat(32)}`,
      () => `Ok${Math.floor(r() * 1000)}=${Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("")}`, () => text(r, "=#\n ", 10),
    ])());
    const { store, problems } = parseTrustStore(lines.join("\n"));
    expect(problems).toBeGreaterThanOrEqual(0);
    expect(Object.keys(store).length).toBeLessThanOrEqual(TRUST_LINE_LIMIT);
    for (const [alias, key] of Object.entries(store)) {
      expect(/^[A-Za-z0-9][A-Za-z0-9 ._@-]{0,39}$/.test(alias)).toBe(true);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each(SEEDS)("are imported whole or not at all (seed %i)", (seed) => {
    const r = rng(500 + seed);
    const good = () => "ab".repeat(32);
    const value = () => pick(r, [good(), good(), good(), "zz".repeat(32), 5, null, "", "AB".repeat(32)] as unknown[]);
    const aliases = ["Ana", "Bea", "Cy", "Bad<b>", "__proto__", "x".repeat(41), "Dee"];
    const keys = Object.fromEntries(Array.from({ length: 1 + Math.floor(r() * 5) }, () => [pick(r, aliases), value()]));
    const result = importTrustFile(JSON.stringify({ format: TRUST_FILE_FORMAT, keys }));
    if (result.ok) {
      expect(Object.keys(result.store).length).toBeGreaterThan(0);
      for (const [alias, key] of Object.entries(result.store)) {
        expect(/^[A-Za-z0-9][A-Za-z0-9 ._@-]{0,39}$/.test(alias)).toBe(true);
        expect(key).toMatch(/^[0-9a-f]{64}$/);
      }
    } else {
      expect(["bad_entry", "empty", "wrong_format", "not_json", "too_big", "too_many"]).toContain(result.reason);
      expect(result).not.toHaveProperty("store");
    }
  });

  it("never raises on text that is not even JSON", () => {
    for (const text of ["", "{", "[", "\u0000", "null", "\"x\"", "{\"format\":", "9".repeat(10_000)]) {
      expect(importTrustFile(text).ok).toBe(false);
    }
  });
});
