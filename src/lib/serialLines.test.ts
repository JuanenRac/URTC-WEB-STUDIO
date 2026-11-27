// =============================================================================
// URTC Web Studio - src/lib/serialLines.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
//
// What the serial adapter puts around its frames (the bell of a refused command, noise without a line end, a large read on a busy bus) and a
// saved fault record whose samples are not objects: nothing good is thrown away and every refusal is the error of the module.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { BlackBoxError, blackBoxFromJson } from './blackBox';
import { parseSlcanLine, splitSlcanBuffer } from './slcan';

describe('the lines of the serial adapter', () => {
  it('reads a frame that follows the bell of a refused command', () => {
    expect(parseSlcanLine('\u0007t1601AA')?.id).toBe(0x160);
    expect(parseSlcanLine('\u0007\u0007\nt1601AA')?.data).toEqual([0xaa]);
  });

  it('refuses an identifier that is not a standard one', () => {
    expect(parseSlcanLine('t8001AA')).toBeNull();
    expect(parseSlcanLine('tFFF0')).toBeNull();
    expect(parseSlcanLine('t7FF0')?.id).toBe(0x7ff);
  });

  it('keeps every frame of a read larger than the limit of an unfinished line', () => {
    const { lines, rest } = splitSlcanBuffer('t1601AA\r'.repeat(1000) + 't16', 4096);
    expect(lines).toHaveLength(1000);
    expect(lines.every((line) => parseSlcanLine(line) !== null)).toBe(true);
    expect(rest).toBe('t16');
  });

  it('drops noise that has no line end once it passes the limit', () => {
    expect(splitSlcanBuffer('U'.repeat(5000), 4096)).toEqual({ lines: [], rest: '', overflowed: true });
    expect(splitSlcanBuffer('t1601A', 4096)).toEqual({ lines: [], rest: 't1601A', overflowed: false });
    expect(splitSlcanBuffer('', 4096)).toEqual({ lines: [], rest: '', overflowed: false });
  });
});

describe('a saved fault record whose samples are not objects', () => {
  it.each(['[null]', '[5]', '["x"]', '[[1,2]]'])('is refused with the error of the module (%s)', (samples) => {
    expect(() => blackBoxFromJson(`{"format":"urtc-blackbox/1","samples":${samples}}`)).toThrow(BlackBoxError);
  });
});
