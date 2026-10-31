import { describe, expect, it } from "vitest";
import { LIST_KEYS, moveActive, rowWindow, scrollTopToShow } from "./traceWindow";

describe("the rows to draw", () => {
  it("draws nothing for an empty list and never an empty window for a list with rows", () => {
    expect(rowWindow(0, 0, 400, 24)).toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0 });
    const w = rowWindow(1, 0, 0, 24, 0);
    expect(w.end - w.start).toBe(1);
  });

  it("draws the rows in view with a margin, and the two pads add up to the rows left out", () => {
    const w = rowWindow(100_000, 24 * 5000, 384, 24, 8);
    expect(w.start).toBe(4992);
    expect(w.end).toBe(5000 + 16 + 8);
    expect(w.topPad).toBe(w.start * 24);
    expect(w.bottomPad).toBe((100_000 - w.end) * 24);
    expect(w.topPad + (w.end - w.start) * 24 + w.bottomPad).toBe(100_000 * 24);
  });

  it("stays inside the list at both ends", () => {
    expect(rowWindow(50, 0, 384, 24, 8)).toMatchObject({ start: 0, topPad: 0 });
    const last = rowWindow(50, 24 * 10_000, 384, 24, 8);   // a scroll position far past the end
    expect(last.end).toBe(50);
    expect(last.bottomPad).toBe(0);
    expect(last.start).toBeLessThan(50);
  });

  it("reads a position that is not a number as the top", () => {
    expect(rowWindow(100, Number.NaN, Number.NaN, 24)).toMatchObject({ start: 0 });
    expect(rowWindow(100, -50, 384, 24)).toMatchObject({ start: 0 });
  });

  it("draws a small number of rows however long the list is", () => {
    const w = rowWindow(200_000, 24 * 123_456, 384, 24);
    expect(w.end - w.start).toBeLessThan(60);
  });
});

describe("keeping a row in view", () => {
  it("does not move when the row is already in view", () => expect(scrollTopToShow(5, 0, 240, 24)).toBe(0));
  it("moves up to a row above the view", () => expect(scrollTopToShow(2, 240, 240, 24)).toBe(48));
  it("moves down to a row below the view, to its bottom edge", () => expect(scrollTopToShow(20, 0, 240, 24)).toBe(21 * 24 - 240));
});

describe("moving with the keyboard", () => {
  it("starts at the first row when nothing is chosen", () => {
    expect(moveActive(-1, "ArrowDown", 10, 5)).toBe(0);
    expect(moveActive(-1, "ArrowUp", 10, 5)).toBe(0);
    expect(moveActive(-1, "PageDown", 10, 5)).toBe(5);
  });
  it("steps, pages and jumps, and stays inside the list", () => {
    expect(moveActive(3, "ArrowDown", 10, 5)).toBe(4);
    expect(moveActive(3, "ArrowUp", 10, 5)).toBe(2);
    expect(moveActive(0, "ArrowUp", 10, 5)).toBe(0);
    expect(moveActive(9, "ArrowDown", 10, 5)).toBe(9);
    expect(moveActive(3, "PageDown", 10, 5)).toBe(8);
    expect(moveActive(8, "PageDown", 10, 5)).toBe(9);
    expect(moveActive(3, "PageUp", 10, 5)).toBe(0);
    expect(moveActive(3, "Home", 10, 5)).toBe(0);
    expect(moveActive(3, "End", 10, 5)).toBe(9);
  });
  it("has nowhere to go in an empty list, and a stale position is brought back", () => {
    for (const key of LIST_KEYS) expect(moveActive(4, key, 0, 5)).toBe(-1);
    expect(moveActive(50, "ArrowUp", 10, 5)).toBe(8);
  });
});
