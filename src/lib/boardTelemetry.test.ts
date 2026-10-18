import { describe, expect, it } from "vitest";
import { heaterToolId, summarizeBoardFrames } from "./boardTelemetry";

const rx = (id: number, data: number[], extra: object = {}) => ({ id, data, direction: "Rx" as const, ...extra });

describe("what the real board has said", () => {
  it("takes the active tool and the fault from a real 0x111 answer", () => {
    const facts = summarizeBoardFrames([rx(0x111, [10, 0, 0, 0])]);
    expect(facts.status).toEqual({ toolId: 10, systemError: false, errorMessage: "", thermalFault: null });
    const faulty = summarizeBoardFrames([rx(0x111, [5, 1, 0, 0])]);
    expect(faulty.status?.systemError).toBe(true);
    expect(faulty.status?.errorMessage).toContain("CRITICAL ERROR");
  });

  it("carries the reason the thermal guard cut the heater, when the board says it", () => {
    expect(summarizeBoardFrames([rx(0x111, [0, 1, 0, 0, 2, 0])]).status?.thermalFault).toBe(2);
    expect(summarizeBoardFrames([rx(0x111, [0, 1, 0, 0, 0, 0])]).status?.thermalFault).toBeNull();
    expect(summarizeBoardFrames([rx(0x111, [0, 1, 0, 0])]).status?.thermalFault).toBeNull();
  });

  it("keeps the last answer of a batch", () => {
    const facts = summarizeBoardFrames([rx(0x111, [1, 0, 0, 0]), rx(0x111, [2, 0, 0, 0])]);
    expect(facts.status?.toolId).toBe(2);
  });

  it("an invalid tool number is reported as it is, not replaced by the first tool", () => {
    expect(summarizeBoardFrames([rx(0x111, [25, 0, 0, 0])]).status?.toolId).toBe(25);
  });

  it("ignores a frame this app sent and a frame the simulator made up", () => {
    const sent = { id: 0x111, data: [7, 0, 0, 0], direction: "Tx" as const };
    const made = rx(0x111, [7, 0, 0, 0], { simulated: true });
    expect(summarizeBoardFrames([sent, made])).toEqual({});
  });

  it("reads the heater temperature from 0x135", () => {
    expect(summarizeBoardFrames([rx(0x135, [0x00, 0xdc])]).heaterTemp).toBe(220);
  });

  it("assigns the temperature to the hot air station only when that is the tool", () => {
    expect(heaterToolId(19)).toBe(19);
    expect(heaterToolId(0)).toBe(0);
    expect(heaterToolId(null)).toBe(0);
    expect(heaterToolId(1)).toBe(0);
  });
});
