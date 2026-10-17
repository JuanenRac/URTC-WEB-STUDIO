// Collects items and hands them over together, at most once per `delayMs`.
// The bus can deliver dozens of frames per second; updating the screen once per
// frame would re-render the whole application each time and slow down the very
// timers that keep the actuators alive. Here the screen updates a few times per
// second, with everything that arrived in between, oldest first.

export interface Batcher<T> {
  push(item: T): void;
  /** Hands over what is waiting right now. */
  flushNow(): void;
  /** Drops what is waiting and stops the timer. */
  dispose(): void;
}

export function createBatcher<T>(
  onBatch: (items: T[]) => void,
  options: { delayMs?: number; maxItems?: number } = {}
): Batcher<T> {
  const delayMs = options.delayMs ?? 100;
  const maxItems = options.maxItems ?? 200;
  let items: T[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushNow = () => {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (items.length === 0) return;
    const batch = items;
    items = [];
    onBatch(batch);
  };

  return {
    push(item) {
      items.push(item);
      if (items.length > maxItems) items.splice(0, items.length - maxItems); // only the newest matter
      if (timer === null) timer = setTimeout(flushNow, delayMs);
    },
    flushNow,
    dispose() {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      items = [];
    },
  };
}
