import { describe, expect, it } from "vitest";
import { filterRows, parseCanTrace, sortRows, summarizeRows, timelineBuckets } from "./canTrace";

const dump = (...lines: string[]) => lines.join("\n") + "\n";

describe("hostile and old input with the new formats", () => {
  it("does not take the text of a hostile JSON line as anything but a frame or a refused line", () => {
    const load = parseCanTrace(dump(
      '{"time_ms":0,"direction":"Rx","id":"110","dlc":0,"data":"","__proto__":{"polluted":true}}',
      '{"time_ms":1e999,"direction":"Rx","id":"110","dlc":0,"data":""}',
    ));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(load.problemCount + load.rows.length).toBe(2);
    expect(load.rows.every((r) => Number.isFinite(r.timeMs))).toBe(true);
  });

  it("keeps the lines the old formats refused refused", () => {
    expect(parseCanTrace(dump(";$FILEVERSION=1.1", ";", "garbage")).problems).toEqual([{ line: 3, reason: "not_a_frame" }]);
    expect(parseCanTrace(dump("     1)         0.0  Rx  0110  0")).format).toBe("trc");
  });

  it("counts every refused line of a big candump log without listing all of them", () => {
    const lines = Array.from({ length: 300 }, (_, i) => `(1.${String(i).padStart(6, "0")}) can0 1FFFFFFF#AA`);
    const load = parseCanTrace(dump(...lines));
    expect(load.problemCount).toBe(300);
    expect(load.problems.length).toBeLessThan(300);
    expect(load.rows).toEqual([]);
  });
});

describe("a trace of a hundred thousand frames", () => {
  const big = () => {
    const lines: string[] = [];
    for (let i = 0; i < 100_000; i++) lines.push(i % 2 === 0 ? `${i + 1}) ${(i * 0.5).toFixed(1)} Tx 01A2 1 06` : `${i + 1}) ${(i * 0.5).toFixed(1)} Rx 01A3 2 1F 06`);
    return lines.join("\n");
  };

  it("reads, filters, sorts and summarizes in a time a person does not notice", () => {
    const text = big();
    const t0 = performance.now();
    const load = parseCanTrace(text);
    const selected = sortRows(filterRows(load.rows, { directions: ["Rx"] }), "time", true);
    const summary = summarizeRows(load.rows);
    const buckets = timelineBuckets(selected, 60);
    const elapsed = performance.now() - t0;
    expect(load.rows).toHaveLength(100_000);
    expect(selected).toHaveLength(50_000);
    expect(summary.frames).toBe(100_000);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(50_000);
    expect(elapsed).toBeLessThan(10_000);   // a generous bound for a slow machine
  }, 60_000);
});
