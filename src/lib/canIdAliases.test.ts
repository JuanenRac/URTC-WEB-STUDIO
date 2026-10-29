import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as canIds from "./canIds";
import * as generated from "./generated/urtcCanIds";

// An identifier of this app that is not the generated one under the same name must be listed in CAN_NAME_ALIASES,
// point at an identifier that exists in the shared module, and carry the same value.
const source = readFileSync(join(__dirname, "canIds.ts"), "utf8");
const found = [...source.matchAll(/^export const ([A-Z0-9_]+)\s*(?::[^=]+)?=\s*generated\.([A-Z0-9_]+)\b/gm)].map((m) => [m[1], m[2]] as const);
const renamed = found.filter(([name, canonical]) => name !== canonical);

describe("the names of the CAN identifiers that differ from the shared ones", () => {
  it("are exactly the ones in the table", () => {
    expect(Object.fromEntries(renamed)).toEqual(canIds.CAN_NAME_ALIASES);
  });

  for (const [alias, canonical] of renamed) {
    it(`${alias} is ${canonical}`, () => {
      expect(canonical in generated, `${canonical} does not exist in the shared module`).toBe(true);
      expect((canIds as Record<string, unknown>)[alias]).toEqual((generated as Record<string, unknown>)[canonical]);
    });
  }

  it("are not also defined under their shared name with another value", () => {
    for (const [, canonical] of renamed) {
      if (canonical in canIds) {
        expect((canIds as Record<string, unknown>)[canonical]).toEqual((generated as Record<string, unknown>)[canonical]);
      }
    }
  });
});
