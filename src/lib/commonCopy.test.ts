import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import * as canIds from "./canIds";
import * as generated from "./generated/urtcCanIds";

// The generated module and the shared vectors are copies: nobody edits them by hand, they do not fall behind the
// shared repository when it sits next to this one, and the identifiers this app exports are the generated ones.
const digest = (path: string) => createHash("sha256").update(readFileSync(path, "utf8").replace(/\r\n/g, "\n")).digest("hex");
const common = join(__dirname, "..", "..", "..", "URTC-COMMON");

const locks: Array<[string, string]> = [
  [join(__dirname, "generated", "urtc_common.lock.json"), "generated"],
  [join(__dirname, "urtc_common.lock.json"), "vectors"],
];

describe("the copies of URTC-COMMON", () => {
  for (const [lockPath, label] of locks) {
    it(`${label}: no file differs from its lock`, () => {
      const lock = JSON.parse(readFileSync(lockPath, "utf8"));
      expect(Object.keys(lock.files).length).toBeGreaterThan(0);
      for (const [name, entry] of Object.entries<{ sha256: string }>(lock.files)) {
        expect(digest(join(dirname(lockPath), name)), `${name} was edited by hand: sync it again`).toBe(entry.sha256);
      }
    });
  }

  it("have not fallen behind the shared repository", () => {
    if (!existsSync(common)) return;
    expect(digest(join(__dirname, "generated", "urtcCanIds.ts"))).toBe(digest(join(common, "generated", "urtcCanIds.ts")));
    expect(digest(join(__dirname, "canConformance.vectors.json"))).toBe(digest(join(common, "conformance", "can_vectors.json")));
  });

  it("every CAN identifier exported by canIds.ts is an identifier of the specification", () => {
    const known = new Set<unknown>(Object.entries(generated).filter(([name]) => name.startsWith("CAN_ID_")).map(([, value]) => value));
    const own = Object.entries(canIds).filter(([name]) => name.startsWith("CAN_ID_"));
    expect(own.length).toBeGreaterThan(40);
    for (const [name, value] of own) expect(known.has(value), `${name} is not in the specification`).toBe(true);
  });

  it("the magic payloads are the generated ones", () => {
    expect(canIds.ERASE_FRAM_MAGIC).toEqual(generated.MAGIC_ERASE_FRAM);
    expect(canIds.SOLDER_FEEDER_RESET_MAGIC).toEqual(generated.MAGIC_SOLDER_FEEDER_RESET);
  });
});
