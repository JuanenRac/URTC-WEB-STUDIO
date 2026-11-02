import { describe, expect, it } from "vitest";
import { CanFrame } from "../types";
import { VersionBus, queryMainVersion } from "./boardVersion";
import { compareSigningKey, precheckOutcome } from "./signingKeyCheck";

function frame(id: number, data: number[]): CanFrame {
  return { id, idHex: "0x" + id.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

const BOOT_7F9 = [0x01, 0x03, 0x03, 0xcc, 0x01, 0x00, 0x00, 0x03];
const APP_7F9 = [0x00, 0x03, 0x03, 0xcc, 0x01, 0x00, 0x00, 0x03];
const KEY = [0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0x07, 0x18];
const OTHER_KEY = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77];

/** A bus where the answers to a waitForFrame are the queued frames of each identifier, in order (the second wait gets the second frame). */
function bus(answers: { f7f9?: number[]; f7fa?: number[]; keys?: number[][] }): VersionBus {
  const keys = [...(answers.keys ?? [])];
  return {
    async request(_id, _data, respId) { return respId === 0x7f9 ? frame(0x7f9, answers.f7f9 ?? BOOT_7F9) : null; },
    async waitForFrame(id) {
      if (id === 0x7fa) return answers.f7fa ? frame(0x7fa, answers.f7fa) : null;
      if (id === 0x7ed) { const next = keys.shift(); return next ? frame(0x7ed, next) : null; }
      return null;
    },
    flushFrames() {},
  };
}

describe("the signing key before the transfer", () => {
  it("reads the fingerprint from 0x7ED when the bootloader sends it", async () => {
    const info = await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [KEY] }));
    expect(info).toMatchObject({ responder: "bootloader", bootMajor: 1, bootMinor: 0, bootPatch: 0, bootKeyId: "a1b2c3d4e5f60718" });
  });

  it("leaves the fingerprint unknown for a bootloader that sends no 0x7ED", async () => {
    const info = await queryMainVersion(bus({ f7fa: [1, 0, 0] }));
    expect(info?.bootMajor).toBe(1);
    expect(info?.bootKeyId).toBeUndefined();
  });

  it("does not read an eleven-byte 0x7FA: it cannot exist on a classic CAN frame, so it is neither a version nor a fingerprint", async () => {
    const info = await queryMainVersion(bus({ f7fa: [1, 0, 0, ...KEY] }));
    expect(info?.bootMajor).toBeUndefined();
    expect(info?.bootKeyId).toBeUndefined();
  });

  it("ignores a 0x7ED of the wrong length", async () => {
    for (const payload of [KEY.slice(0, 7), [...KEY, 0], []]) {
      const info = await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [payload] }));
      expect(info?.bootKeyId).toBeUndefined();
    }
  });

  it("never takes a fingerprint from an application", async () => {
    const info = await queryMainVersion(bus({ f7f9: APP_7F9, keys: [KEY] }));
    expect(info).toMatchObject({ responder: "application" });
    expect(info?.bootKeyId).toBeUndefined();
  });

  it("gives the fingerprint when two heads of a mixed bus answer with the same key, or when an older head sends none", async () => {
    expect((await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [KEY, KEY] })))?.bootKeyId).toBe("a1b2c3d4e5f60718");
    expect((await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [KEY] })))?.bootKeyId).toBe("a1b2c3d4e5f60718");
  });

  it("gives no data when two heads answer with different keys and none is selected", async () => {
    const info = await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [KEY, OTHER_KEY] }));
    expect(info?.bootKeyId).toBeUndefined();
    expect(compareSigningKey(info?.bootKeyId, "0011223344556677")).toBe("unknown");
  });

  it("ignores a second 0x7ED of the wrong length and keeps the first fingerprint", async () => {
    const info = await queryMainVersion(bus({ f7fa: [1, 0, 0], keys: [KEY, KEY.slice(0, 5)] }));
    expect(info?.bootKeyId).toBe("a1b2c3d4e5f60718");
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

  it("says no_data only when a bootloader answered without a fingerprint and the image declares one", () => {
    expect(precheckOutcome(undefined, "0011223344556677", true)).toBe("no_data");
    expect(precheckOutcome(undefined, "0011223344556677", false)).toBe("unknown");   // an application never gives one
    expect(precheckOutcome(undefined, undefined, true)).toBe("unknown");             // nothing declared, nothing to compare
    expect(precheckOutcome("a1b2c3d4e5f60718", "0011223344556677", true)).toBe("mismatch");
    expect(precheckOutcome("a1b2c3d4e5f60718", "a1b2c3d4e5f60718", true)).toBe("match");
  });
});
