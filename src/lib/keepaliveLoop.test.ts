import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startKeepaliveLoop } from "./keepaliveLoop";
import { activeSafeOffCount, runAllSafeOff } from "./safeOff";

describe("the repeated command of an actuator", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("sends at once and then at every interval", async () => {
    const send = vi.fn();
    const stop = startKeepaliveLoop(150, () => ({ send }));
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(450);
    expect(send).toHaveBeenCalledTimes(4);
    stop();
  });

  it("sends the off command when the panel goes away, and stops repeating", async () => {
    const send = vi.fn();
    const off = vi.fn();
    const stop = startKeepaliveLoop(150, () => ({ send, off }));
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(off).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends the off command once even if it is asked for twice", async () => {
    const off = vi.fn();
    const stop = startKeepaliveLoop(150, () => ({ send: () => {}, off }));
    await runAllSafeOff(); // the page is closing
    stop(); // and the panel unmounts right after
    expect(off).toHaveBeenCalledTimes(1);
    expect(activeSafeOffCount()).toBe(0);
  });

  it("a global switch-off reaches a loop that was started from any panel", async () => {
    const offA = vi.fn();
    const offB = vi.fn();
    const stopA = startKeepaliveLoop(150, () => ({ send: () => {}, off: offA }));
    const stopB = startKeepaliveLoop(150, () => ({ send: () => {}, off: offB }));
    await runAllSafeOff();
    expect(offA).toHaveBeenCalledTimes(1);
    expect(offB).toHaveBeenCalledTimes(1);
    stopA(); stopB();
  });

  it("calls onFailure when a send throws, and does not throw out of the timer", async () => {
    const onFailure = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stop = startKeepaliveLoop(150, () => ({ send: () => { throw new Error("not connected"); }, onFailure }));
    await vi.advanceTimersByTimeAsync(10);
    expect(onFailure).toHaveBeenCalled();
    stop();
  });

  it("an off that fails does not break stopping", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stop = startKeepaliveLoop(150, () => ({ send: () => {}, off: () => { throw new Error("gone"); } }));
    expect(() => stop()).not.toThrow();
  });
});
