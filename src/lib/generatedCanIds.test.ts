import { describe, expect, it } from "vitest";
import * as ids from "./generated/urtcCanIds";

type Builder = (...args: unknown[]) => { id: number; data: number[] };
type Parser = (data: ArrayLike<number>, strict?: boolean) => ids.Fields | null;

const module = ids as unknown as Record<string, unknown>;
const names = Object.keys(module).filter((n) => /^encode[A-Z]/.test(n));

function hexBytes(hex: string): number[] {
  return hex.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
}

// The lowest value a field accepts, or the first allowed one.
function sample(field: ids.LayoutField): number | number[] {
  if (field.type === "bytes") {
    if (field.fixed !== undefined) return hexBytes(field.fixed);
    return new Array(field.length ?? 3).fill(0).map((_, i) => i + 1);
  }
  if (field.allowed) return field.allowed[0];
  if (field.range) return field.range[0];
  return 0;
}

// The layout a builder encodes: read from the builder itself (encode('rack_set_preheat', ...)).
function layoutOf(fn: string): string {
  const found = /encode\(["']([a-z0-9_]+)["']/.exec(String(module[fn]));
  if (!found) throw new Error(`${fn} does not call encode`);
  return found[1];
}

describe("every generated builder has a parser that reads back what it wrote", () => {
  it("covers the whole table of layouts", () => {
    expect(names.length).toBeGreaterThan(100);
  });

  for (const name of names) {
    it(`${name}`, () => {
      const layoutName = layoutOf(name);
      const layout = ids.LAYOUTS[layoutName];
      expect(layout, `no layout called ${layoutName}`).toBeDefined();
      const derived = new Set(layout.fields.map((f) => f.length_field).filter(Boolean));
      const fields = layout.fields.filter((f) => !derived.has(f.name));
      const values: Record<string, unknown> = {};
      for (const f of fields) values[f.name] = sample(f);
      // Parameters: the node address of an addressed frame, then the fields that carry a value, then the fixed ones (optional).
      const addressed = layoutName.startsWith("mn_node_");
      const args = [
        ...(addressed ? [3] : []),
        ...fields.filter((f) => f.fixed === undefined).map((f) => values[f.name]),
        ...fields.filter((f) => f.fixed !== undefined).map((f) => values[f.name]),
      ];

      const frame = (module[name] as Builder)(...args);
      expect(frame.id).toBe(addressed ? layout.id + 3 : layout.id);
      expect(frame.data).toEqual(ids.encode(layoutName, values).data);
      expect(ids.dlcAllows(layout.dlc, frame.data.length)).toBe(true);

      const parser = module["decode" + name.slice("encode".length)] as Parser;
      const back = parser(frame.data, true);
      expect(back).not.toBeNull();
      for (const f of fields) expect(back![f.name]).toEqual(values[f.name]);

      // Too short to read: nothing, and in strict mode a payload that breaks the length rule is refused as well.
      if (frame.data.length > 0) expect(parser(frame.data.slice(0, frame.data.length - 1))).toSatisfy((r: unknown) => r === null || typeof r === "object");
      if (layout.dlc.exact !== undefined) {
        expect(parser([...frame.data, 0], true)).toBeNull();
        if (layout.dlc.exact > 0) expect(parser(frame.data.slice(1))).toBeNull();
      }
    });
  }
});

describe("the generic encoder", () => {
  it("refuses a field it does not know, a missing one and a value that does not fit", () => {
    expect(() => ids.encode("impact_event", { nope: 1 })).toThrow(/unknown field/);
    expect(() => ids.encode("impact_event", {})).toThrow(/missing field/);
    expect(() => ids.encode("impact_event", { event: 1.5 })).toThrow(/integer/);
    expect(() => ids.encode("impact_event", { event: 256 })).toThrow(/does not fit/);
    expect(() => ids.encode("impact_event", { event: "1" })).toThrow(TypeError);
  });

  it("refuses bytes that are not bytes, the wrong length and a wrong fixed value", () => {
    expect(() => ids.encodeSolderFeederReset([1, 2, 3, 4])).toThrow(/must be/);
    expect(() => ids.encodeSolderFeederReset([1, 2, 3])).toThrow();
    expect(() => ids.encode("solder_feeder_reset", { magic: "abc" })).toThrow(/byte array/);
    expect(() => ids.encode("solder_feeder_reset", { magic: [300, 0, 0, 0] })).toThrow(/not a byte/);
    expect(ids.encodeSolderFeederReset().data).toEqual(ids.MAGIC_SOLDER_FEEDER_RESET);
    expect(ids.encodeSolderFeederReset(new Uint8Array(ids.MAGIC_SOLDER_FEEDER_RESET)).data).toEqual(ids.MAGIC_SOLDER_FEEDER_RESET);
  });

  it("checks the range and the defined values of a field", () => {
    const ranged = Object.entries(ids.LAYOUTS).flatMap(([layout, spec]) => spec.fields.filter((f) => f.range).map((f) => [layout, spec, f] as const));
    expect(ranged.length).toBeGreaterThan(0);
    const [layout, spec, field] = ranged[0];
    const values: Record<string, unknown> = {};
    for (const f of spec.fields) values[f.name] = sample(f);
    values[field.name] = field.range![1] + 1;
    expect(() => ids.encode(layout, values)).toThrow();
    const listed = Object.entries(ids.LAYOUTS).flatMap(([name, s]) => s.fields.filter((f) => f.allowed).map((f) => [name, s, f] as const));
    if (listed.length > 0) {
      const [name, s, f] = listed[0];
      const v: Record<string, unknown> = {};
      for (const g of s.fields) v[g.name] = sample(g);
      let candidate = 0;
      while (f.allowed!.includes(candidate)) candidate++;
      v[f.name] = candidate;
      expect(() => ids.encode(name, v)).toThrow();
    }
  });

  it("writes a negative number in two's complement and reads it back", () => {
    const signed = Object.entries(ids.LAYOUTS).flatMap(([name, spec]) => spec.fields.filter((f) => f.type.startsWith("i")).map((f) => [name, spec, f] as const));
    for (const [name, spec, field] of signed) {
      const values: Record<string, unknown> = {};
      for (const f of spec.fields) values[f.name] = sample(f);
      values[field.name] = -1;
      let frame;
      try {
        frame = ids.encode(name, values);
      } catch {
        continue; // a range that excludes -1
      }
      expect(ids.decode(name, frame.data)![field.name]).toBe(-1);
    }
  });

  it("accepts every length rule it describes", () => {
    expect(ids.dlcAllows({ exact: 2 }, 2)).toBe(true);
    expect(ids.dlcAllows({ exact: 2 }, 3)).toBe(false);
    expect(ids.dlcAllows({ one_of: [1, 4] }, 4)).toBe(true);
    expect(ids.dlcAllows({ one_of: [1, 4] }, 2)).toBe(false);
    expect(ids.dlcAllows({ min: 2, max: 5 }, 5)).toBe(true);
    expect(ids.dlcAllows({ min: 2, max: 5 }, 6)).toBe(false);
    expect(ids.dlcAllows({ any: true }, 8)).toBe(true);
    expect(ids.dlcAllows({ any: true }, 9)).toBe(false);
  });
});

describe("the version helpers", () => {
  it("pack and unpack the minor field with and without a patch", () => {
    expect(ids.minorFieldPack(5)).toBe(5);
    expect(ids.minorFieldPack(5, ids.PATCH_UNKNOWN)).toBe(5);
    expect(ids.minorFieldPack(5, -1)).toBe(5);
    expect(ids.minorFieldPack(5, ids.PATCH_MAX + 1)).toBe(5);
    const packed = ids.minorFieldPack(5, 9);
    expect(ids.minorFieldMinor(packed)).toBe(5);
    expect(ids.minorFieldPatch(packed)).toBe(9);
    expect(ids.minorFieldPatch(5)).toBeNull();
  });

  it("compare versions and let the patch decide only when both carry one", () => {
    expect(ids.versionCompare([0, 4, 1], [0, 5, 0])).toBe(1);
    expect(ids.versionCompare([1, 0, null], [0, 9, null])).toBe(-1);
    expect(ids.versionCompare([0, 4, 1], [0, 4, 2])).toBe(1);
    expect(ids.versionCompare([0, 4, 3], [0, 4, 2])).toBe(-1);
    expect(ids.versionCompare([0, 4, 2], [0, 4, 2])).toBe(0);
    expect(ids.versionCompare([0, 4, null], [0, 4, 9])).toBe(0);
    expect(ids.versionCompare([0, 4, 9], [0, 4, null])).toBe(0);
  });
});

describe("the multinode identifiers", () => {
  it("add the node address to the base of an addressed range", () => {
    expect(ids.mnNodeId(ids.MN_ID_NODE_STATUS_BASE, 3)).toBe(ids.MN_ID_NODE_STATUS_BASE + 3);
    expect(ids.mnNodeId(ids.MN_ID_NODE_CMD_BASE, ids.MN_ADDRESS_MASK)).toBe(ids.MN_ID_NODE_CMD_BASE + ids.MN_ADDRESS_MASK);
  });

  it("refuse a base that is not a range and an address that does not fit", () => {
    expect(() => ids.mnNodeId(ids.MN_ID_DISCOVER, 0)).toThrow(/not the base/);
    expect(() => ids.mnNodeId(ids.MN_ID_NODE_INFO_BASE, 32)).toThrow(/outside/);
    expect(() => ids.mnNodeId(ids.MN_ID_NODE_INFO_BASE, 1.5)).toThrow(/outside/);
  });

  it("split an identifier back into its name and node", () => {
    expect(ids.mnSplitId(ids.MN_ID_DISCOVER)).toEqual([ids.MN_NAMES[ids.MN_ID_DISCOVER], null]);
    expect(ids.mnSplitId(ids.MN_ID_NODE_RESP_BASE + 7)).toEqual([ids.MN_NAMES[ids.MN_ID_NODE_RESP_BASE], 7]);
    expect(ids.mnSplitId(0x7ff)).toBeNull();
  });
});
