import { describe, expect, it } from "vitest";
import { CanFrame } from "../types";
import { VersionBus } from "./boardVersion";
import controlConfig from "./controlConfig.json";
import { parseVersionRule, queryVersionRule, versionRuleQueryEnabled } from "./versionRule";

function frame(id: number, data: number[]): CanFrame {
  return { id, idHex: "0x" + id.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

function busWith(answer: number[] | null, sent: Array<{ id: number; data: number[] }> = []): VersionBus {
  return {
    async request(id, data, respId) {
      sent.push({ id, data });
      return answer ? frame(respId, answer) : null;
    },
    async waitForFrame() { return null; },
    flushFrames() {},
  };
}

describe("the stored version rule of a bootloader", () => {
  it("is not asked for unless the settings file says so", () => {
    expect(versionRuleQueryEnabled()).toBe(false);
    expect((controlConfig as Record<string, unknown>).version_rule_query).toBe(false);
    expect(versionRuleQueryEnabled({ version_rule_query: "true" })).toBe(false);
    expect(versionRuleQueryEnabled({})).toBe(false);
    expect(versionRuleQueryEnabled({ version_rule_query: true })).toBe(true);
  });

  it("asks with the query frame and reads the answer", async () => {
    const sent: Array<{ id: number; data: number[] }> = [];
    const rule = await queryVersionRule(busWith([0xc5, 0, 2, 1, 0, 0, 1, 2], sent));
    expect(sent).toEqual([{ id: 0x7ee, data: [0x60, 0, 0, 0, 0, 0, 0, 0] }]);
    expect(rule).toEqual({ status: 0, mode: "accept_patchless", stored: true, counter: 258 });
    expect(await queryVersionRule(busWith([0xc5, 0, 1, 0, 0, 0, 0, 0]))).toEqual({ status: 0, mode: "strict", stored: false, counter: 0 });
  });

  it("takes silence and anything else as no data", async () => {
    expect(await queryVersionRule(busWith(null))).toBeNull();
    expect(parseVersionRule([0, 0, 0xc0, 0xff, 0xee])).toBeNull(); // the 5-byte answer of the serial command
    expect(parseVersionRule([0xc4, 0, 1, 0, 0, 0, 0, 0])).toBeNull();
    expect(parseVersionRule([0xc5, 9, 1, 0, 0, 0, 0, 0])).toBeNull();
    expect(parseVersionRule([0xc5, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(parseVersionRule([0xc5, 0, 1, 2, 0, 0, 0, 0])).toBeNull();
    expect(parseVersionRule([0xc5, 0, 1, 0, 0, 0, 0])).toBeNull();
  });
});
