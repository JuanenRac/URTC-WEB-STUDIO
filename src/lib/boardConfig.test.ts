import { describe, expect, it } from "vitest";
import { parseSerialNumber } from "./boardConfig";

describe("a typed device serial number", () => {
  it("accepts 0 to 255", () => {
    expect(parseSerialNumber("0")).toBe(0);
    expect(parseSerialNumber(" 42 ")).toBe(42);
    expect(parseSerialNumber("255")).toBe(255);
  });
  it("refuses what would wrap into another number or is not a number", () => {
    for (const text of ["256", "300", "-1", "1.5", "", "abc", "1e2", "0x10"]) expect(parseSerialNumber(text), text).toBeNull();
  });
});
