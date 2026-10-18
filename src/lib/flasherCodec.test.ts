// =============================================================================
// URTC Web Studio - src/lib/flasherCodec.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
//
// The byte helpers every bootloader frame is built from (big-endian packing,
// CRC32, SHA-256 and HMAC-SHA256) against published reference values, and the
// small hex and text helpers around the custom-frame and trace panels.
// =============================================================================
import { describe, expect, it } from "vitest";
import {
  computeHmacSha256, computeSha256Hex, getCrc32, packUInt16BE, packUInt32BE, unpackUInt16BE, unpackUInt32BE,
} from "./flasher";
import { hexToBytes, SignatureError } from "./firmwareSignature";
import { customFrameErrorText } from "./customFrame";
import { traceFileName } from "./traceExport";
import { THERMAL_FAULT_TEXT } from "./quickState";

const bytes = (text: string) => Uint8Array.from(Buffer.from(text, "hex"));
const toHex = (data: Uint8Array) => Buffer.from(data).toString("hex");
const buffer = (data: Uint8Array): ArrayBuffer => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

describe("big-endian packing", () => {
  it("packs and unpacks 32-bit values, including the top bit", () => {
    expect(packUInt32BE(0x0303cc01)).toEqual([0x03, 0x03, 0xcc, 0x01]);
    expect(packUInt32BE(0xffffffff)).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(packUInt32BE(0)).toEqual([0, 0, 0, 0]);
    for (const value of [0, 1, 0x7fffffff, 0x80000000, 0xdeadbeef, 0xffffffff]) {
      expect(unpackUInt32BE(packUInt32BE(value))).toBe(value);
    }
  });

  it("unpacks 32-bit values as unsigned numbers", () => {
    expect(unpackUInt32BE([0x80, 0, 0, 0])).toBe(0x80000000);
    expect(unpackUInt32BE(Uint8Array.of(0xff, 0xff, 0xff, 0xff))).toBe(0xffffffff);
  });

  it("packs and unpacks 16-bit values", () => {
    expect(packUInt16BE(0x8503)).toEqual([0x85, 0x03]);
    expect(packUInt16BE(0x1ffff)).toEqual([0xff, 0xff]);
    for (const value of [0, 1, 0x7fff, 0x8000, 0xffff]) expect(unpackUInt16BE(packUInt16BE(value))).toBe(value);
  });
});

describe("CRC32", () => {
  it("matches the standard check value", () => {
    expect(getCrc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(getCrc32(new Uint8Array(0))).toBe(0);
  });

  it("is unsigned for an input whose checksum has the top bit set", () => {
    expect(getCrc32(Uint8Array.of(0))).toBe(0xd202ef8d);
  });
});

describe("SHA-256 and HMAC-SHA256", () => {
  it("hashes the empty string and 'abc'", async () => {
    expect(await computeSha256Hex(new ArrayBuffer(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await computeSha256Hex(buffer(new TextEncoder().encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches RFC 4231 test cases 1, 2 and 6 (short key, text key, key longer than a block)", async () => {
    const case1 = await computeHmacSha256(buffer(new TextEncoder().encode("Hi There")), new Uint8Array(20).fill(0x0b) as Uint8Array<ArrayBuffer>);
    expect(toHex(case1)).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
    const case2 = await computeHmacSha256(buffer(new TextEncoder().encode("what do ya want for nothing?")), new TextEncoder().encode("Jefe") as Uint8Array<ArrayBuffer>);
    expect(toHex(case2)).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    const case6 = await computeHmacSha256(
      buffer(new TextEncoder().encode("Test Using Larger Than Block-Size Key - Hash Key First")),
      new Uint8Array(131).fill(0xaa) as Uint8Array<ArrayBuffer>,
    );
    expect(toHex(case6)).toBe("60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
  });

  it("gives a different signature for a different image or key", async () => {
    const key = bytes("01".repeat(32)) as Uint8Array<ArrayBuffer>;
    const a = await computeHmacSha256(buffer(Uint8Array.of(1, 2, 3)), key);
    const b = await computeHmacSha256(buffer(Uint8Array.of(1, 2, 4)), key);
    const c = await computeHmacSha256(buffer(Uint8Array.of(1, 2, 3)), bytes("02".repeat(32)) as Uint8Array<ArrayBuffer>);
    expect(toHex(a)).not.toBe(toHex(b));
    expect(toHex(a)).not.toBe(toHex(c));
    expect(a.length).toBe(32);
  });
});

describe("hexToBytes", () => {
  it("accepts a 0x prefix, surrounding blanks and either case", () => {
    expect(Array.from(hexToBytes("0xDEadBEef"))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(Array.from(hexToBytes("  00ff  "))).toEqual([0, 255]);
  });

  it.each(["", "abc", "zz", "0x", "12 34", "1g"])("rejects %j", (text) => {
    expect(() => hexToBytes(text)).toThrow(SignatureError);
  });
});

describe("small text helpers", () => {
  it("builds the trace file name from the format", () => {
    expect(traceFileName("trc")).toBe("urtc_bus_trace.trc");
    expect(traceFileName("asc")).toBe("urtc_bus_trace.asc");
  });

  it("returns the translated text of each custom-frame error, with the fallback as default", () => {
    const echo = (key: string, fallback: string) => `${key}|${fallback}`;
    expect(customFrameErrorText(echo, "bad_id")).toContain("testerglobal.custom_frame_bad_id|");
    expect(customFrameErrorText(echo, "bad_byte")).toContain("custom_frame_bad_byte");
    expect(customFrameErrorText(echo, "too_many_bytes")).toContain("custom_frame_too_many");
    const fallback = (_key: string, text: string) => text;
    expect(customFrameErrorText(fallback, "too_many_bytes")).toMatch(/at most 8/);
  });

  it("names every thermal fault code the firmware reports", () => {
    expect(Object.keys(THERMAL_FAULT_TEXT).map(Number)).toEqual([1, 2, 3]);
    expect(THERMAL_FAULT_TEXT[1]).toMatch(/MAXTEMP/);
  });
});
