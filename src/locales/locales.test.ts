import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LANGUAGES = ["en", "es", "de", "fr", "it", "ja", "zh", "pt"];

function flatten(value: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
}

const load = (lang: string) => flatten(JSON.parse(readFileSync(join(__dirname, `${lang}.json`), "utf8")));
const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");

describe("the eight interface languages", () => {
  const en = load("en");
  for (const lang of LANGUAGES.filter(l => l !== "en")) {
    it(`${lang} has exactly the keys of English, with the same placeholders`, () => {
      const other = load(lang);
      expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) expect(placeholders(other[key]), key).toBe(placeholders(en[key]));
    });
  }
});
