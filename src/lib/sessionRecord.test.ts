import { describe, expect, it } from "vitest";
import { checkSession, manifestJson, sessionFileNames, sessionLogText, sessionManifest, sha256Hex, signedManifest } from "./sessionRecord";
import { checkSignature, loadOrCreateKey, signPayload } from "./recordSigning";

const frame = (timestamp: string, direction: "Tx" | "Rx", idHex: string, dataHex: string) => ({ timestamp, direction, idHex, dlc: dataHex ? dataHex.split(" ").length : 0, dataHex });

describe("the log of a session", () => {
  it("is one line per frame, oldest first, ending in a newline", () => {
    const text = sessionLogText([frame("00:00:01.000", "Tx", "0x100", "01 02"), frame("00:00:01.050", "Rx", "0x101", "")]);
    expect(text).toBe("00:00:01.000 Tx 0x100 [2] 01 02\n00:00:01.050 Rx 0x101 [0]\n");
  });
  it("names the two files of a saved session from one stamp", () => {
    expect(sessionFileNames("20000101_000000")).toEqual({ log: "urtc_web_session_20000101_000000.log", record: "urtc_web_session_20000101_000000.json" });
  });
});

describe("the record of a session", () => {
  const log = "a\nb\né\n";

  it("writes the same bytes the desktop Tester writes for the same log and context", async () => {
    // produced by tester_result_record.session_manifest with json.dumps(indent=2, sort_keys=True)
    const expected = [
      "{",
      '  "connected": "True",',
      '  "log_bytes": 7,',
      '  "log_file": "urtc_web_session_x.log",',
      '  "log_sha256": "6f4045b60fa4b989a9dc97fb010ab68cde9e3d7c960fa80c44f5ffc372239ed1",',
      '  "port": "COM3\\u00e9",',
      '  "tester_version": "1.2.3"',
      "}",
    ].join("\n");
    const manifest = await sessionManifest(log, "urtc_web_session_x.log", { tester_version: "1.2.3", port: "COM3é", connected: "True" });
    expect(manifestJson(manifest)).toBe(expected);
  });

  it("hashes the UTF-8 text", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex(log)).toBe("6f4045b60fa4b989a9dc97fb010ab68cde9e3d7c960fa80c44f5ffc372239ed1");
  });

  it("is accepted with its own log", async () => {
    const record = manifestJson(await sessionManifest(log, "session.log", { studio_version: "0.3.6" }));
    expect(await checkSession(record, log)).toEqual({ ok: true, logFile: "session.log", bytes: 7, signature: { state: "absent" } });
  });

  it("is refused for a log that was edited, whatever the size", async () => {
    const record = manifestJson(await sessionManifest(log, "session.log"));
    expect(await checkSession(record, "a\nc\né\n")).toEqual({ ok: false, reason: "hash", logFile: "session.log" });
    expect(await checkSession(record, log + "x\n")).toEqual({ ok: false, reason: "size", logFile: "session.log" });
  });

  it("is refused when it is not a record", async () => {
    for (const text of ["", "not json", "[]", "null", "{}", '{"log_file":"a","log_sha256":"zz","log_bytes":1}', '{"log_file":"a","log_sha256":"' + "0".repeat(64) + '","log_bytes":-1}', '{"log_file":1,"log_sha256":"' + "0".repeat(64) + '","log_bytes":1}']) {
      expect(await checkSession(text, log), text).toEqual({ ok: false, reason: "record" });
    }
  });
});


describe("the signature of a record", () => {
  // The seed and the signature are those of urtc_common.record_signing for the same session (RFC 8032 test key 1).
  const jwk: JsonWebKey = { kty: "OKP", crv: "Ed25519", d: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A", x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" };
  const payload = "session.log\n" + "ab".repeat(32) + "\n7";
  const expected = {
    algorithm: "Ed25519",
    key_id: "21fe31dfa154a261",
    public_key: "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    signature: "e8ec9f734e59b91679ef58f8c87830060d3c080c7b3b54548cea84959f33e42e3b487cb09b69c8d2d66f2d0f398853fbb0485a28b0bbdfadc876b4242d2d5504",
  };

  it("is the signature the desktop programs make for the same key and session", async () => {
    expect(await signPayload("session", payload, jwk)).toEqual(expected);
    expect(await checkSignature(expected, "session", payload)).toEqual({ state: "valid", keyId: "21fe31dfa154a261" });
  });

  it("is refused for another payload, another kind or a changed block", async () => {
    expect(await checkSignature(expected, "session", payload + "0")).toEqual({ state: "invalid" });
    expect(await checkSignature(expected, "update-report", payload)).toEqual({ state: "invalid" });
    expect(await checkSignature({ ...expected, key_id: "0".repeat(16) }, "session", payload)).toEqual({ state: "invalid" });
    expect(await checkSignature({ ...expected, signature: "00".repeat(64) }, "session", payload)).toEqual({ state: "invalid" });
    expect(await checkSignature({ ...expected, algorithm: "RSA" }, "session", payload)).toEqual({ state: "invalid" });
    expect(await checkSignature("x", "session", payload)).toEqual({ state: "invalid" });
    expect(await checkSignature(undefined, "session", payload)).toEqual({ state: "absent" });
  });

  it("makes a key once and keeps it in the store", async () => {
    const kept = new Map<string, string>();
    const store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
    const first = await loadOrCreateKey(store);
    expect(first?.d).toBeTruthy();
    expect(await loadOrCreateKey(store)).toEqual(first);
    expect(kept.size).toBe(1);
  });

  it("signs a saved record, checks it with its log and notices a signature copied onto another log", async () => {
    const log = "a\nb\n";
    const record = manifestJson(await signedManifest(await sessionManifest(log, "session.log", { studio_version: "0.3.6" }), jwk));
    expect(record).toContain('"signature": {\n    "algorithm": "Ed25519",');
    expect(await checkSession(record, log)).toMatchObject({ ok: true, signature: { state: "valid", keyId: "21fe31dfa154a261" } });
    const other = JSON.parse(record);
    other.log_sha256 = await sha256Hex("c\n");
    other.log_bytes = 2;
    expect(await checkSession(JSON.stringify(other), "c\n")).toMatchObject({ ok: true, signature: { state: "invalid" } });
  });

  it("leaves the record without a signature where there is no key", async () => {
    const manifest = await sessionManifest("a\n", "session.log");
    expect(await signedManifest(manifest, null)).toEqual(manifest);
  });
});
