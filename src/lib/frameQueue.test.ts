import { describe, expect, it } from "vitest";
import { MAX_QUEUED_FRAMES, MAX_QUEUED_FRAME_AGE_MS, pushQueuedFrame, takeFreshFrame, QueuedFrame } from "./frameQueue";

type F = { id: number; n: number };

describe("frames kept for a request that is about to wait", () => {
  it("serves a fresh frame once, oldest first", () => {
    const q: QueuedFrame<F>[] = [];
    pushQueuedFrame(q, { id: 0x7F5, n: 1 }, 1000);
    pushQueuedFrame(q, { id: 0x7F5, n: 2 }, 1010);
    expect(takeFreshFrame(q, 0x7F5, 1020)?.n).toBe(1);
    expect(takeFreshFrame(q, 0x7F5, 1020)?.n).toBe(2);
    expect(takeFreshFrame(q, 0x7F5, 1020)).toBeNull();
  });
  it("never serves a stale frame as the answer to a new request", () => {
    const q: QueuedFrame<F>[] = [];
    pushQueuedFrame(q, { id: 0x135, n: 1 }, 0);
    expect(takeFreshFrame(q, 0x135, MAX_QUEUED_FRAME_AGE_MS + 1)).toBeNull();
    expect(q.length).toBe(0);
  });
  it("leaves frames of other ids alone and stays bounded", () => {
    const q: QueuedFrame<F>[] = [];
    pushQueuedFrame(q, { id: 1, n: 1 }, 0);
    expect(takeFreshFrame(q, 2, 1)).toBeNull();
    expect(q.length).toBe(1);
    for (let i = 0; i < MAX_QUEUED_FRAMES + 50; i++) pushQueuedFrame(q, { id: 3, n: i }, 2);
    expect(q.length).toBe(MAX_QUEUED_FRAMES);
  });
});
