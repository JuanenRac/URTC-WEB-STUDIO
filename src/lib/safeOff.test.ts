import { describe, expect, it, vi } from "vitest";
import { activeSafeOffCount, registerSafeOff, runAllSafeOff } from "./safeOff";

describe("switching everything off", () => {
  it("runs every registered off, and a failing one does not stop the rest", async () => {
    const a = vi.fn();
    const b = vi.fn(() => { throw new Error("port gone"); });
    const c = vi.fn(async () => {});
    const undo = [registerSafeOff(a), registerSafeOff(b), registerSafeOff(c)];
    expect(activeSafeOffCount()).toBe(3);
    expect(await runAllSafeOff()).toBe(3);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(c).toHaveBeenCalledTimes(1);
    undo.forEach(u => u());
    expect(activeSafeOffCount()).toBe(0);
  });

  it("does not run an off that was removed", async () => {
    const a = vi.fn();
    registerSafeOff(a)();
    await runAllSafeOff();
    expect(a).not.toHaveBeenCalled();
  });
});
