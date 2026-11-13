import { describe, expect, it } from "vitest";
import { VERIFY_FAIL_CODES } from "./canIds";
import en from "../locales/en.json";

describe("the verify-fail reasons the page can word", () => {
  it("names the lost digest chunk of the slave relay (7)", () => {
    expect(VERIFY_FAIL_CODES).toContain(0x07);
    const texts = (en as unknown as { flasher: Record<string, string> }).flasher;
    expect(texts["verify_fail_7"]).toMatch(/digest block was lost/);
  });

  it("keeps every code once and in order", () => {
    expect([...VERIFY_FAIL_CODES]).toEqual([...new Set(VERIFY_FAIL_CODES)].sort((a, b) => a - b));
  });
});
