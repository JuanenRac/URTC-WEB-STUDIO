import { describe, expect, it } from "vitest";
import { MAX_HEATER_SETPOINT_C, MAX_MOTION_STEPS, clampInt, configWordToBytes, isConfigWord, stepsToBytes } from "./toolLimits";
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

describe("the ADS1115 configuration word", () => {
  it("is two big-endian bytes from 1 to 4 hexadecimal digits, with or without 0x", () => {
    expect(configWordToBytes("8583")).toEqual([0x85, 0x83]);
    expect(configWordToBytes(" 0x85 ")).toEqual([0x00, 0x85]);
    expect(configWordToBytes("F")).toEqual([0x00, 0x0F]);
  });
  it("refuses an empty, too long or non-hexadecimal text instead of sending 0x0000", () => {
    for (const text of ["", "  ", "0x", "12345", "zz", "85 83", "-1"]) {
      expect(() => configWordToBytes(text), text).toThrow(RangeError);
      expect(isConfigWord(text), text).toBe(false);
    }
    expect(isConfigWord("8583")).toBe(true);
  });
});
