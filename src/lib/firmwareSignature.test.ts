import { describe, expect, it } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { parseManifest } from "./flasher";
import { SignatureError, parseSigningKey, resolveSignature } from "./firmwareSignature";
import { decodeQuickState } from "./quickState";

const image = new Uint8Array([0x00, 0x20, 0x00, 0x20, 0xc1, 0x81, 0x00, 0x08, 1, 2, 3, 4]);
const sha = createHash("sha256").update(image).digest("hex");
const keyHex = "11".repeat(32);
const hmac = createHmac("sha256", Buffer.from(keyHex, "hex")).update(image).digest("hex");

describe("firmware signature resolution", () => {
  it("parses hmac_sha256 and the signing key kind from a manifest", () => {
    const m = parseManifest({ version: "0.3.2", sha256: sha, hmac_sha256: hmac.toUpperCase(), signing_key_kind: "dev", signing_key_id: "abc" });
    expect(m.hmacSha256).toBe(hmac);
    expect(m.signingKeyKind).toBe("dev");
    expect(parseManifest({ hmac_sha256: "zz" }).hmacSha256).toBeUndefined();
  });

  it("sends the published signature without needing any key", async () => {
    const r = await resolveSignature(image, parseManifest({ sha256: sha, hmac_sha256: hmac }));
    expect(r.source).toBe("manifest");
    expect(Buffer.from(r.signature).toString("hex")).toBe(hmac);
  });

  it("refuses a file whose sha256 does not match its manifest", async () => {
    await expect(resolveSignature(image, parseManifest({ sha256: "00".repeat(32), hmac_sha256: hmac }))).rejects.toBeInstanceOf(SignatureError);
  });

  it("refuses an unsigned image when no key was entered", async () => {
    await expect(resolveSignature(image, null)).rejects.toBeInstanceOf(SignatureError);
    await expect(resolveSignature(image, parseManifest({ sha256: sha }), "")).rejects.toBeInstanceOf(SignatureError);
  });

  it("signs locally only with a key entered at run time", async () => {
    const r = await resolveSignature(image, null, keyHex);
    expect(r.source).toBe("runtime-key");
    expect(Buffer.from(r.signature).toString("hex")).toBe(hmac);
  });

  it("rejects a malformed key", () => {
    expect(() => parseSigningKey("1234")).toThrow(SignatureError);
    expect(parseSigningKey("0x" + "ab".repeat(32)).length).toBe(32);
  });
});

describe("0x111 quick state", () => {
  it("decodes an old 4-byte answer as not reporting the new fields", () => {
    const q = decodeQuickState([0, 1, 0, 0]);
    expect(q.systemError).toBe(true);
    expect(q.thermalFault).toBeNull();
    expect(q.resetCause).toBeNull();
    expect(q.errorMessage).toBe("CRITICAL ERROR DECLARED");
  });

  it("explains a thermal runaway fault and a watchdog reset", () => {
    const q = decodeQuickState([10, 1, 0, 0, 2, 0x01]);
    expect(q.thermalFault).toBe(2);
    expect(q.errorMessage).toContain("HEATING NO RISE");
    expect(q.watchdogReset).toBe(true);
    expect(decodeQuickState([10, 0, 0, 0, 0, 0x08]).watchdogReset).toBe(false);
  });
});
