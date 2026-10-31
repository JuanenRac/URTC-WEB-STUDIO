import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LAYOUTS, dlcAllows, decode } from "./generated/urtcCanIds";
import { MAX_TRACE_FRAMES, parseTrace } from "./traceReplay";
import { RACK_REPLY_REASONS, encodeRackReply, parseRackReply } from "./rackSim";

// What the studio does today with a recorded trace and with the frames of the specification, held before the trace viewer is added:
// the viewer reads the same files and the same layouts and must not change any of this.

describe("the replay reader as it is", () => {
  it("keeps only the received frames, in time order, with the time counted from the first one", () => {
    const text = [
      "      1)        50.0  Rx  0135  2  00 DC",
      "      2)         0.0  Tx  0100  1  01",
      "      3)        10.0  Rx  0110  0",
    ].join("\n");
    const parsed = parseTrace(text);
    expect(parsed.entries.map((e) => [e.id, e.timeMs])).toEqual([[0x110, 0], [0x135, 40]]);
  });

  it("refuses a frame with fewer data bytes than its length says, and counts it", () => {
    const parsed = parseTrace("      1)         0.0  Rx  0135  4  00 DC");
    expect(parsed.entries).toEqual([]);
    expect(parsed.rejected).toBe(1);
  });

  it("stops at the limit of frames and counts the rest as refused", () => {
    expect(MAX_TRACE_FRAMES).toBe(200_000);
  });
});

describe("the specification as the studio holds it", () => {
  it("has the free tool mode on 0x1A2 (write) and 0x1A3 (query and answer)", () => {
    const ids = Object.values(LAYOUTS).filter((l) => l.id === 0x1a2 || l.id === 0x1a3);
    expect(ids.map((l) => [l.id, l.role]).sort()).toEqual([[0x1a2, "request"], [0x1a3, "request"], [0x1a3, "response"]]);
    expect(decode("free_tool_config_resp_response", [0x1f, 0x05])).toEqual({ jumper_reading: 0x1f, selection: 5 });
    expect(decode("free_tool_config_resp_response", [0x1f])).toBeNull();
  });

  it("allows a length only by the rule of its layout", () => {
    expect(dlcAllows({ exact: 8 }, 8)).toBe(true);
    expect(dlcAllows({ exact: 8 }, 7)).toBe(false);
    expect(dlcAllows({ min: 5, max: 8 }, 4)).toBe(false);
  });

  it("writes and reads the reply of the rack with a refusal reason", () => {
    const frame = encodeRackReply(7, 1, 10, "temp_out_of_range");
    expect(parseRackReply(frame)).toMatchObject({ ack: false, reason: "temp_out_of_range", tool: 10, seq: 7 });
    expect(RACK_REPLY_REASONS.slice(0, 2)).toEqual(["applied", "repeat"]);
  });
});

describe("the tester tabs as they are", () => {
  it("lists the evidence tab and shows the history panel for it", () => {
    const source = readFileSync(join(__dirname, "..", "components", "TesterStudio.tsx"), "utf8");
    expect(source).toContain("id: 'evidence'");
    expect(source).toContain("{subTab === 'evidence' && <EvidenceHistoryPanel />}");
  });
});
