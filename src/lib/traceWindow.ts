// The window of a long list: which rows are drawn for a given scroll position, and where the keyboard moves. Pure functions, no React and no DOM,
// so the trace viewer can hold 200,000 rows and draw only the few dozen in view.

export interface RowWindow {
  /** First row drawn (0-based). */
  start: number;
  /** One past the last row drawn. */
  end: number;
  /** Height of the space above the first row drawn, in pixels. */
  topPad: number;
  /** Height of the space below the last row drawn, in pixels. */
  bottomPad: number;
}

const whole = (value: number, fallback = 0) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback);

/**
 * The rows to draw. `overscan` extra rows are drawn above and below the view so a fast scroll does not show a blank. A value that is not a
 * number (a view that is not measured yet) is read as 0, and the window is never empty while there are rows.
 */
export function rowWindow(total: number, scrollTop: number, viewportHeight: number, rowHeight: number, overscan = 8): RowWindow {
  const count = whole(total);
  const height = Math.max(1, whole(rowHeight, 1));
  if (count === 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0 };
  const first = Math.min(count - 1, Math.floor(whole(scrollTop) / height));
  const visible = Math.max(1, Math.ceil(whole(viewportHeight) / height));
  const start = Math.max(0, first - whole(overscan));
  const end = Math.min(count, first + visible + whole(overscan));
  return { start, end, topPad: start * height, bottomPad: (count - end) * height };
}

/** The scroll position that brings row `index` into the view with the least movement (the current one when it is already in view). */
export function scrollTopToShow(index: number, scrollTop: number, viewportHeight: number, rowHeight: number): number {
  const height = Math.max(1, whole(rowHeight, 1));
  const top = whole(index) * height;
  const bottom = top + height;
  const view = Math.max(height, whole(viewportHeight));
  const current = whole(scrollTop);
  if (top < current) return top;
  if (bottom > current + view) return bottom - view;
  return current;
}

export type ListKey = 'ArrowDown' | 'ArrowUp' | 'PageDown' | 'PageUp' | 'Home' | 'End';
export const LIST_KEYS: readonly ListKey[] = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'];

/** The row the keyboard moves to from `current` (-1 when none is chosen yet), kept inside the list. -1 when the list is empty. */
export function moveActive(current: number, key: ListKey, total: number, pageRows: number): number {
  const count = whole(total);
  if (count === 0) return -1;
  const page = Math.max(1, whole(pageRows, 1));
  const from = current < 0 ? -1 : Math.min(current, count - 1);
  switch (key) {
    case 'ArrowDown': return Math.min(count - 1, from + 1);
    case 'ArrowUp': return Math.max(0, from < 0 ? 0 : from - 1);
    case 'PageDown': return Math.min(count - 1, Math.max(0, from) + page);
    case 'PageUp': return Math.max(0, Math.max(0, from) - page);
    case 'Home': return 0;
    default: return count - 1;
  }
}
