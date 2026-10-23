import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BlackBoxError, blackBoxChart, blackBoxCsv, blackBoxFromCsv, blackBoxFromJson, blackBoxFromText, blackBoxJson, parseBlackBox, triggerIndex,
} from "./blackBox";

const BB = JSON.parse(readFileSync(join(__dirname, "generated", "blackbox_vectors.json"), "utf8"));
const hex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

describe("a saved fault record", () => {
  for (const v of BB.valid) {
    it(`comes back from its JSON file as it was (${v.name})`, () => {
      const record = parseBlackBox(hex(v.hex));
      const back = blackBoxFromJson(blackBoxJson(record, "captured"));
      expect(back.samples).toEqual(record.samples);
      expect(triggerIndex(back)).toBe(triggerIndex(record));
    });
    it(`comes back from its CSV file as it was (${v.name})`, () => {
      const record = parseBlackBox(hex(v.hex));
      expect(blackBoxFromCsv(blackBoxCsv(record)).samples).toEqual(record.samples);
      expect(blackBoxFromText(blackBoxCsv(record)).samples).toEqual(record.samples);
      expect(blackBoxFromText(blackBoxJson(record, null)).samples).toEqual(record.samples);
    });
  }

  it("refuses a file that is not a record, with a reason", () => {
    expect(() => blackBoxFromJson("not json")).toThrow(BlackBoxError);
    expect(() => blackBoxFromJson("{}")).toThrow(/urtc-blackbox\/1/);
    expect(() => blackBoxFromJson(JSON.stringify({ format: "urtc-blackbox/1" }))).toThrow(/list of samples/);
    expect(() => blackBoxFromJson(JSON.stringify({ format: "urtc-blackbox/1", samples: [] }))).toThrow(/no samples/);
    expect(() => blackBoxFromCsv("index\n1")).toThrow(/column/);
    expect(() => blackBoxFromCsv("")).toThrow(/no samples/);
  });

  it("refuses a value out of range, a record with too many samples and a fault code that does not exist", () => {
    const record = parseBlackBox(hex(BB.valid[1].hex));
    const doc = JSON.parse(blackBoxJson(record, null));
    const bad = (change: (d: { samples: Array<Record<string, unknown>> }) => void) => {
      const copy = JSON.parse(JSON.stringify(doc));
      change(copy);
      return JSON.stringify(copy);
    };
    expect(() => blackBoxFromJson(bad((d) => { d.samples[0].current_temperature = 70000; }))).toThrow(/current_temperature/);
    expect(() => blackBoxFromJson(bad((d) => { d.samples[0].thermal_fault = 4; }))).toThrow(/thermal_fault/);
    expect(() => blackBoxFromJson(bad((d) => { d.samples[0].tick_ms = -1; }))).toThrow(/tick_ms/);
    expect(() => blackBoxFromJson(bad((d) => { d.samples[0].endstop = "yes"; }))).toThrow(/endstop/);
    expect(() => blackBoxFromJson(bad((d) => { d.samples.push(d.samples[0]); }))).toThrow(/at most 67/);
  });
});

describe("the chart of a record", () => {
  const record = parseBlackBox(hex(BB.valid[1].hex));

  it("puts every sample inside the box, time left to right and the trigger where the error flag first shows", () => {
    const chart = blackBoxChart(record, 400, 160);
    const current = chart.current.split(" ").map((p) => p.split(",").map(Number));
    expect(current).toHaveLength(record.samples.length);
    for (const [x, y] of current) {
      expect(x).toBeGreaterThanOrEqual(8);
      expect(x).toBeLessThanOrEqual(392);
      expect(y).toBeGreaterThanOrEqual(8);
      expect(y).toBeLessThanOrEqual(152);
    }
    expect(current[0][0]).toBe(8);
    expect(current[current.length - 1][0]).toBe(392);
    expect(chart.triggerX).not.toBeNull();
    expect(chart.triggerX).toBeCloseTo(current[triggerIndex(record) as number][0], 1);
    expect(chart.grid).toHaveLength(5);
    expect(chart.minTemperature).toBeLessThan(chart.maxTemperature);
  });

  it("has no trigger line for a record with no error flag, and copes with one sample", () => {
    const calm = parseBlackBox(hex(BB.valid[0].hex));
    if (triggerIndex(calm) === null) expect(blackBoxChart(calm, 400, 160).triggerX).toBeNull();
    const single = { version: 2, sampleCount: 1, writeIndex: 1, samples: [{ tickMs: 5, toolId: 0, currentTemperature: 25, targetTemperature: 0, flags: 0 }] };
    const chart = blackBoxChart(single, 400, 160);
    expect(chart.spanMs).toBe(0);
    expect(chart.current.startsWith("8.0,")).toBe(true);
    expect(blackBoxChart({ version: 2, sampleCount: 0, writeIndex: 0, samples: [] }, 400, 160).current).toBe("");
  });
});
