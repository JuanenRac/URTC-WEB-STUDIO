import { describe, expect, it } from "vitest";
import { encodeThermalStatsResp } from "./generated/urtcCanIds";
import { parseThermalStats, thermalFaultTextKey } from "./thermalStats";

const answer = (faults: number, seconds: number, last: number, persisted: number) =>
  encodeThermalStatsResp(faults, seconds, last, persisted).data;

describe("lifetime thermal counters (0x1AB)", () => {
  it("reads the faults, the hours of the heater, the last fault and whether the F-RAM keeps them", () => {
    const stats = parseThermalStats(answer(3, 7200, 2, 1));
    expect(stats).toMatchObject({ faultCount: 3, heaterOnSeconds: 7200, heaterOnHours: 2, lastFault: 2, lastFaultName: "heating_without_rise", persisted: true });
    expect(parseThermalStats(answer(0, 0, 0, 0))).toMatchObject({ lastFaultName: "none", persisted: false });
  });

  it("names a fault code it does not know instead of failing", () => {
    const stats = parseThermalStats(answer(1, 1, 9, 1));
    expect(stats?.lastFaultName).toBe("unknown_9");
    expect(thermalFaultTextKey(stats!)).toBe("testerextras.counters_fault_unknown");
  });

  it("has a text key for each of the three faults", () => {
    expect(thermalFaultTextKey(parseThermalStats(answer(1, 1, 1, 1))!)).toBe("testerextras.counters_fault_max_temperature");
    expect(thermalFaultTextKey(parseThermalStats(answer(1, 1, 3, 1))!)).toBe("testerextras.counters_fault_dropped_at_target");
  });

  it("is not an answer when the payload is not 8 bytes", () => {
    expect(parseThermalStats([1, 2, 3])).toBeNull();
    expect(parseThermalStats(new Array(9).fill(0))).toBeNull();
  });
});
