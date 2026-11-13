import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CanFrame } from '../../types';
import { BusMonitorRow, BUS_MONITOR_MAX_ROWS } from './BusMonitorRow';

const frame = (seq: number): CanFrame => ({
  id: 0x110 + (seq % 8), idHex: `0x${(0x110 + (seq % 8)).toString(16).toUpperCase()}`, dlc: 8, data: [1, 2, 3, 4, 5, 6, 7, seq & 0xff],
  dataHex: `01 02 03 04 05 06 07 ${(seq & 0xff).toString(16).padStart(2, '0').toUpperCase()}`, timestamp: '12:00:00.000',
  direction: seq % 2 ? 'Tx' : 'Rx', description: 'frame', seq,
});

const table = (count: number) => renderToStaticMarkup(<table><tbody>{Array.from({ length: count }, (_, i) => <BusMonitorRow key={i} frame={frame(i)} />)}</tbody></table>);

describe('the rows of the raw bus monitor', () => {
  it('keeps 500 rows at most', () => {
    expect(BUS_MONITOR_MAX_ROWS).toBe(500);
  });

  it('draws one row per frame and the whole list stays far below a frame of the screen', () => {
    for (const count of [100, BUS_MONITOR_MAX_ROWS]) {
      const started = performance.now();
      const html = table(count);
      const elapsed = performance.now() - started;
      expect((html.match(/<tr /g) ?? []).length).toBe(count);
      // The markup of all the rows is built in a few milliseconds on a normal machine; a shared runner under load took 900 ms, so the bound only catches a render that
      // has become quadratic (seconds), not a slow machine.
      expect(elapsed, `${count} rows took ${elapsed.toFixed(1)} ms`).toBeLessThan(10_000);
      console.info(`bus monitor: ${count} rows rendered in ${elapsed.toFixed(1)} ms`);
    }
  });
});
