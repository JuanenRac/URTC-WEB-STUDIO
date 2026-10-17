import { describe, expect, it } from "vitest";
import { confirmationRisk, rawSendPolicy } from "./dangerousActions";

describe("which actions are confirmed", () => {
  it("asks before anything that can hurt a person", () => {
    for (const kind of ["laser", "drill", "uv", "weld"] as const) expect(confirmationRisk(kind)).toBe("danger");
  });
  it("asks before anything that moves or dispenses", () => {
    for (const kind of ["motion", "paste", "feeder_reset"] as const) expect(confirmationRisk(kind)).toBe("caution");
  });
  it("asks before writing to the board", () => {
    for (const kind of ["program_config", "erase_fram", "raw_frame"] as const) expect(confirmationRisk(kind)).toBe("danger");
  });
  it("asks for a heater only when it is going to heat", () => {
    expect(confirmationRisk("heater", 0)).toBeNull();
    expect(confirmationRisk("heater")).toBeNull();
    expect(confirmationRisk("heater", 220)).toBe("caution");
  });
});

describe("what a hand-typed frame may do on a real board", () => {
  it("never sends an identifier that only the board transmits", () => {
    for (const id of [0x095, 0x111, 0x135, 0x147, 0x7f5, 0x7f9]) expect(rawSendPolicy(id)).toEqual({ kind: "blocked" });
  });
  it("confirms the writes to memory and the bootloader commands", () => {
    for (const id of [0x1a0, 0x1a2, 0x1a4, 0x192]) expect(rawSendPolicy(id)).toEqual({ kind: "confirm", reason: "memory" });
    for (const id of [0x7f0, 0x7f1, 0x7fd]) expect(rawSendPolicy(id)).toEqual({ kind: "confirm", reason: "bootloader" });
  });
  it("confirms actuator commands and lets queries through", () => {
    expect(rawSendPolicy(0x160)).toEqual({ kind: "confirm", reason: "actuator" });
    expect(rawSendPolicy(0x110)).toEqual({ kind: "ok" });
    expect(rawSendPolicy(0x7f8)).toEqual({ kind: "ok" });
    expect(rawSendPolicy(0x190)).toEqual({ kind: "ok" });
  });
});
