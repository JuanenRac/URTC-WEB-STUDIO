import { describe, expect, it } from "vitest";
import { parseCustomFrame } from "./customFrame";

describe("a hand-typed frame", () => {
  it("is parsed as typed", () => {
    expect(parseCustomFrame("100", "FF 80 00")).toEqual({ ok: true, id: 0x100, data: [0xFF, 0x80, 0x00] });
    expect(parseCustomFrame("0x7ff", "")).toEqual({ ok: true, id: 0x7FF, data: [] });
    expect(parseCustomFrame(" 7f0 ", "b0 07 1d 5a")).toEqual({ ok: true, id: 0x7F0, data: [0xB0, 0x07, 0x1D, 0x5A] });
  });
  it("refuses an identifier outside 0-7FF instead of masking it", () => {
    for (const bad of ["900", "FFF", "1000", "", "zz", "-1", "10 0"]) {
      expect(parseCustomFrame(bad, "00")).toEqual({ ok: false, error: "bad_id" });
    }
  });
  it("refuses an invalid byte instead of dropping it and shifting the rest", () => {
    expect(parseCustomFrame("100", "01 zz 03")).toEqual({ ok: false, error: "bad_byte" });
    expect(parseCustomFrame("100", "123")).toEqual({ ok: false, error: "bad_byte" });
  });
  it("refuses more than 8 bytes instead of cutting them", () => {
    expect(parseCustomFrame("100", "00 00 00 00 00 00 00 00 00")).toEqual({ ok: false, error: "too_many_bytes" });
  });
});
