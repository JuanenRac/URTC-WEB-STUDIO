// =============================================================================
// URTC Web Studio - src/lib/imageHeader.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
import { describe, expect, it } from "vitest";
import vectors from "./generated/image_header_embedded_vectors.json";
import {
  DEFAULT_HEADER_POLICY, IMAGE_EMBED_OFFSET, crc32, headerVersionText, hex32, inspectImage, parseHeaderPolicy, verifyEmbedded, versionPartsFromName,
} from "./imageHeader";

// The header inside a firmware image, against the vectors written by the Python reference of URTC-COMMON (the C header is held to the same ones).
const bytes = (text: string): Uint8Array => new Uint8Array((text.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)));

describe("the header inside the image", () => {
  it("reads the constants of the specification", () => {
    expect(IMAGE_EMBED_OFFSET).toBe(vectors.embed_offset);
    expect(DEFAULT_HEADER_POLICY).toBe(vectors.default_policy);
  });

  it("computes the CRC-32 the way zlib does", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(new Uint8Array([1, 2, 3, 4]), 1, 2)).toBe(crc32(new Uint8Array([1, 0, 0, 4])));
  });

  it.each(vectors.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const { status, info } = verifyEmbedded(bytes(c.image));
    expect(status).toBe(c.status);
    if ("info" in c && c.info) {
      expect(info?.hardwareId).toBe(c.info.hardware_id);
      expect([...(info?.version ?? [])]).toEqual(c.info.version);
      expect(info?.flags).toBe(c.info.flags);
      expect(info?.payloadLength).toBe(c.info.payload_length);
      expect(info?.payloadCrc32).toBe(c.info.payload_crc32);
    } else {
      expect(info).toBeUndefined();
    }
  });

  it.each(vectors.policy_cases.map((c) => [c.name, c] as const))("the switch: %s", (_name, c) => {
    const check = inspectImage(bytes(c.image), c.policy, c.hardware_id ?? undefined, c.version ?? undefined);
    expect({ accepted: check.accepted, kind: check.kind, reason: check.reason, warn: check.warn }).toEqual({ accepted: c.accepted, kind: c.kind, reason: c.reason, warn: c.warn });
  });
});

describe("the switch and the file name", () => {
  it("is conservative: the default warns and a value nobody knows is the strictest", () => {
    expect(parseHeaderPolicy(undefined)).toBe("warn");
    expect(parseHeaderPolicy("")).toBe("warn");
    expect(parseHeaderPolicy(" Accept ")).toBe("accept");
    expect(parseHeaderPolicy("maybe")).toBe("require");
    expect(parseHeaderPolicy(0)).toBe("require");
  });

  it("never lets a damaged header through, whatever the switch says", () => {
    const sealed = bytes(vectors.cases[0].image);
    sealed[700] ^= 1;
    for (const policy of ["accept", "warn", "require"]) expect(inspectImage(sealed, policy).accepted).toBe(false);
  });

  it("takes three or four components from the file name", () => {
    expect(versionPartsFromName("URTC_MAIN_FIRMWARE_v0.8.1.3.bin")).toEqual([0, 8, 1, 3]);
    expect(versionPartsFromName("URTC_MAIN_FIRMWARE_v0.8.1.bin")).toEqual([0, 8, 1]);
    expect(versionPartsFromName("firmware_v1.2.bin")).toBeUndefined();
    expect(versionPartsFromName("custom.bin")).toBeUndefined();
  });

  it("writes the identity the way the log shows it", () => {
    const { info } = verifyEmbedded(bytes(vectors.cases[0].image));
    expect(info && headerVersionText(info)).toBe("0.8.1.3");
    expect(hex32(0x0303cc01)).toBe("0x0303CC01");
  });
});
