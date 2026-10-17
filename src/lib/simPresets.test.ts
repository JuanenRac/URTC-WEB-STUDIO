import { describe, expect, it } from "vitest";
import { PRESET_GROUPS, SAFE_QUERY_PRESETS, planPreset } from "./simPresets";
import { rawSendPolicy } from "./dangerousActions";

const ALL_IDS = [...PRESET_GROUPS.system, ...PRESET_GROUPS.tool, ...PRESET_GROUPS.bootloader].map(p => p.id);
const state = (connected: boolean) => ({ connected, activeToolId: 0, activeToolName: "Soldering Iron" });

describe("predefined messages and the real bus", () => {
  it("with a board connected, only a plain query is ever sent", () => {
    for (const id of ALL_IDS) {
      const plan = planPreset(id, state(true));
      if (plan.realQuery) {
        expect(Object.keys(SAFE_QUERY_PRESETS)).toContain(id);
        // a query carries no setting: it is never one that writes, enters the bootloader or moves something
        expect(rawSendPolicy(plan.realQuery.id).kind).toBe("ok");
        expect(plan.simulated).toEqual([]);
      }
    }
  });

  it("never sends the writes to the board configuration", () => {
    for (const id of ["0x1A0", "0x1A2", "0x1A4", "0x192", "0x7F0"]) {
      const plan = planPreset(id, state(true));
      expect(plan.realQuery).toBeUndefined();
    }
  });

  it("with a board connected, no simulated answer is produced that could be taken for the board's", () => {
    for (const id of ALL_IDS) {
      expect(planPreset(id, state(true)).simulated.every(f => f.direction === "Tx")).toBe(true);
    }
  });

  it("without a board it plays the whole simulated exchange and sends nothing", () => {
    const plan = planPreset("0x110", state(false));
    expect(plan.realQuery).toBeUndefined();
    expect(plan.simulated.map(f => f.idHex)).toEqual(["0x110", "0x111"]);
    expect(plan.simulated[1].dataHex.startsWith("00")).toBe(true);
  });

  it("uses the payload lengths the firmware expects", () => {
    const enter = planPreset("0x7F0", state(false)).simulated[0];
    expect(enter.dataHex.split(" ")).toHaveLength(4); // the bootloader trigger is exactly 4 bytes
    const led = planPreset("0x100", state(false));
    expect(led.simulated[0].dataHex.split(" ")[3]).toBe("00"); // OLED byte: standard (0x00), 0x0F or 0x01 only
    const spi = planPreset("0x180", state(false)).simulated[0];
    const bytes = spi.dataHex.split(" ");
    expect(parseInt(bytes[0], 16)).toBe(bytes.length - 1); // count byte matches the bytes that follow, at most 7
  });

  it("every simulated payload is made of valid hex bytes", () => {
    for (const id of ALL_IDS) {
      for (const f of planPreset(id, state(false)).simulated) {
        for (const tok of f.dataHex.split(" ").filter(Boolean)) expect(tok).toMatch(/^[0-9A-F]{2}$/);
        expect(f.dataHex.split(" ").filter(Boolean).length).toBeLessThanOrEqual(8);
      }
    }
  });

  it("the query presets use the real query identifier and payload", () => {
    expect(SAFE_QUERY_PRESETS["0x7F8"]).toMatchObject({ id: 0x7f8, data: [0] });
    expect(SAFE_QUERY_PRESETS["0x110"]).toMatchObject({ id: 0x110, data: [] });
  });
});
