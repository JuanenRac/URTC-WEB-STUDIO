import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUNDLED_FIRMWARE } from "./bundledFirmware";
import { parseManifest } from "./flasher";
import { checkSidecar, isFlashableFirmwareName, resolveVersion, validateImage } from "./firmwareImage";

const dir = join(__dirname, "..", "..", "public", "firmware");
const bin = (name: string) => new Uint8Array(readFileSync(join(dir, name)));
const sidecar = (name: string) => parseManifest(JSON.parse(readFileSync(join(dir, `${name}.manifest.json`), "utf8")));

describe("which files are offered for an update", () => {
  it("lists only application images of the chosen board", () => {
    expect(isFlashableFirmwareName("URTC_MAIN_FIRMWARE_v0.3.3.bin", "main")).toBe(true);
    expect(isFlashableFirmwareName("URTC_SLAVE_FIRMWARE_v0.1.9.bin", "slave")).toBe(true);
    expect(isFlashableFirmwareName("URTC_SLAVE_FIRMWARE_v0.1.9.bin", "main")).toBe(false);
    expect(isFlashableFirmwareName("URTC_MAIN_FIRMWARE_v0.3.3.bin", "slave")).toBe(false);
  });
  it("leaves out bootloaders, Intel HEX text, ELF files and sidecars", () => {
    for (const name of readdirSync(dir)) {
      const expected = name === BUNDLED_FIRMWARE.mainApplication || name === BUNDLED_FIRMWARE.slaveApplication;
      expect(isFlashableFirmwareName(name, "main") || isFlashableFirmwareName(name, "slave")).toBe(expected);
    }
    expect(isFlashableFirmwareName("URTC_MAIN_FIRMWARE_v0.3.3.hex", "main")).toBe(false);
    expect(isFlashableFirmwareName("URTC_MAIN_BOOTLOADER_v0.3.8.bin", "main")).toBe(false);
  });
});

describe("the check of an image before it is sent", () => {
  it("accepts the real application images for their own board", () => {
    expect(validateImage(bin(BUNDLED_FIRMWARE.mainApplication), "main")).toBeNull();
    expect(validateImage(bin(BUNDLED_FIRMWARE.slaveApplication), "slave")).toBeNull();
  });
  it("refuses a bootloader and the image of the other board", () => {
    expect(validateImage(bin(BUNDLED_FIRMWARE.mainBootloader), "main")).toBe("bad_reset");
    expect(validateImage(bin(BUNDLED_FIRMWARE.slaveBootloader), "slave")).toBe("bad_reset");
    expect(validateImage(bin(BUNDLED_FIRMWARE.mainApplication), "slave")).not.toBeNull();
  });
  it("refuses text, empty, tiny and oversized files", () => {
    expect(validateImage(new TextEncoder().encode(":020000040800F2\r\n:10000000"), "main")).toBe("bad_stack");
    expect(validateImage(new Uint8Array(0), "main")).toBe("empty");
    expect(validateImage(new Uint8Array(4), "main")).toBe("too_small");
    expect(validateImage(new Uint8Array(112 * 1024 + 1), "main")).toBe("too_large");
  });
});

describe("the sidecar of an image", () => {
  it("is accepted for its own board and refused for the other", () => {
    expect(checkSidecar(sidecar(BUNDLED_FIRMWARE.mainApplication), "main")).toBeNull();
    expect(checkSidecar(sidecar(BUNDLED_FIRMWARE.slaveApplication), "slave")).toBeNull();
    expect(checkSidecar(sidecar(BUNDLED_FIRMWARE.slaveApplication), "main")?.code).toBe("wrong_target");
    expect(checkSidecar(sidecar(BUNDLED_FIRMWARE.mainApplication), "slave")?.code).toBe("wrong_target");
  });
  it("is refused when only the hardware id says it is for another board", () => {
    expect(checkSidecar(parseManifest({ hardware_id: "0x0303CB01" }), "main")?.code).toBe("wrong_target");
    expect(checkSidecar(parseManifest({ hardware_id: "0x0303CC01" }), "main")).toBeNull();
  });
  it("is refused when the signature is present but malformed, as the desktop Flasher does", () => {
    expect(checkSidecar(parseManifest({ hmac_sha256: "abc" }), "main")?.code).toBe("malformed_signature");
    expect(checkSidecar(parseManifest({ hmac_sha256: 12345 }), "main")?.code).toBe("malformed_signature");
    expect(checkSidecar(parseManifest({ hmac_sha256: "a".repeat(64) }), "main")).toBeNull();
    expect(checkSidecar(parseManifest({}), "main")).toBeNull();
    expect(checkSidecar(null, "main")).toBeNull();
  });
});

describe("the version declared to the bootloader", () => {
  it("comes from the manifest first, then from the file name", () => {
    expect(resolveVersion(parseManifest({ version: "0.3.3" }), "x.bin")).toEqual({ major: 0, minor: 3 });
    expect(resolveVersion(null, "URTC_MAIN_FIRMWARE_v0.4.1.bin")).toEqual({ major: 0, minor: 4 });
  });
  it("is unknown, never made up, when neither has one", () => {
    expect(resolveVersion(null, "firmware.bin")).toBeNull();
    expect(resolveVersion(parseManifest({ sha256: "00" }), "my image.bin")).toBeNull();
    expect(resolveVersion(null, "firmware_v300.1.bin")).toBeNull();
  });
});
