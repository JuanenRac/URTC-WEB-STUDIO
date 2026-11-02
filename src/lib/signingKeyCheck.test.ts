import { describe, expect, it } from "vitest";
import { CanFrame } from "../types";
import { VersionBus, queryMainVersion } from "./boardVersion";
import { compareSigningKey } from "./signingKeyCheck";

function frame(id: number, data: number[]): CanFrame {
  return { id, idHex: "0x" + id.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

const BOOT_7F9 = [0x01, 0x03, 0x03, 0xcc, 0x01, 0x00, 0x00, 0x03];

function bus(boot7fa: number[]): VersionBus {
  return {
    async request(_id, _data, respId) { return respId === 0x7f9 ? frame(0x7f9, BOOT_7F9) : null; },
    async waitForFrame(id) { return id === 0x7fa ? frame(0x7fa, boot7fa) : null; },
    flushFrames() {},
  };
}

describe("the signing key before the transfer", () => {
  it("reads the fingerprint after the version when the bootloader sends eleven bytes", async () => {
    const info = await queryMainVersion(bus([1, 0, 0, 0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0x07, 0x18]));
    expect(info).toMatchObject({ responder: "bootloader", bootMajor: 1, bootKeyId: "a1b2c3d4e5f60718" });
  });

  it("leaves the fingerprint unknown for a bootloader that sends three bytes", async () => {
    const info = await queryMainVersion(bus([1, 0, 0]));
    expect(info?.bootMajor).toBe(1);
    expect(info?.bootKeyId).toBeUndefined();
  });

  it("matches the same key, also against a longer fingerprint that starts with it, and ignores case and a 0x prefix", () => {
    expect(compareSigningKey("a1b2c3d4e5f60718", "A1B2C3D4E5F60718")).toBe("match");
    expect(compareSigningKey("a1b2c3d4e5f60718", "0xa1b2c3d4e5f60718" + "00".repeat(24))).toBe("match");
  });

  it("calls a different key a mismatch", () => {
    expect(compareSigningKey("a1b2c3d4e5f60718", "0011223344556677")).toBe("mismatch");
  });

  it("never calls a missing side a mismatch", () => {
    expect(compareSigningKey(undefined, "0011223344556677")).toBe("unknown");
    expect(compareSigningKey("a1b2c3d4e5f60718", undefined)).toBe("unknown");
    expect(compareSigningKey("", "")).toBe("unknown");
  });
});
