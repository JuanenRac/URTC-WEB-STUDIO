import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUNDLED_FIRMWARE } from "./bundledFirmware";
import { parseManifest } from "./flasher";

const dir = join(__dirname, "..", "..", "public", "firmware");

describe("bundled firmware (public/firmware)", () => {
  for (const [role, bin] of Object.entries(BUNDLED_FIRMWARE)) {
    it(`${role}: ${bin} exists and matches its published sha256`, () => {
      expect(existsSync(join(dir, bin))).toBe(true);
      const manifest = parseManifest(JSON.parse(readFileSync(join(dir, `${bin}.manifest.json`), "utf8")));
      const actual = createHash("sha256").update(readFileSync(join(dir, bin))).digest("hex");
      expect(manifest.sha256).toBe(actual);
      expect(readFileSync(join(dir, `${bin}.sha256`), "utf8").startsWith(actual)).toBe(true);
      if (role.endsWith("Application")) {
        // The image carries the Ed25519 record that the bootloader checks; only an older set has the HMAC of the manifest instead.
        const record = join(dir, `${bin}.imgsig`);
        if (existsSync(record)) expect(readFileSync(record, "ascii")).toMatch(/^[0-9a-f]{152}\n?$/);
        else expect(manifest.hmacSha256).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  }
});
