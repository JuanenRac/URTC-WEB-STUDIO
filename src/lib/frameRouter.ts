import { QueuedFrame, takeFreshFrame, pushQueuedFrame } from "./frameQueue";

// Routes the frames that come from the bus to the callers that wait for an
// answer. It has no React and no serial port in it, so the rules of a request
// (an answer is never an old frame, two callers on the same id are served in
// order) are tested directly.
//
// A request is: forget what was received for the answering id, register the
// waiter, send, wait. Registering before sending means a fast answer cannot be
// missed, and forgetting first means a frame that was on the bus before the
// request can never be taken for its answer.

export interface RoutedFrame { id: number }

export class FrameRouter<F extends RoutedFrame> {
  private queue: QueuedFrame<F>[] = [];
  private waiters = new Map<number, Array<(frame: F) => void>>();

  constructor(private now: () => number = () => Date.now()) {}

  /** Drops every frame kept for this id (or for all ids): they answer something that already happened. */
  flush(id?: number): void {
    if (id === undefined) { this.queue.length = 0; return; }
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].frame.id === id) this.queue.splice(i, 1);
    }
  }

  /** Hands a received frame to the oldest caller waiting for its id, or keeps it briefly for the next one. */
  deliver(frame: F): void {
    const list = this.waiters.get(frame.id);
    if (list && list.length > 0) {
      list.shift()!(frame);
      return;
    }
    pushQueuedFrame(this.queue, frame, this.now());
  }

  /** Waits for the next frame with this id. Resolves null on timeout. A fresh frame already kept is used first. */
  wait(id: number, timeoutMs: number = 3000, accept?: (frame: F) => boolean): Promise<F | null> {
    if (!accept) {
      const kept = takeFreshFrame(this.queue, id, this.now());
      if (kept) return Promise.resolve(kept);
    }
    return this.register(id, timeoutMs, accept).promise;
  }

  /**
   * Request / answer: forgets old frames of the answering id, registers the
   * waiter, runs `send` and resolves with the first frame that arrives after
   * that (and that `accept` allows). If `send` fails the waiter is removed and
   * the error is thrown.
   */
  async request(respId: number, send: () => Promise<void>, timeoutMs: number = 3000, accept?: (frame: F) => boolean): Promise<F | null> {
    this.flush(respId);
    const pending = this.register(respId, timeoutMs, accept);
    try {
      await send();
    } catch (e) {
      pending.cancel();
      throw e;
    }
    return pending.promise;
  }

  private register(id: number, timeoutMs: number, accept?: (frame: F) => boolean): { promise: Promise<F | null>; cancel: () => void } {
    let cancel: () => void = () => {};
    const promise = new Promise<F | null>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const remove = () => {
        const l = this.waiters.get(id);
        if (l) {
          const i = l.indexOf(waiter);
          if (i !== -1) l.splice(i, 1);
        }
      };
      const finish = (value: F | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        remove();
        resolve(value);
      };
      const waiter = (frame: F) => {
        if (accept && !accept(frame)) {
          // Not the answer wanted: keep waiting, in the same place of the line.
          const list = this.waiters.get(id) ?? [];
          list.unshift(waiter);
          this.waiters.set(id, list);
          return;
        }
        finish(frame);
      };
      let list = this.waiters.get(id);
      if (!list) { list = []; this.waiters.set(id, list); }
      list.push(waiter);
      timer = setTimeout(() => finish(null), timeoutMs);
      cancel = () => finish(null);
    });
    return { promise, cancel };
  }
}
