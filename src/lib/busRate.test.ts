import { describe, expect, it } from 'vitest';
import { BITRATE, BITRATE_LEGACY, SLCAN_BITRATES, SLCAN_BITRATE_DEFAULT_CODE } from './generated/urtcCanIds';
import { BITRATE_TRY_ORDER } from './busRate';

describe('the speed of the bus of the tool heads', () => {
  it('is 1 Mbit/s by default and 500 kbit/s for early boards, from the specification', () => {
    expect(BITRATE).toBe(1_000_000);
    expect(BITRATE_LEGACY).toBe(500_000);
    expect(SLCAN_BITRATE_DEFAULT_CODE).toBe('8');
  });

  it('is tried first when the speed of a bus is searched, and the legacy speed second', () => {
    expect(BITRATE_TRY_ORDER[0]).toEqual({ label: '1 Mbit/s', code: SLCAN_BITRATE_DEFAULT_CODE });
    expect(BITRATE_TRY_ORDER[1]).toEqual({ label: '500 kbit/s', code: '6' });
  });

  it('lists every code of the adapter table once, with the code the table gives it', () => {
    const table = new Map(SLCAN_BITRATES.map(([label, code]) => [label, code]));
    expect(BITRATE_TRY_ORDER.length).toBe(table.size);
    expect(new Set(BITRATE_TRY_ORDER.map((entry) => entry.code)).size).toBe(table.size);
    for (const { label, code } of BITRATE_TRY_ORDER) expect(table.get(label)).toBe(code);
  });
});
