import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLACK_BOX_CHUNK_COUNT, BlackBoxError, FaultTrigger, blackBoxCsv, blackBoxJson, blackBoxRows, chunkRequest, joinFrames, parseBlackBox, triggerIndex,
} from "./blackBox";
import {
  RACK_COMMAND_MIN_INTERVAL_MS, RACK_PREHEAT_MAX_MS, SimulatedRack, encodeRackFrame, encodeSetPreheat, parseRackFrame, unitKey, validateSetPreheat, verifySlot,
} from "./rackSim";
import {
  ThermalError, assembleThermal, decodeThermalChunk, syntheticThermalFrame, thermalChunkCount, thermalColor, thermalRegionStats, thermalRgb, thermalScale,
} from "./thermalView";
import { URTC_TOOL_PROFILES } from "./generated/urtcTools";
import { TOOL_NAMES } from "./canIds";

const load = (name: string) => JSON.parse(readFileSync(join(__dirname, "generated", name), "utf8"));
const hex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], h => parseInt(h, 16));
const bytes = (s: string) => Array.from(hex(s));
const BB = load("blackbox_vectors.json");
const RACK = load("rack_vectors.json");
const THERMAL = load("thermal_vectors.json");

describe("the tool profiles", () => {
  it("are the 25 tools of the specification, in order, with their short names", () => {
    expect(URTC_TOOL_PROFILES.map(p => p.id)).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(TOOL_NAMES[22]).toBe("Thermal Inspection");
    expect(URTC_TOOL_PROFILES.every(p => p.minVal <= p.defaultSetpoint && p.defaultSetpoint <= p.maxVal)).toBe(true);
    expect(URTC_TOOL_PROFILES.find(p => p.id === 22)?.kind).toBe("telemetry");
  });
});

describe("the fault recorder", () => {
  for (const v of BB.valid) {
    it(`decodes ${v.name} like the shared vectors`, () => {
      const rec = parseBlackBox(hex(v.hex));
      expect(rec.sampleCount).toBe(v.sample_count);
      expect(rec.writeIndex).toBe(v.write_index);
      expect(triggerIndex(rec)).toBe(v.trigger_index);
      expect(blackBoxRows(rec)).toEqual(v.rows);
      expect(blackBoxCsv(rec)).toBe(v.csv);
    });
  }
  for (const v of BB.invalid) {
    it(`refuses ${v.name}`, () => {
      expect(() => parseBlackBox(hex(v.hex))).toThrow(new RegExp(v.error));
    });
  }
  it("exports JSON with the trigger and the capture time", () => {
    const rec = parseBlackBox(hex(BB.valid[1].hex));
    const doc = JSON.parse(blackBoxJson(rec, "capture time"));
    expect(doc.format).toBe("urtc-blackbox/1");
    expect(doc.trigger_index).toBe(60);
    expect(doc.captured_at).toBe("capture time");
    expect(doc.samples).toHaveLength(67);
  });
  it("asks for chunks 0 to 21 only and joins four frames of eight bytes", () => {
    expect(BLACK_BOX_CHUNK_COUNT).toBe(22);
    expect(chunkRequest(21)).toEqual([21]);
    expect(() => chunkRequest(22)).toThrow(BlackBoxError);
    expect(joinFrames([[1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]])).toHaveLength(32);
    expect(() => joinFrames([[1, 2, 3, 4, 5, 6, 7, 8]])).toThrow(BlackBoxError);
  });
  it("fires once for each rising edge of the error flag", () => {
    const t = new FaultTrigger();
    const seq = [[0, 0, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 1, 0, 0], [0]];
    expect(seq.map(p => t.feed(p))).toEqual([false, true, false, false, true, false]);
  });
});

