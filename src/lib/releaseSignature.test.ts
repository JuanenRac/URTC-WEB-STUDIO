import { describe, expect, it } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUNDLED_FIRMWARE } from "./bundledFirmware";
import { RELEASE_PUBLIC_KEY_HEX, checkReleaseSignature, signedMessage } from "./releaseSignature";

const sha256Hex = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const image = new Uint8Array([0x00, 0x20, 0x00, 0x20, 0xc1, 0x81, 0x00, 0x08, 1, 2, 3, 4]);
const keys = generateKeyPairSync("ed25519");
const publicHex = (keys.publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("hex");

function signed(name: string, data: Uint8Array): string {
  return sign(null, Buffer.from(signedMessage(name, sha256Hex(data)), "utf8"), keys.privateKey).toString("hex");
}

describe("release signature check", () => {
  it("accepts the signature of the file it was made for", async () => {
    expect(await checkReleaseSignature("URTC_MAIN_FIRMWARE_v9.9.9.bin", image, signed("URTC_MAIN_FIRMWARE_v9.9.9.bin", image) + "\n", publicHex)).toBe("signed");
  });

  it("says unsigned when the release has no signature file", async () => {
    expect(await checkReleaseSignature("a.bin", image, null, publicHex)).toBe("unsigned");
  });

  it("refuses a signature made for another name, other bytes, another key or in the wrong shape", async () => {
    const good = signed("a.bin", image);
    expect(await checkReleaseSignature("b.bin", image, good, publicHex)).toBe("invalid");
    expect(await checkReleaseSignature("a.bin", new Uint8Array([...image, 9]), good, publicHex)).toBe("invalid");
    expect(await checkReleaseSignature("a.bin", image, good, RELEASE_PUBLIC_KEY_HEX)).toBe("invalid");
    expect(await checkReleaseSignature("a.bin", image, good.slice(2), publicHex)).toBe("invalid");
    expect(await checkReleaseSignature("a.bin", image, "zz".repeat(64), publicHex)).toBe("invalid");
    expect(await checkReleaseSignature("a.bin", image, "", publicHex)).toBe("invalid");
  });

  it("pins the same public key as the synchronisation script and the documentation of the releases", () => {
    const script = readFileSync(resolve(__dirname, "../../scripts/sync-firmware.mjs"), "utf8");
    expect(script).toContain(`'${RELEASE_PUBLIC_KEY_HEX}'`);
  });

  it("verifies the bundled images with the pinned key when they carry a signature", async () => {
    let checked = 0;
    for (const name of Object.values(BUNDLED_FIRMWARE)) {
      const binPath = resolve(__dirname, "../../public/firmware", name);
      const sigPath = `${binPath}.sig`;
      if (!existsSync(sigPath)) continue;
      const state = await checkReleaseSignature(name, new Uint8Array(readFileSync(binPath)), readFileSync(sigPath, "ascii"));
      expect(state, name).toBe("signed");
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
