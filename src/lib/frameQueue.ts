// Frames that arrive while nobody is waiting for them are kept briefly so a
// request answered "just before" the wait begins is not lost. A frame older
// than MAX_QUEUED_FRAME_AGE_MS is an answer to something else (a telemetry
// tick, a reply to an attempt that already timed out): it must never be taken
// for the answer to a new request.

export const MAX_QUEUED_FRAME_AGE_MS = 1000;
export const MAX_QUEUED_FRAMES = 500;

export interface QueuedFrame<T extends { id: number }> {
  frame: T;
  at: number;
}

/** Removes the stale entries, then takes the oldest fresh frame with this id (or returns null). Mutates the queue. */
export function takeFreshFrame<T extends { id: number }>(queue: QueuedFrame<T>[], id: number, now: number, maxAgeMs: number = MAX_QUEUED_FRAME_AGE_MS): T | null {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (now - queue[i].at > maxAgeMs) queue.splice(i, 1);
  }
  const idx = queue.findIndex(q => q.frame.id === id);
  if (idx === -1) return null;
  return queue.splice(idx, 1)[0].frame;
}

export function pushQueuedFrame<T extends { id: number }>(queue: QueuedFrame<T>[], frame: T, now: number): void {
  queue.push({ frame, at: now });
  while (queue.length > MAX_QUEUED_FRAMES) queue.shift();
}
