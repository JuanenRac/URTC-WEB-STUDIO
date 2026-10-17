import { describe, expect, it, vi } from "vitest";
import { ConfirmController } from "./confirmController";

const opts = { title: "t", message: "m", confirmLabel: "Yes", cancelLabel: "No", risk: "danger" as const };

describe("the confirmation shown before a dangerous action", () => {
  it("resolves true only when the person goes on", async () => {
    const c = new ConfirmController();
    const p = c.ask(opts);
    expect(c.getSnapshot()?.title).toBe("t");
    c.answer(true);
    expect(await p).toBe(true);
    expect(c.getSnapshot()).toBeNull();
  });

  it("resolves false when it is cancelled", async () => {
    const c = new ConfirmController();
    const p = c.ask(opts);
    c.answer(false);
    expect(await p).toBe(false);
  });

  it("refuses the earlier one when another is asked while it is open", async () => {
    const c = new ConfirmController();
    const first = c.ask(opts);
    const second = c.ask({ ...opts, title: "second" });
    expect(await first).toBe(false);
    expect(c.getSnapshot()?.title).toBe("second");
    c.answer(true);
    expect(await second).toBe(true);
  });

  it("tells the screen when a confirmation opens and closes", () => {
    const c = new ConfirmController();
    const listener = vi.fn();
    c.subscribe(listener);
    void c.ask(opts);
    c.answer(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("answering with nothing open does nothing", () => {
    const c = new ConfirmController();
    expect(() => c.answer(true)).not.toThrow();
  });
});
