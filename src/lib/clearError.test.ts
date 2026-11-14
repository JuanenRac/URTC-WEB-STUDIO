import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLEAR_ERROR_MAGIC, CLEAR_RESULT_KEYS, ERROR_REASON_KEYS, clearErrorCommand, clearErrorNeedsConfirmation, parseClearErrorAnswer,
} from "./clearError";
import { CAN_ID_CLEAR_ERROR } from "./canIds";
import { featuresWrite } from "./toolFrames";
import { rawSendPolicy } from "./dangerousActions";
import controlConfig from "./controlConfig.json";

const LANGUAGES = ["en", "es", "de", "fr", "it", "ja", "zh", "pt"];
const locale = (code: string) => JSON.parse(readFileSync(join(__dirname, "..", "locales", `${code}.json`), "utf8"));

describe("the clear-error command", () => {
  it("is the identifier 0x1B2 with the magic word CLER", () => {
    expect(CAN_ID_CLEAR_ERROR).toBe(0x1b2);
    expect(clearErrorCommand()).toEqual([0x43, 0x4c, 0x45, 0x52]);
    expect(String.fromCharCode(...CLEAR_ERROR_MAGIC)).toBe("CLER");
    const first = clearErrorCommand();
    first[0] = 0;
    expect(clearErrorCommand()[0]).toBe(0x43);                       // nobody can change the magic word through a copy
  });

  it("is confirmed when it is typed by hand like any command that works an actuator", () => {
    expect(rawSendPolicy(0x1b2)).toEqual({ kind: "confirm", reason: "actuator" });
  });

  it("reaches the seventh bit of the switches and keeps the release policy of the coil as a bit of its own", () => {
    expect(featuresWrite(0x7f)).toEqual([0x46, 0x45, 0x41, 0x54, 0x7f]);
    expect(featuresWrite(0x80)).toEqual([0x46, 0x45, 0x41, 0x54, 0]);
    expect(featuresWrite(16 | 32 | 64)[4]).toBe(0x70);
  });
});

describe("the answer of the head", () => {
  it("reads the reason of the error and what the command did", () => {
    expect(parseClearErrorAnswer([10, 1, 0, 0, 0, 8, 7, 5])).toEqual({ systemError: true, errorReason: 7, clearResult: 5 });
    expect(parseClearErrorAnswer([0, 0, 0, 0, 0, 8, 0, 1])).toEqual({ systemError: false, errorReason: 0, clearResult: 1 });
  });

  it("gives nothing for a head that does not send the last two bytes: not reported is not zero", () => {
    expect(parseClearErrorAnswer([10, 1, 0, 0])).toBeNull();
    expect(parseClearErrorAnswer([10, 1, 0, 0, 0, 8])).toBeNull();
    expect(parseClearErrorAnswer([10, 1, 0, 0, 0, 8, 2])).toBeNull();
    expect(parseClearErrorAnswer([1, 2])).toBeNull();
  });

  it("has a text for every outcome and every reason the specification lists", () => {
    expect(Object.keys(CLEAR_RESULT_KEYS).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(Object.keys(ERROR_REASON_KEYS).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("the setting", () => {
  it("asks before it sends unless the configuration file says exactly false", () => {
    expect(controlConfig.clear_error_confirm).toBe(true);
    expect(clearErrorNeedsConfirmation()).toBe(true);
    expect(clearErrorNeedsConfirmation({})).toBe(true);
    expect(clearErrorNeedsConfirmation({ clear_error_confirm: "false" })).toBe(true);
    expect(clearErrorNeedsConfirmation({ clear_error_confirm: 0 })).toBe(true);
    expect(clearErrorNeedsConfirmation({ clear_error_confirm: false })).toBe(false);
  });
});

describe("the texts", () => {
  const keys = [
    "feature_clear_error", "feature_comms_watchdog", "feature_magnet_release", "clear_error_button", "clear_error_confirm", "clear_error_result", "error_reason_line",
    ...Object.values(CLEAR_RESULT_KEYS), ...Object.values(ERROR_REASON_KEYS),
  ];

  it("exist in the eight languages", () => {
    for (const code of LANGUAGES) {
      const testerextras = locale(code).testerextras ?? {};
      for (const key of keys) expect(typeof testerextras[key], `${code}: ${key}`).toBe("string");
    }
  });

  it("keep the same placeholders as the English text", () => {
    const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
    const english = locale("en").testerextras;
    for (const code of LANGUAGES) {
      const other = locale(code).testerextras;
      for (const key of keys) expect(placeholders(other[key]), `${code}: ${key}`).toEqual(placeholders(english[key]));
    }
  });
});
