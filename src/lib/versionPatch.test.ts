import { describe, expect, it } from "vitest";
import { compareVersions, formatVersion, minorField, parseManifest, parsePatchFrame } from "./flasher";
import { resolveVersion } from "./firmwareImage";

describe("version with an optional patch", () => {
  it("shows major.minor.patch, or major.minor when the patch is not known", () => {
    expect(formatVersion({ major: 0, minor: 3, patch: 5 })).toBe("0.3.5");
    expect(formatVersion({ major: 0, minor: 3 })).toBe("0.3");
    expect(formatVersion({ major: 1, minor: 0, patch: 0 })).toBe("1.0.0");
  });

  it("orders by major, then minor, and by patch only when both sides carry one", () => {
    expect(compareVersions({ major: 0, minor: 3, patch: 3 }, { major: 0, minor: 3, patch: 5 })).toBe(1);
    expect(compareVersions({ major: 0, minor: 3, patch: 5 }, { major: 0, minor: 3, patch: 3 })).toBe(-1);
    expect(compareVersions({ major: 0, minor: 3, patch: 5 }, { major: 0, minor: 3, patch: 5 })).toBe(0);
    // an old board (no patch) or an image without patch: the same major.minor is the same version
    expect(compareVersions({ major: 0, minor: 3 }, { major: 0, minor: 3, patch: 9 })).toBe(0);
    expect(compareVersions({ major: 0, minor: 3, patch: 9 }, { major: 0, minor: 3 })).toBe(0);
    expect(compareVersions({ major: 0, minor: 3 }, { major: 0, minor: 3 })).toBe(0);
    // major and minor always decide, whatever the patches say
    expect(compareVersions({ major: 0, minor: 3, patch: 9 }, { major: 0, minor: 4, patch: 0 })).toBe(1);
    expect(compareVersions({ major: 0, minor: 4 }, { major: 0, minor: 3, patch: 99 })).toBe(-1);
    expect(compareVersions({ major: 1, minor: 0 }, { major: 0, minor: 255, patch: 1 })).toBe(-1);
  });
});

describe("the patch frame 0x7E9", () => {
  it("reads the side, the patch and the flags", () => {
    expect(parsePatchFrame([0x00, 5, 0x00])).toEqual({ side: "application", patch: 5, acceptsPatchInEndUpdate: false });
    expect(parsePatchFrame([0x01, 7, 0x01])).toEqual({ side: "bootloader", patch: 7, acceptsPatchInEndUpdate: true });
    expect(parsePatchFrame([0x00, 0, 0x00])?.patch).toBe(0);
  });
  it("takes 0xFF as an unknown patch and ignores reserved bits and extra bytes", () => {
    expect(parsePatchFrame([0x01, 0xff, 0x01])).toEqual({ side: "bootloader", patch: undefined, acceptsPatchInEndUpdate: true });
    expect(parsePatchFrame([0x01, 4, 0xfe, 1, 2, 3])?.acceptsPatchInEndUpdate).toBe(false);
    expect(parsePatchFrame([0x01, 4, 0x03, 9])?.acceptsPatchInEndUpdate).toBe(true);
  });
  it("is not a patch frame when it is shorter than three bytes", () => {
    expect(parsePatchFrame([0x00, 5])).toBeNull();
    expect(parsePatchFrame([])).toBeNull();
  });
});

describe("the minor field of END_UPDATE", () => {
  it("carries 0x80 | patch in the high byte only for a bootloader that announced it", () => {
    expect(minorField(3, 5, true)).toBe(0x8503);
    expect(minorField(3, 0, true)).toBe(0x8003);
    expect(minorField(3, 127, true)).toBe(0xff03);
  });
  it("stays the legacy minor for an old bootloader, an image without patch or a patch that does not fit", () => {
    expect(minorField(3, 5, false)).toBe(3);
    expect(minorField(3, undefined, true)).toBe(3);
    expect(minorField(3, 128, true)).toBe(3);
    expect(minorField(3, -1, true)).toBe(3);
  });
});

describe("the patch of an image", () => {
  it("is the third number of the manifest version or of the file name", () => {
    expect(parseManifest({ version: "0.3.5" })).toMatchObject({ versionMajor: 0, versionMinor: 3, versionPatch: 5 });
    expect(parseManifest({ version: "0.3" }).versionPatch).toBeUndefined();
    expect(resolveVersion(parseManifest({ version: "0.3.5" }), "x.bin")).toEqual({ major: 0, minor: 3, patch: 5 });
    expect(resolveVersion(null, "URTC_SLAVE_FIRMWARE_v0.1.9.bin")).toEqual({ major: 0, minor: 1, patch: 9 });
  });
  it("is absent when the version has two numbers or the patch cannot travel", () => {
    expect(resolveVersion(parseManifest({ version: "0.3" }), "x.bin")).toEqual({ major: 0, minor: 3 });
    expect(resolveVersion(null, "image_v0.3.bin")).toEqual({ major: 0, minor: 3 });
    expect(resolveVersion(null, "image_v0.3.200.bin")).toEqual({ major: 0, minor: 3 });
  });
  it("takes the manifest version before the file name, patch included", () => {
    expect(resolveVersion(parseManifest({ version: "0.3.5" }), "URTC_MAIN_FIRMWARE_v0.2.9.bin")).toEqual({ major: 0, minor: 3, patch: 5 });
    expect(resolveVersion(parseManifest({ version: "0.3" }), "URTC_MAIN_FIRMWARE_v0.3.9.bin")).toEqual({ major: 0, minor: 3 });
  });
});
