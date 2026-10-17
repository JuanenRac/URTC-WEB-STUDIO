import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameRouter } from "./frameRouter";

type F = { id: number; n: number };

describe("request and answer on the bus", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { vi.useRealTimers(); });

  it("never takes a frame received before the request for its answer", async () => {
    const r = new FrameRouter<F>();
    r.deliver({ id: 0x135, n: 1 }); // telemetry that was already on the bus
    const answer = r.request(0x135, async () => {}, 200);
    vi.advanceTimersByTime(250);
    expect(await answer).toBeNull();
  });

  it("returns the frame that arrives after the request is sent", async () => {
    const r = new FrameRouter<F>();
    r.deliver({ id: 0x7F5, n: 1 });
    const answer = r.request(0x7F5, async () => { r.deliver({ id: 0x7F5, n: 2 }); }, 1000);
    expect((await answer)?.n).toBe(2);
  });

  it("registers the waiter before sending, so an immediate answer is not lost", async () => {
    const r = new FrameRouter<F>();
    let sent = false;
    const answer = r.request(0x111, async () => { sent = true; r.deliver({ id: 0x111, n: 7 }); });
    expect((await answer)?.n).toBe(7);
    expect(sent).toBe(true);
  });

  it("removes the waiter and rethrows when the send fails", async () => {
    const r = new FrameRouter<F>();
    await expect(r.request(0x111, async () => { throw new Error("not connected"); }, 1000)).rejects.toThrow("not connected");
    // a later frame is kept for the next caller instead of going to the dead waiter
    r.deliver({ id: 0x111, n: 9 });
    expect((await r.wait(0x111, 100))?.n).toBe(9);
  });

  it("serves two callers on the same id in order", async () => {
    const r = new FrameRouter<F>();
    const first = r.wait(0x191, 1000);
    const second = r.wait(0x191, 1000);
    r.deliver({ id: 0x191, n: 1 });
    r.deliver({ id: 0x191, n: 2 });
    expect((await first)?.n).toBe(1);
    expect((await second)?.n).toBe(2);
  });

  it("can ignore frames that are not the answer wanted", async () => {
    const r = new FrameRouter<F>();
    const answer = r.request(0x7F5, async () => {
      r.deliver({ id: 0x7F5, n: 2 }); // listening
      r.deliver({ id: 0x7F5, n: 3 }); // receiving: the one wanted
    }, 1000, (f) => f.n === 3);
    expect((await answer)?.n).toBe(3);
  });

  it("flush forgets only the frames of that id", async () => {
    const r = new FrameRouter<F>();
    r.deliver({ id: 1, n: 1 });
    r.deliver({ id: 2, n: 2 });
    r.flush(1);
    const a = r.wait(1, 10);
    const b = r.wait(2, 10);
    vi.advanceTimersByTime(20);
    expect(await a).toBeNull();
    expect((await b)?.n).toBe(2);
  });

  it("times out with null", async () => {
    const r = new FrameRouter<F>();
    const w = r.wait(5, 100);
    vi.advanceTimersByTime(101);
    expect(await w).toBeNull();
  });
});
