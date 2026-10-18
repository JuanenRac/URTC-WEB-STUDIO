import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Building never changes a version: bump.py is the one explicit way to raise it.
describe("the build scripts leave the version alone", () => {
  for (const name of ["build.sh", "build.bat"]) {
    it(`${name} does not run a bump`, () => {
      const lines = readFileSync(resolve(__dirname, "../..", name), "utf8").split(/\r?\n/);
      const calls = lines.filter(line => {
        const code = line.trim();
        if (/^(#|rem |REM |echo|printf)/.test(code)) return false;
        return /bump_manifest_version\.py|bump_version\.py|bump\.py/.test(code);
      });
      expect(calls).toEqual([]);
    });
  }
});
