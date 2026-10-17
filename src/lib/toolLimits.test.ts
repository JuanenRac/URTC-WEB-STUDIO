import { describe, expect, it } from "vitest";
import { MAX_HEATER_SETPOINT_C, MAX_MOTION_STEPS, clampInt, stepsToBytes } from "./toolLimits";
import { TOOL_PROFILES } from "../data/toolsData";

describe("limits of the tool panels", () => {
  it("encodes a step count as 32 bits and refuses what would wrap into another command", () => {
    expect(stepsToBytes(1)).toEqual([0, 0, 0, 1]);
    expect(stepsToBytes(MAX_MOTION_STEPS)).toEqual([255, 255, 255, 255]);
    expect(() => stepsToBytes(0)).toThrow(RangeError);
    expect(() => stepsToBytes(4294967296)).toThrow(RangeError);
    expect(() => stepsToBytes(1.5)).toThrow(RangeError);
    expect(() => stepsToBytes(NaN)).toThrow(RangeError);
  });
  it("clamps a value into its range", () => {
    expect(clampInt(500, 0, 445)).toBe(445);
    expect(clampInt(-3, 0, 445)).toBe(0);
    expect(clampInt(NaN, 1, 9)).toBe(1);
  });
  it("offers no heater setpoint above what the firmware accepts", () => {
    expect(MAX_HEATER_SETPOINT_C).toBe(445);
    for (const tool of TOOL_PROFILES) {
      if (/Soldering|Hot Air/.test(tool.name)) {
        expect(tool.maxVal).toBeLessThanOrEqual(MAX_HEATER_SETPOINT_C);
      }
    }
  });
});
