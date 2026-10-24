import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT, HISTORY_STORAGE_KEY, addSample, faultsAdded, loadHistory, niceCeiling, saveHistory, thermalHistoryChart, thermalHistoryCsv,
  type ThermalSample,
} from "./thermalHistory";

const at = (minutes: number) => Date.UTC(2000, 0, 1, 0, minutes);
const sample = (minutes: number, faults: number, hours: number, last = 0): ThermalSample => ({ at: at(minutes), faultCount: faults, heaterOnSeconds: hours * 3600, lastFault: last });

describe("the history of the thermal counters", () => {
  it("adds readings in order and keeps only the newest ones past the limit", () => {
    let history: ThermalSample[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) history = addSample(history, sample(i, 0, i / 60));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].at).toBe(at(5));
    expect(addSample([], sample(0, 0, 0), 3)).toHaveLength(1);
  });

  it("starts again when a counter goes down: that is another board, or counters that were cleared", () => {
    const history = [sample(0, 2, 10), sample(1, 2, 10.5)];
    expect(addSample(history, sample(2, 1, 11))).toEqual([sample(2, 1, 11)]);
    expect(addSample(history, sample(2, 2, 3))).toEqual([sample(2, 2, 3)]);
    expect(addSample(history, sample(-5, 2, 11))).toEqual([sample(-5, 2, 11)]);
    expect(addSample(history, sample(2, 3, 11))).toHaveLength(3);
  });

  it("counts the faults added between the first and the last reading", () => {
    expect(faultsAdded([])).toBe(0);
    expect(faultsAdded([sample(0, 4, 1)])).toBe(0);
    expect(faultsAdded([sample(0, 4, 1), sample(1, 4, 2), sample(2, 6, 3)])).toBe(2);
  });

  it("rounds the scale of the hours to 1, 2 or 5 times a power of ten", () => {
    expect(niceCeiling(0)).toBe(0.1);
    expect(niceCeiling(0.7)).toBe(1);
    expect(niceCeiling(1.2)).toBe(2);
    expect(niceCeiling(3.4)).toBe(5);
    expect(niceCeiling(7)).toBe(10);
    expect(niceCeiling(120)).toBe(200);
  });

  it("draws the hours of the heater and the faults over the time between the first and the last reading", () => {
    const history = [sample(0, 0, 0), sample(30, 0, 1), sample(60, 1, 2)];
    const chart = thermalHistoryChart(history, 480, 170);
    expect(chart.spanMs).toBe(3600000);
    expect(chart.maxHours).toBe(2);
    expect(chart.maxFaults).toBe(1);
    expect(chart.heater.split(" ")).toHaveLength(3);
    expect(chart.heater.split(" ")[0]).toBe("8.0,162.0");
    expect(chart.heater.split(" ")[2]).toBe("472.0,8.0");
    // steps: the fault line stays flat and rises at the last reading
    expect(chart.faults.split(" ")).toHaveLength(5);
    expect(chart.faultMarks).toEqual([472]);
    expect(chart.grid[0].hours).toBe(0);
    expect(chart.grid[4].hours).toBe(2);
  });

  it("draws one reading, and none, without dividing by zero", () => {
    expect(thermalHistoryChart([sample(0, 0, 0)], 100, 50).heater).toBe("8.0,42.0");
    const empty = thermalHistoryChart([], 100, 50);
    expect(empty.heater).toBe("");
    expect(empty.spanMs).toBe(0);
  });

  it("writes one line per reading as a table for a spreadsheet", () => {
    const csv = thermalHistoryCsv([sample(0, 1, 1, 2), sample(1, 1, 1.5, 2)]);
    expect(csv.split("\n")).toEqual([
      "time,fault_count,heater_on_seconds,heater_on_hours,last_fault",
      "2000-01-01T00:00:00.000Z,1,3600,1.0000,2",
      "2000-01-01T00:01:00.000Z,1,5400,1.5000,2",
      "",
    ]);
  });
});

describe("keeping the history between sessions", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
  };

  it("stores and reads it back", () => {
    const storage = memory();
    const history = [sample(0, 0, 1), sample(1, 1, 2)];
    saveHistory(storage, history);
    expect(loadHistory(storage)).toEqual(history);
    saveHistory(storage, []);
    expect(storage.data.has(HISTORY_STORAGE_KEY)).toBe(false);
  });

  it("gives an empty history for anything that is not a list of readings", () => {
    for (const text of ["not json", "{}", "[1]", '[{"at":1}]', '[{"at":-1,"faultCount":0,"heaterOnSeconds":0,"lastFault":0}]', '[{"at":"1","faultCount":0,"heaterOnSeconds":0,"lastFault":0}]']) {
      const storage = memory();
      storage.setItem(HISTORY_STORAGE_KEY, text);
      expect(loadHistory(storage), text).toEqual([]);
    }
    expect(loadHistory(undefined)).toEqual([]);
  });

  it("goes on when the storage throws", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(loadHistory(broken)).toEqual([]);
    expect(() => saveHistory(broken, [sample(0, 0, 0)])).not.toThrow();
  });
});
