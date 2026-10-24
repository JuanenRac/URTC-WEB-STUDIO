// What the Raw Bus Monitor shows: only some CAN IDs and/or only frames whose data changed (like the filter of the raw bus monitor of the
// desktop Tester). The counters of the monitor keep counting every frame; the filter only decides which frames become rows. No React here.

/** The IDs typed as hex separated by spaces or commas ("1A0 0x110, 7F8"). Unreadable words are ignored; nothing readable means no filter (null). */
export function parseIdFilter(text: string): Set<number> | null {
  const ids = new Set<number>();
  for (const word of text.replace(/,/g, ' ').split(/\s+/)) {
    if (!/^(0x)?[0-9a-f]{1,3}$/i.test(word)) continue;
    const value = parseInt(word.replace(/^0x/i, ''), 16);
    if (value >= 0 && value <= 0x7ff) ids.add(value);
  }
  return ids.size > 0 ? ids : null;
}

export class FrameFilter {
  ids: Set<number> | null = null;
  onlyChanges = false;
  private last = new Map<number, string>();

  setIds(text: string): void {
    this.ids = parseIdFilter(text);
  }

  /** Forgets the last data of every ID, so the first frame of each is shown again. */
  reset(): void {
    this.last.clear();
  }

  /** True when the frame becomes a row. With "only changes" a frame shows when its data differs from the last frame of the same ID that was looked at. */
  accept(id: number, dataHex: string): boolean {
    if (this.ids !== null && !this.ids.has(id)) return false;
    if (this.onlyChanges) {
      if (this.last.get(id) === dataHex) return false;
      this.last.set(id, dataHex);
    }
    return true;
  }
}
