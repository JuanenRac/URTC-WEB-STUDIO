import { describe, expect, it } from "vitest";
import { TOOL_PROFILES } from "./toolsData";
import { MAX_HEATER_SETPOINT_C } from "../lib/toolLimits";
import { EXPANSION_BOARD_TYPES } from "../lib/canIds";

describe("the simulator data follows the firmware", () => {
  it("tools with a communication watchdog use the firmware's 250 ms", () => {
    for (const id of [0, 5, 9, 10, 18, 19]) {
      expect(TOOL_PROFILES.find(t => t.id === id)?.watchdogMs, `tool ${id}`).toBe(250);
    }
  });

  it("the drill pins are the ones of the board", () => {
    const drill = TOOL_PROFILES.find(t => t.id === 5)!;
    const pins = drill.pinsUsed.join(" ");
    expect(pins).toContain("PA3");
    expect(pins).toContain("PB9");
    expect(pins).not.toContain("PA11");
  });

  it("no heater setpoint above the firmware's critical limit", () => {
    for (const id of [0, 19]) expect(TOOL_PROFILES.find(t => t.id === id)!.maxVal).toBeLessThanOrEqual(MAX_HEATER_SETPOINT_C);
  });

  it("the board has seven expansion variants", () => {
    expect(EXPANSION_BOARD_TYPES).toHaveLength(7);
  });
});
