// =============================================================================
// URTC Web Studio - src/lib/canConformance.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
import { describe, expect, it } from "vitest";
import vectors from "./canConformance.vectors.json";
import * as canIds from "./canIds";
import * as flasherIds from "./flasher";
import { compareVersions, minorField } from "./flasher";
import { parseSlcanLine } from "./slcan";
import { decodeQuickState } from "./quickState";
import { summarizeBoardFrames } from "./boardTelemetry";
import { VersionBus, queryMainVersion } from "./boardVersion";
import { CanFrame } from "../types";

// The Web Studio's reading of the CAN protocol, against vectors shared with the
// other URTC clients (the Flasher and the Tester). canConformance.vectors.json
// is a committed copy; this file only reads its own copy.

const hex = (text: string): number[] => (text.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
const id = (text: string): number => Number.parseInt(text, 16);
const named: Record<string, unknown> = { ...canIds, ...flasherIds };

describe("identifiers", () => {
  const entries = vectors.identifiers.filter((entry) => "web" in entry.names);
  it.each(entries.map((entry) => [entry.id, (entry.names as Record<string, string>).web] as const))("%s is %s", (value, name) => {
    expect(named[name]).toBe(id(value));
  });
});

describe("magic payloads", () => {
  const byName = (name: string) => vectors.magic_payloads.find((entry) => entry.name === name)!;
  it("bootloader entry", () => {
    expect(flasherIds.ENTER_BOOTLOADER_MAGIC).toEqual(hex(byName("enter_bootloader").data));
    expect(flasherIds.CAN_ID_ENTER_BOOTLOADER).toBe(id(byName("enter_bootloader").id));
  });
  it("downgrade authorisation", () => {
    expect(flasherIds.AUTHORIZE_DOWNGRADE_MAGIC).toEqual(hex(byName("authorize_downgrade").data));
    expect(flasherIds.CAN_ID_AUTHORIZE_DOWNGRADE).toBe(id(byName("authorize_downgrade").id));
  });
  it("saved-state erase", () => {
    expect(canIds.ERASE_FRAM_MAGIC).toEqual(hex(byName("erase_fram").data));
    expect(canIds.CAN_ID_ERASE_FRAM).toBe(id(byName("erase_fram").id));
  });
  it("wire feeder reset", () => {
    expect(canIds.SOLDER_FEEDER_RESET_MAGIC).toEqual(hex(byName("solder_feeder_reset").data));
    expect(canIds.CAN_ID_SOLDER_FEEDER_RESET).toBe(id(byName("solder_feeder_reset").id));
  });
});

describe("serial lines", () => {
  // Lines the shared vectors expect to be rejected by this reader. The reader
  // also ignores everything after the payload (an adapter timestamp), which the
  // vector marks as an allowed difference.
  it.each(vectors.slcan_decode.map((vector) => [vector.name, vector] as const))("%s", (_name, vector) => {
    const got = parseSlcanLine(vector.line);
    if ("note" in vector) {
      if (got) expect(got.id).toBe(id(vector.frame!.id));
      return;
    }
    if (vector.frame === null) {
      expect(got).toBeNull();
    } else {
      expect(got).not.toBeNull();
      expect(got!.id).toBe(id(vector.frame.id));
      expect(got!.data).toEqual(hex(vector.frame.data));
    }
  });
});

describe("0x111 quick state", () => {
  it.each(vectors.quick_state.map((vector) => [vector.name, vector] as const))("%s", (_name, vector) => {
    const bytes = hex(vector.data);
    if (vector.expect === null) {
      // The decoder itself is not given short answers: the caller drops them.
      const frame = { id: canIds.CAN_ID_ACTIVE_TOOL_RESP, data: bytes, direction: "Rx" as const, simulated: false };
      expect(summarizeBoardFrames([frame]).status).toBeUndefined();
      return;
    }
    const got = decodeQuickState(bytes);
    expect(got.toolId).toBe(vector.expect.tool_id);
    expect(got.systemError).toBe(vector.expect.system_error);
    expect(got.canBusError).toBe(vector.expect.can_error);
    expect(got.bootSequenceActive).toBe(vector.expect.booting);
    expect(got.thermalFault).toBe(vector.expect.thermal_fault);
    expect(got.resetCause).toBe(vector.expect.reset_cause);
    expect(got.watchdogReset).toBe(vector.expect.watchdog_reset);
  });
});

function frame(frameId: number, data: number[]): CanFrame {
  return { id: frameId, idHex: "0x" + frameId.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

describe("version query", () => {
  it.each(vectors.version_query.map((vector) => [vector.name, vector] as const))("%s", async (_name, vector) => {
    const answers = new Map<number, number[]>();
    for (const [frameId, data] of vector.frames) answers.set(id(frameId), hex(data));
    const bus: VersionBus = {
      async request(_id, _data, respId) {
        const data = answers.get(respId);
        return data ? frame(respId, data) : null;
      },
      async waitForFrame(waitId) {
        const data = answers.get(waitId);
        return data ? frame(waitId, data) : null;
      },
      flushFrames() {},
    };
    const info = await queryMainVersion(bus);
    const expected = vector.expect;
    if (expected === null) {
      expect(info).toBeNull();
      return;
    }
    expect(info).not.toBeNull();
    expect(info!.responder).toBe(expected.responder);
    expect(info!.hardwareId).toBe(id(expected.hardware_id));
    expect(info!.appMajor).toBe(expected.major);
    expect(info!.appMinor).toBe(expected.minor);
    expect(info!.appPatch ?? null).toBe(expected.patch);
    expect(info!.patchAware).toBe(expected.patch_aware);
    expect(info!.acceptsPatchInEndUpdate).toBe(expected.accepts_patch_in_end_update);
    if ("bootloader" in expected) {
      expect([info!.bootMajor, info!.bootMinor, info!.bootPatch]).toEqual(expected.bootloader);
    }
  });
});

describe("end-of-update minor field", () => {
  it.each(vectors.minor_field.map((vector) => [`${vector.minor}.${vector.patch}.${vector.bootloader_accepts_patch}`, vector] as const))("%s", (_name, vector) => {
    expect(minorField(vector.minor, vector.patch ?? undefined, vector.bootloader_accepts_patch)).toBe(vector.expect);
  });
});

describe("version order", () => {
  it.each(vectors.version_order.map((vector) => [JSON.stringify([vector.installed, vector.candidate]), vector] as const))("%s", (_name, vector) => {
    const make = (parts: (number | null)[]) => ({ major: parts[0]!, minor: parts[1]!, ...(parts[2] === null ? {} : { patch: parts[2]! }) });
    expect(compareVersions(make(vector.installed), make(vector.candidate))).toBe(vector.expect);
  });
});
