import { describe, expect, it } from "vitest";
import { checkSession, manifestJson, sessionFileNames, sessionLogText, sessionManifest, sha256Hex } from "./sessionRecord";

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
    expect(await checkSession(record, log)).toEqual({ ok: true, logFile: "session.log", bytes: 7 });
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
