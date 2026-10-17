import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBatcher } from "./frameBatcher";

describe("updating the screen once per batch of frames", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("hands many frames over in one call, in arrival order", () => {
    const onBatch = vi.fn();
    const b = createBatcher<number>(onBatch, { delayMs: 100 });
    for (let i = 1; i <= 50; i++) b.push(i);
    expect(onBatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onBatch).toHaveBeenCalledTimes(1);
    expect(onBatch.mock.calls[0][0]).toHaveLength(50);
    expect(onBatch.mock.calls[0][0][0]).toBe(1);
    expect(onBatch.mock.calls[0][0][49]).toBe(50);
  });

  it("starts a new batch for what arrives afterwards", () => {
    const onBatch = vi.fn();
    const b = createBatcher<number>(onBatch, { delayMs: 100 });
    b.push(1);
    vi.advanceTimersByTime(100);
    b.push(2);
    vi.advanceTimersByTime(100);
    expect(onBatch.mock.calls.map(c => c[0])).toEqual([[1], [2]]);
  });

  it("keeps only the newest items when a burst is larger than the cap", () => {
    const onBatch = vi.fn();
    const b = createBatcher<number>(onBatch, { delayMs: 100, maxItems: 10 });
    for (let i = 1; i <= 25; i++) b.push(i);
    b.flushNow();
    expect(onBatch.mock.calls[0][0]).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
  });

  it("does nothing when empty, and dispose drops what is waiting", () => {
    const onBatch = vi.fn();
    const b = createBatcher<number>(onBatch);
    b.flushNow();
    b.push(1);
    b.dispose();
    vi.advanceTimersByTime(1000);
    expect(onBatch).not.toHaveBeenCalled();
  });
});
