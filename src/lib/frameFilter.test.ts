import { describe, expect, it } from "vitest";
import { FrameFilter, parseIdFilter } from "./frameFilter";

describe("the IDs of the filter", () => {
  it("reads hex words separated by spaces or commas, with or without 0x", () => {
    expect([...parseIdFilter("1A0 0x110, 7F8")!].sort((a, b) => a - b)).toEqual([0x110, 0x1a0, 0x7f8]);
    expect(parseIdFilter("  1a0,,  ")).toEqual(new Set([0x1a0]));
  });
  it("ignores what is not an ID and gives no filter when nothing is readable", () => {
    expect(parseIdFilter("")).toBeNull();
    expect(parseIdFilter("zz 1234 -1 0x")).toBeNull();
    expect(parseIdFilter("zz 100")).toEqual(new Set([0x100]));
  });
  it("refuses an ID above 0x7FF", () => {
    expect(parseIdFilter("800")).toBeNull();
    expect(parseIdFilter("7FF")).toEqual(new Set([0x7ff]));
  });
});

describe("the filter of the monitor", () => {
  it("shows every frame by default", () => {
    const filter = new FrameFilter();
    expect(filter.accept(0x100, "00")).toBe(true);
    expect(filter.accept(0x100, "00")).toBe(true);
  });
  it("shows only the chosen IDs", () => {
    const filter = new FrameFilter();
    filter.setIds("100 0x1A0");
    expect(filter.accept(0x100, "01")).toBe(true);
    expect(filter.accept(0x1a0, "01")).toBe(true);
    expect(filter.accept(0x110, "01")).toBe(false);
    filter.setIds("nothing readable");
    expect(filter.accept(0x110, "01")).toBe(true);
  });
  it("shows a frame with only changes when its data differs from the last of the same ID", () => {
    const filter = new FrameFilter();
    filter.onlyChanges = true;
    expect(filter.accept(0x100, "01 02")).toBe(true);
    expect(filter.accept(0x100, "01 02")).toBe(false);
    expect(filter.accept(0x101, "01 02")).toBe(true);
    expect(filter.accept(0x100, "01 03")).toBe(true);
    expect(filter.accept(0x100, "01 02")).toBe(true);
  });
  it("does not remember the data of a frame its ID filter refused", () => {
    const filter = new FrameFilter();
    filter.onlyChanges = true;
    filter.setIds("100");
    expect(filter.accept(0x200, "AA")).toBe(false);
    filter.setIds("");
    expect(filter.accept(0x200, "AA")).toBe(true);
  });
  it("shows the first frame of each ID again after a reset", () => {
    const filter = new FrameFilter();
    filter.onlyChanges = true;
    filter.accept(0x100, "01");
    expect(filter.accept(0x100, "01")).toBe(false);
    filter.reset();
    expect(filter.accept(0x100, "01")).toBe(true);
  });
});