describe("the rack simulator", () => {
  for (const v of RACK.frames) {
    it(`encodes and parses ${v.name}`, () => {
      expect(encodeRackFrame(v.seq, v.cmd, bytes(v.payload)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase()).toBe(v.frame);
      expect(parseRackFrame(bytes(v.frame))).toEqual({ status: "ok", frame: { seq: v.seq, cmd: v.cmd, payload: bytes(v.payload) } });
    });
  }
  for (const v of RACK.parse) it(`parse status: ${v.name}`, () => expect(parseRackFrame(bytes(v.hex)).status).toBe(v.status));
  for (const v of RACK.validate) {
    it(`validates ${v.name}`, () => {
      const r = validateSetPreheat(bytes(v.payload));
      expect(r.status).toBe(v.status);
      if (v.status === "ok") expect([r.tool, r.target]).toEqual([v.tool, v.target]);
    });
  }
  for (const sc of RACK.scenarios) {
    it(`scenario: ${sc.name}`, () => {
      const rack = new SimulatedRack();
      [0, 19, 6, 10].forEach((tool, slot) => rack.setSlot(slot, tool, slot + 1));
      for (const step of sc.steps) {
        const reply = rack.receive(bytes(step.frame), step.time_ms);
        expect(reply.action === "set_target" || reply.action === "safe_state" ? reply.action : "none").toBe(step.action);
        expect(reply.kind === "ack").toBe(Boolean(step.ack));
        if (step.action !== "none") expect([reply.toolId, reply.targetC]).toEqual([step.tool, step.temp]);
      }
    });
  }
  for (const v of RACK.verify) {
    it(`slot verdict: ${v.name}`, () => expect(verifySlot(v.occupied, v.commanded_c, v.measured_c, v.ambient_c, v.elapsed_ms)).toBe(v.verdict));
  }
  it("sends every target to the safe state when the link goes quiet", () => {
    const rack = new SimulatedRack();
    rack.setSlot(0, 0, 5);
    expect(rack.receive(encodeSetPreheat(1, 0, 250), 0).action).toBe("set_target");
    expect(rack.tick(100)).toBe(0);
    expect(rack.tick(10_000)).toBe(1);
    expect(rack.slots[0].targetC).toBe(0);
  });
  it("latches the longest pre-heat until a zero, and the limit can be switched off", () => {
    const rack = new SimulatedRack(1000);
    rack.setSlot(0, 0, 5);
    rack.receive(encodeSetPreheat(1, 0, 250), 0);
    [200, 400, 600, 800].forEach((t, i) => rack.receive(encodeSetPreheat(i + 2, 0, 250), t));
    rack.receive(encodeSetPreheat(6, 0, 250), 1000);
    expect(rack.slots[0].targetC).toBe(0);
    expect(rack.receive(encodeSetPreheat(7, 0, 250), 1100).detail).toContain("limit");
    expect(rack.receive(encodeSetPreheat(8, 0, 0), 1200).action).toBe("set_target");
    expect(RACK_PREHEAT_MAX_MS).toBe(RACK.limits.link_timeout_ms * 2400);
    const unlimited = new SimulatedRack(null);
    unlimited.setSlot(0, 0, 5);
    for (let seq = 1, t = 0; seq < 100; seq++, t += 200) unlimited.receive(encodeSetPreheat(seq, 0, 250), t);
    expect(unlimited.slots[0].targetC).toBe(250);
  });
  it("holds back a flood of commands for one tool, but never a safe state or a retransmission", () => {
    const rack = new SimulatedRack(null, 100);
    rack.setSlot(0, 0, 5);
    rack.setSlot(1, 19, 6);
    expect(rack.receive(encodeSetPreheat(1, 0, 200), 1000).action).toBe("set_target");
    const held = rack.receive(encodeSetPreheat(2, 0, 210), 1050);
    expect([held.kind, held.action, held.detail]).toEqual(["none", "none", "throttled"]);
    expect(rack.slots[0].targetC).toBe(200);
    expect(rack.receive(encodeSetPreheat(2, 0, 210), 1100).action).toBe("set_target");
    expect(rack.receive(encodeSetPreheat(2, 0, 210), 1110).detail).toBe("retransmission already applied");
    expect(rack.receive(encodeSetPreheat(3, 0, 5000), 1120).action).toBe("safe_state");
    expect(rack.receive(encodeSetPreheat(1, 19, 300), 1121).action).toBe("set_target");
    rack.commandMinIntervalMs = 0;
    expect(rack.receive(encodeSetPreheat(3, 0, 220), 1122).action).toBe("set_target");
    expect(new SimulatedRack().commandMinIntervalMs).toBe(RACK_COMMAND_MIN_INTERVAL_MS);
  });
  it("identifies a head by its type and serial number", () => {
    const rack = new SimulatedRack();
    rack.setSlot(0, 0, 7);
    rack.setSlot(1, 0, 9);
    expect([unitKey(rack.slots[0]), unitKey(rack.slots[1])]).toEqual(["0:7", "0:9"]);
    rack.setSlot(2, 0, 7);
    expect(rack.slots[0].occupied).toBe(false);
    expect(unitKey(rack.slots[2])).toBe("0:7");
    rack.setSlot(3, 5);
    expect(unitKey(rack.slots[3])).toBeNull();
    expect(() => rack.setSlot(9, 0)).toThrow();
    expect(() => rack.setSlot(0, 25)).toThrow();
  });
});

describe("the thermal view", () => {
  for (const c of THERMAL.false_color) {
    it(`paints ${c.name} like the shared vectors`, () => {
      const frame = c.frame.map((row: Array<number | null>) => row.map(v => (v === null ? NaN : v)));
      const rgb = thermalRgb(frame, c.range).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      expect(rgb).toBe(c.rgb);
    });
  }
  for (const c of THERMAL.chunks) it(`decodes chunk: ${c.name}`, () => expect(decodeThermalChunk(bytes(c.hex))).toEqual(c.values));
  it("scales and colours the edges", () => {
    expect(thermalColor(0, 0, 10)).toEqual([0, 0, 0]);
    expect(thermalColor(10, 0, 10)).toEqual([255, 255, 255]);
    expect(thermalColor(NaN, 0, 10)).toEqual([255, 0, 255]);
    expect(thermalScale([[30, 30]])).toEqual([29.5, 30.5]);
    expect(thermalScale([[NaN]])).toEqual([0, 1]);
    expect(() => thermalScale([[1]], [5, 5])).toThrow(ThermalError);
  });
  it("puts an image back together and refuses an incomplete one", () => {
    const n = thermalChunkCount("90640");
    expect(n).toBe(48);
    expect(thermalChunkCount("90641")).toBe(12);
    const frame = syntheticThermalFrame(32, 24);
    const chunks = new Map<number, number[]>();
    const flat = frame.flat();
    for (let i = 0; i < n; i++) {
      const out: number[] = [];
      for (const v of flat.slice(i * 16, (i + 1) * 16)) { const raw = Math.round(v * 100) & 0xFFFF; out.push(raw >> 8, raw & 0xFF); }
      chunks.set(i, out);
    }
    expect(assembleThermal(chunks)).toEqual(frame);
    chunks.delete(7);
    expect(() => assembleThermal(chunks)).toThrow(/chunk 7/);
    expect(() => decodeThermalChunk([1, 2, 3])).toThrow(ThermalError);
  });
  it("reads a region and skips invalid pixels", () => {
    const frame = [[20, 40, NaN], [60, 80, 100]];
    expect(thermalRegionStats(frame, 0, 0, 3, 2)).toEqual({ minimum: 20, maximum: 100, mean: 60, pixels: 5, invalid: 1 });
    expect(thermalRegionStats([[NaN]], 0, 0, 1, 1)).toBeNull();
    expect(() => thermalRegionStats(frame, 0, 0, 4, 1)).toThrow(ThermalError);
  });
});
