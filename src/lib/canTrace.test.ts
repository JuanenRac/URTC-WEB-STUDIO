import { describe, expect, it } from "vitest";
import vectors from "./canConformance.vectors.json";
import { LAYOUTS, RACK_ID_REPLY, dlcAllows } from "./generated/urtcCanIds";
import { RACK_REPLY_REASONS, encodeRackReply } from "./rackSim";
import { toAscTrace, toTrcTrace } from "./traceExport";
import {
  DEFAULT_TRACE_SETTINGS, MAX_LINE_CHARS, MAX_LISTED_PROBLEMS, MAX_TRACE_BYTES, MAX_TRACE_ROWS, TRACE_CSV_COLUMNS,
  csvCell, decodeTraceFrame, filterRows, parseCanTrace, parseIdList, sortRows, summarizeRows, timelineBuckets, traceCsv, traceJson,
} from "./canTrace";

const hex = (text: string): number[] => (text.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
const trc = (n: number, ms: number, dir: "Rx" | "Tx", id: string, dlc: number, data: string) => `${String(n).padStart(7)})${ms.toFixed(1).padStart(12)}  ${dir}  ${id}  ${dlc}  ${data}`.trimEnd();
const file = (...lines: string[]) => [";$FILEVERSION=1.1", ";", ...lines].join("\r\n") + "\r\n";

describe("reading the frames with the layouts of the specification", () => {
  const decodable = vectors.frames_decode.filter((v) => v.fields !== null);

  it.each(decodable.map((v) => [v.name, v] as const))("%s", (_name, v) => {
    const data = hex(v.frame.data);
    const layout = LAYOUTS[v.layout];
    const out = decodeTraceFrame(Number.parseInt(v.frame.id, 16), data, data.length, layout.role === "request" ? "Tx" : "Rx");
    if (dlcAllows(layout.dlc, data.length)) {
      expect(out.name).toBe(v.layout);
      expect(out.type).toBe(v.layout === "rack_reply" ? "reply" : layout.role);   // the reply of the rack is its own type of line
      for (const [key, value] of Object.entries(v.fields as Record<string, unknown>)) {
        if (v.layout === "rack_reply" && key === "reason") expect(out.summary).toContain(`reason=${RACK_REPLY_REASONS[value as number]}`);   // the reason is told by name
        else if (typeof value === "number") expect(out.summary).toContain(`${key}=${value}`);
      }
    }
  });

  it("calls an identifier that is not in the specification unknown and does not mark it", () => {
    const out = decodeTraceFrame(0x7aa, [1, 2], 2, "Rx");
    expect(out).toMatchObject({ name: "", type: "unknown", result: "info", anomalies: [] });
  });

  it("picks the request or the answer of a shared identifier by the direction", () => {
    expect(decodeTraceFrame(0x1a3, [], 0, "Tx").name).toBe("free_tool_config_resp_request");
    expect(decodeTraceFrame(0x1a3, [0x1f, 0x05], 2, "Rx").name).toBe("free_tool_config_resp_response");
  });

  it("names the tool of the active tool answer and of the free tool frames", () => {
    expect(decodeTraceFrame(0x111, [10, 0, 0, 0], 4, "Rx")).toMatchObject({ tool: 10, result: "info" });
    expect(decodeTraceFrame(0x1a2, [6], 1, "Tx")).toMatchObject({ name: "set_free_tool", tool: 5, type: "request" });
  });

  it("marks the answer of a head with a fault, and the failed verification of the bootloader, as refusals or faults", () => {
    expect(decodeTraceFrame(0x111, [10, 1, 0, 0], 4, "Rx").result).toBe("fault");
    expect(decodeTraceFrame(0x111, [10, 0, 1, 0], 4, "Rx").result).toBe("fault");
    expect(decodeTraceFrame(0x7f5, [0x05, 0x02], 2, "Rx").result).toBe("refused");
    expect(decodeTraceFrame(0x7f5, [0xff], 1, "Rx").result).toBe("refused");
    expect(decodeTraceFrame(0x7f5, [0x04], 1, "Rx").result).toBe("ok");
    expect(decodeTraceFrame(0x7f5, [0x03], 1, "Rx").result).toBe("info");
  });

  it("reads the node of the multinode frames and their fault state", () => {
    const ok = decodeTraceFrame(0x445, [0x01, 0x00, 0x00, 0x2a], 4, "Rx");
    expect(ok).toMatchObject({ name: "mn_node_status", node: 5, result: "info" });
    expect(decodeTraceFrame(0x445, [0x02, 0x00, 0x00, 0x2a], 4, "Rx").result).toBe("fault");
    expect(decodeTraceFrame(0x445, [0x04, 0x00, 0x00, 0x2a], 4, "Rx").result).toBe("fault");
    expect(decodeTraceFrame(0x445, [0x01, 0x07, 0x00, 0x2a], 4, "Rx").result).toBe("fault");
    expect(decodeTraceFrame(0x400, [1, 2], 2, "Tx").node).toBeNull();
  });

  describe("free tool mode (0x1A2 and 0x1A3)", () => {
    it("takes a valid answer", () => expect(decodeTraceFrame(0x1a3, [0x1f, 0x06], 2, "Rx")).toMatchObject({ result: "ok", tool: 5 }));
    it.each([
      ["unset", [0x1f, 0x00]],
      ["foreign jumper reading", [0x05, 0x01]],
      ["out of range", [0x1f, 0x1a]],
    ])("refuses an answer that is %s", (_n, data) => expect(decodeTraceFrame(0x1a3, data, 2, "Rx")).toMatchObject({ result: "refused", tool: null }));
    it("marks a one-byte answer as too short", () => {
      const out = decodeTraceFrame(0x1a3, [0x1f], 1, "Rx");
      expect(out.result).toBe("malformed");
      expect(out.anomalies).toContain("bad_length");
    });
  });

  describe("the reply of the rack on the standard identifier 0x261", () => {
    const reply = (reason: Parameters<typeof encodeRackReply>[3]) => encodeRackReply(3, 1, 10, reason).slice(5, 8);
    it("is read with no setting at all: an acknowledgement, and a refusal with its reason", () => {
      expect(RACK_ID_REPLY).toBe(0x261);
      expect(decodeTraceFrame(0x261, reply("applied"), 3, "Rx")).toMatchObject({ type: "reply", name: "rack_reply", result: "ok", tool: 10 });
      expect(decodeTraceFrame(0x261, reply("repeat"), 3, "Rx").result).toBe("ok");
      for (const reason of ["wrong_length", "tool_absent", "temp_out_of_range", "tool_invalid", "not_heatable", "held_rate", "unknown_command"] as const) {
        const out = decodeTraceFrame(0x261, reply(reason), 3, "Rx");
        expect(out.result).toBe("refused");
        expect(out.summary).toContain(`reason=${reason}`);
      }
    });
    it("is malformed when it does not have three bytes or carries a code that does not exist", () => {
      expect(decodeTraceFrame(0x261, [1, 10, 9], 3, "Rx").result).toBe("malformed");
      expect(decodeTraceFrame(0x261, [1, 10, 255], 3, "Rx").result).toBe("malformed");
      expect(decodeTraceFrame(0x261, [1, 10], 2, "Rx")).toMatchObject({ result: "malformed", anomalies: ["short_dlc"] });
      expect(decodeTraceFrame(0x261, [1, 10, 0, 0], 4, "Rx")).toMatchObject({ result: "malformed", anomalies: ["bad_length"] });
    });
    it("is not taken for anything else: the order 0x260 is a request with its own layout and the free identifier next to the reply stays unknown", () => {
      expect(decodeTraceFrame(0x260, [0, 0, 250, 4, 0, 0, 0, 0], 8, "Tx")).toMatchObject({ type: "request", name: "rack_set_preheat", result: "info" });
      expect(decodeTraceFrame(0x262, reply("applied"), 3, "Rx").type).toBe("unknown");
    });
  });

  describe("the reply of the rack on an identifier the bench names (advanced)", () => {
    const reply = (reason: Parameters<typeof encodeRackReply>[3]) => encodeRackReply(3, 1, 10, reason).slice(5, 8);
    const settings = { rackReplyIds: [0x300] };
    it("reads an acknowledgement and a refusal with its reason", () => {
      expect(decodeTraceFrame(0x300, reply("applied"), 3, "Rx", settings)).toMatchObject({ type: "reply", result: "ok", tool: 10 });
      const refused = decodeTraceFrame(0x300, reply("temp_out_of_range"), 3, "Rx", settings);
      expect(refused.result).toBe("refused");
      expect(refused.summary).toContain("reason=temp_out_of_range");
    });
    it("still reads the standard identifier when another one is named", () => {
      expect(decodeTraceFrame(0x261, reply("held_rate"), 3, "Rx", settings)).toMatchObject({ type: "reply", result: "refused" });
    });
    it("does not read it when no identifier is named, and refuses a code that does not exist", () => {
      expect(decodeTraceFrame(0x300, reply("held_rate"), 3, "Rx").type).toBe("unknown");
      expect(decodeTraceFrame(0x300, [1, 10, 99], 3, "Rx", settings).result).toBe("malformed");
      expect(decodeTraceFrame(0x300, [1, 10], 2, "Rx", settings)).toMatchObject({ result: "malformed", anomalies: ["short_dlc"] });
    });
  });
});

describe("reading a trace file", () => {
  const LOG = [
    { timestamp: "10:00:00.000", direction: "Tx" as const, idHex: "0x1A2", dlc: 1, dataHex: "06" },
    { timestamp: "10:00:00.010", direction: "Rx" as const, idHex: "0x1A3", dlc: 2, dataHex: "1F 06" },
    { timestamp: "10:00:00.500", direction: "Rx" as const, idHex: "0x7F5", dlc: 2, dataHex: "05 02" },
  ];

  it("reads what the studio writes as a PCAN trace, with both directions and the order of the file", () => {
    const load = parseCanTrace(toTrcTrace(LOG, new Date(2000, 0, 1)));
    expect(load.format).toBe("trc");
    expect(load.rows.map((r) => [r.direction, r.idHex, r.name, r.result])).toEqual([
      ["Tx", "0x1A2", "set_free_tool", "info"],
      ["Rx", "0x1A3", "free_tool_config_resp_response", "ok"],
      ["Rx", "0x7F5", "status", "refused"],
    ]);
    expect(load.rows.map((r) => r.timeMs)).toEqual([0, 10, 500]);
    expect(load.rows.map((r) => r.line)).toEqual([5, 6, 7]);
    expect(load.problemCount).toBe(0);
  });

  it("reads a Vector trace the same way", () => {
    const load = parseCanTrace(toAscTrace(LOG, new Date(2000, 0, 1, 15, 4, 5)));
    expect(load.format).toBe("asc");
    expect(load.rows.map((r) => r.id)).toEqual([0x1a2, 0x1a3, 0x7f5]);
    expect(load.rows[2].timeMs).toBeCloseTo(500, 3);
    expect(load.problemCount).toBe(0);
  });

  it("keeps a frame whose data is shorter than its length and marks it", () => {
    const load = parseCanTrace(file(trc(1, 0, "Rx", "0111", 4, "0A 00")));
    expect(load.rows).toHaveLength(1);
    expect(load.rows[0].anomalies).toContain("short_dlc");
    expect(load.rows[0].result).toBe("malformed");
  });

  it("lists the lines it cannot read with the reason and goes on", () => {
    const load = parseCanTrace(file(
      "garbage",
      trc(1, 0, "Rx", "0110", 2, "ZZ 01"),
      trc(2, 1, "Rx", "0110", 9, "00 01 02 03 04 05 06 07 08"),
      trc(3, 2, "Rx", "1FFFFFFF", 1, "AA"),
      trc(4, 3, "Rx", "0110", 1, "0A 0B"),
      trc(5, 4, "Rx", "0110", 1, "A"),
      trc(6, 5, "Rx", "0110", 0, ""),
    ));
    expect(load.problems.map((p) => p.reason)).toEqual(["not_a_frame", "not_a_frame", "dlc_out_of_range", "id_out_of_range", "data_longer_than_dlc", "bad_data"]);
    expect(load.problems.map((p) => p.line)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(load.rows.map((r) => r.id)).toEqual([0x110]);
  });

  it("is not tripped by a hostile file", () => {
    const hostile = [
      trc(1, 0, "Rx", "0110", 0, ""),
      "=HYPERLINK(\"http://example.invalid\")",
      "<script>alert(1)</script>",
      "x".repeat(MAX_LINE_CHARS + 1),
      "A".repeat(100000),
      "\u0000\u0001‮",
    ].join("\n");
    const load = parseCanTrace(hostile);
    expect(load.rows).toHaveLength(1);
    expect(load.problemCount).toBe(5);
    expect(load.problems.some((p) => p.reason === "line_too_long")).toBe(true);
    // nothing of the file's own text is carried into a row
    expect(JSON.stringify(load.rows)).not.toContain("script");
  });

  it("lists at most a fixed number of refused lines and counts the rest", () => {
    const load = parseCanTrace(Array.from({ length: MAX_LISTED_PROBLEMS + 20 }, () => "nope").join("\n"));
    expect(load.problems).toHaveLength(MAX_LISTED_PROBLEMS);
    expect(load.problemCount).toBe(MAX_LISTED_PROBLEMS + 20);
  });

  it("does not read a file over the size limit", () => {
    const load = parseCanTrace(" ".repeat(MAX_TRACE_BYTES + 1));
    expect(load.tooBig).toBe(true);
    expect(load.rows).toEqual([]);
  });

  it("keeps the first frames up to the limit and counts the others", () => {
    const lines = Array.from({ length: MAX_TRACE_ROWS + 5 }, (_, i) => `${i + 1}) ${i}.0 Rx 110 0`);
    const load = parseCanTrace(lines.join("\n"));
    expect(load.rows).toHaveLength(MAX_TRACE_ROWS);
    expect(load.omitted).toBe(5);
  });

  it("takes an empty file as an empty trace", () => {
    expect(parseCanTrace("")).toMatchObject({ format: "unknown", rows: [], problemCount: 0, tooBig: false });
  });
});

describe("what is marked as odd in a recording", () => {
  const rowsOf = (...lines: string[]) => parseCanTrace(file(...lines)).rows;

  it("marks an identical frame that comes at once after the same one, and not one that comes later", () => {
    const rows = rowsOf(trc(1, 0, "Rx", "0135", 2, "00 DC"), trc(2, 0.5, "Rx", "0135", 2, "00 DC"), trc(3, 100, "Rx", "0135", 2, "00 DC"), trc(4, 100.2, "Rx", "0135", 2, "00 DD"));
    expect(rows.map((r) => r.anomalies.includes("duplicate"))).toEqual([false, true, false, false]);
  });

  it("marks a frame older than the one before as reordered", () => {
    const rows = rowsOf(trc(1, 50, "Rx", "0110", 0, ""), trc(2, 20, "Rx", "0111", 4, "0A 00 00 00"), trc(3, 60, "Rx", "0110", 0, ""));
    expect(rows.map((r) => r.timeMs)).toEqual([0, -30, 10]);
    expect(rows.map((r) => r.anomalies.includes("reordered"))).toEqual([false, true, false]);
  });

  it("marks a silence longer than the limit that is set", () => {
    const text = file(trc(1, 0, "Rx", "0110", 0, ""), trc(2, 1500, "Rx", "0110", 0, ""), trc(3, 1600, "Rx", "0110", 0, ""));
    expect(parseCanTrace(text).rows.map((r) => r.anomalies.includes("gap"))).toEqual([false, true, false]);
    expect(parseCanTrace(text, { ...DEFAULT_TRACE_SETTINGS, gapMs: 5000 }).rows.some((r) => r.anomalies.includes("gap"))).toBe(false);
    expect(parseCanTrace(text, { ...DEFAULT_TRACE_SETTINGS, gapMs: 50 }).rows.filter((r) => r.anomalies.includes("gap"))).toHaveLength(2);
  });

  it("marks a length that the layout does not allow, and a frame shorter than the layout needs", () => {
    const rows = rowsOf(trc(1, 0, "Tx", "0100", 3, "01 02 03"), trc(2, 1, "Tx", "0100", 8, "00 00 00 00 00 00 00 00"), trc(3, 2, "Rx", "0111", 2, "0A 00"));
    expect(rows[0].anomalies).toContain("short_dlc");
    expect(rows[1].anomalies).toEqual([]);
    expect(rows[2].anomalies).toContain("short_dlc");
  });
});

describe("filters and order", () => {
  const rows = parseCanTrace(file(
    trc(1, 0, "Tx", "01A2", 1, "06"),
    trc(2, 10, "Rx", "01A3", 2, "1F 06"),
    trc(3, 20, "Rx", "01A3", 2, "1F 00"),
    trc(4, 30, "Rx", "07F5", 2, "05 02"),
    trc(5, 40, "Rx", "0445", 4, "01 00 00 2A"),
    trc(6, 3000, "Rx", "0110", 0, ""),
  )).rows;

  it("reads a list of identifiers as typed", () => {
    expect(parseIdList("0x1A2, 7f5  1a3;zz 9999")).toEqual({ ids: [0x1a2, 0x7f5, 0x1a3], unreadable: ["zz", "9999"] });
    expect(parseIdList("")).toEqual({ ids: [], unreadable: [] });
  });

  it("filters by identifier, and takes an empty box as all", () => {
    expect(filterRows(rows, { ids: "1a3" }).map((r) => r.index)).toEqual([2, 3]);
    expect(filterRows(rows, { ids: "  " })).toHaveLength(6);
    expect(filterRows(rows, { ids: "zz" })).toHaveLength(6);
  });

  it("filters by type, direction, result and node", () => {
    expect(filterRows(rows, { types: ["request"] }).map((r) => r.index)).toEqual([1, 6]);
    expect(filterRows(rows, { directions: ["Tx"] }).map((r) => r.index)).toEqual([1]);
    expect(filterRows(rows, { results: ["refused"] }).map((r) => r.index)).toEqual([3, 4]);
    expect(filterRows(rows, { node: 5 }).map((r) => r.index)).toEqual([5]);
    expect(filterRows(rows, { node: null })).toHaveLength(5);
  });

  it("filters by mark, by range of time and by text", () => {
    expect(filterRows(rows, { anomaly: "any" }).map((r) => r.index)).toEqual([6]);
    expect(filterRows(rows, { anomaly: "gap" }).map((r) => r.index)).toEqual([6]);
    expect(filterRows(rows, { anomaly: "duplicate" })).toEqual([]);
    expect(filterRows(rows, { fromMs: 10, toMs: 30 }).map((r) => r.index)).toEqual([2, 3, 4]);
    expect(filterRows(rows, { text: "STATUS" }).map((r) => r.index)).toEqual([4, 5]);
    expect(filterRows(rows, { text: "1F 06" }).map((r) => r.index)).toEqual([2]);
  });

  it("combines the filters", () => {
    expect(filterRows(rows, { ids: "1a3", results: ["refused"] }).map((r) => r.index)).toEqual([3]);
  });

  it("sorts without changing the rows, keeping the order of the file between equals", () => {
    expect(sortRows(rows, "id", true).map((r) => r.id)).toEqual([0x7f5, 0x445, 0x1a3, 0x1a3, 0x1a2, 0x110]);
    expect(sortRows(rows, "id").map((r) => r.id)).toEqual([0x110, 0x1a2, 0x1a3, 0x1a3, 0x445, 0x7f5]);
    expect(sortRows(rows, "id").map((r) => r.index).slice(2, 4)).toEqual([2, 3]);
    expect(sortRows(rows, "time", true)[0].index).toBe(6);
    expect(sortRows(rows, "result").map((r) => r.result)[0]).toBe("info");
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("summary and timeline", () => {
  const rows = parseCanTrace(file(
    trc(1, 0, "Rx", "07F5", 2, "05 02"), trc(2, 100, "Rx", "0111", 4, "0A 01 00 00"), trc(3, 200, "Rx", "0110", 0, ""), trc(4, 1500, "Rx", "0110", 0, ""),
  )).rows;

  it("counts what the recording holds", () => {
    expect(summarizeRows(rows)).toEqual({ frames: 4, refused: 1, faults: 1, malformed: 0, flagged: 1, durationMs: 1500 });
    expect(summarizeRows([])).toEqual({ frames: 0, refused: 0, faults: 0, malformed: 0, flagged: 0, durationMs: 0 });
  });

  it("cuts the time in equal parts and puts every frame in one", () => {
    const buckets = timelineBuckets(rows, 3);
    expect(buckets.map((b) => b.count)).toEqual([3, 0, 1]);
    expect(buckets.map((b) => b.refused)).toEqual([2, 0, 0]);
    expect(buckets.map((b) => b.flagged)).toEqual([0, 0, 1]);
    expect(buckets.reduce((n, b) => n + b.count, 0)).toBe(rows.length);
    expect(timelineBuckets([], 5)).toEqual([]);
    expect(timelineBuckets(rows.slice(0, 1), 4).reduce((n, b) => n + b.count, 0)).toBe(1);
  });
});

describe("export", () => {
  const rows = parseCanTrace(file(trc(1, 0, "Tx", "01A2", 1, "06"), trc(2, 12.5, "Rx", "07F5", 2, "05 02"))).rows;

  it("writes the same CSV every time, with a header and one line per row", () => {
    const csv = traceCsv(rows);
    expect(csv).toBe(traceCsv(rows));
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(TRACE_CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe("2,4,12.500,Rx,0x7F5,2,05 02,status,response,,,refused,,status=5 reason=2");
  });

  it("writes JSON with a fixed order of keys and nothing about the moment of the export", () => {
    const json = traceJson(rows, "bench.trc");
    expect(json).toBe(traceJson(rows, "bench.trc"));
    const parsed = JSON.parse(json);
    expect(parsed).toMatchObject({ format: "urtc-trace-view/1", source: "bench.trc", frames: 2 });
    expect(Object.keys(parsed.rows[0])).toEqual(["index", "line", "time_ms", "direction", "id", "dlc", "data", "name", "type", "node", "tool", "result", "anomalies", "summary"]);
    expect(parsed.rows[1]).toMatchObject({ id: "0x7F5", result: "refused", time_ms: 12.5 });
    expect(JSON.parse(traceJson(rows, "x".repeat(500))).source).toHaveLength(120);
  });

  it("exports only the selection it is given, and an empty selection gives only the header", () => {
    expect(traceCsv([]).trimEnd()).toBe(TRACE_CSV_COLUMNS.join(","));
    expect(JSON.parse(traceJson([])).rows).toEqual([]);
  });

  it("quotes a cell with a separator and keeps a spreadsheet from reading text as a formula", () => {
    expect(csvCell('a,b "c"')).toBe('"a,b ""c"""');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("-1500.000")).toBe("-1500.000");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });
});
