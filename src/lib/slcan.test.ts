// =============================================================================
// URTC Web Studio - src/lib/slcan.test.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
//
// Real gap this closes: this project's own README "Honesty check" states
// there is no automated test suite - useSerialCanBus.ts's SLCAN parsing
// (the code that turns raw bytes off a real USB-CAN adapter into frames
// every tool panel trusts) had never been exercised outside manual
// hardware testing. parseSlcanLine() was extracted from
// useSerialCanBus.ts's own processBuffer() unchanged so this suite can
// drive it directly.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { parseSlcanLine } from './slcan';

describe('parseSlcanLine', () => {
  it('parses a well-formed standard data frame with a full 8-byte payload', () => {
    const result = parseSlcanLine('t1F881122334455667788');
    expect(result).toEqual({
      id: 0x1f8,
      idHex: '0x1F8',
      dlc: 8,
      data: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88],
      dataHex: '11 22 33 44 55 66 77 88',
    });
  });

  it('parses a zero-length (DLC 0) frame', () => {
    const result = parseSlcanLine('t0000');
    expect(result).toEqual({ id: 0, idHex: '0x000', dlc: 0, data: [], dataHex: '' });
  });

  it('accepts lowercase hex in both the ID and the payload', () => {
    const result = parseSlcanLine('t2ab2beef');
    expect(result?.idHex).toBe('0x2AB');
    expect(result?.data).toEqual([0xbe, 0xef]);
  });

  it.each(['1F881122334455667788', 'x1F881122334455667788', ''])(
    'rejects a line without a real "t" prefix (%s)',
    (line) => {
      expect(parseSlcanLine(line)).toBeNull();
    },
  );

  it.each(['9', 'A', 'F'])('rejects a DLC digit outside 0-8 (%s)', (dlcDigit) => {
    expect(parseSlcanLine(`t123${dlcDigit}`)).toBeNull();
  });

  it('rejects a payload shorter than its declared DLC (truncated frame)', () => {
    expect(parseSlcanLine('t1238112233')).toBeNull(); // DLC=8, only 3 bytes present
  });

  it('rejects a non-hex ID', () => {
    expect(parseSlcanLine('tZZZ0')).toBeNull();
  });

  it('rejects a non-hex payload byte', () => {
    expect(parseSlcanLine('t1231ZZ')).toBeNull();
  });

  // This project's own SLCAN traffic is exclusively standard-ID data
  // frames (see this file's own header comment) - T/r/R are deliberately
  // unimplemented, not silently mis-parsed as something else.
  it.each(['T00000001122334455667788', 'r1230', 'R000000018'])(
    'does not parse extended/remote frame types (%s) - returns null, never throws',
    (line) => {
      expect(parseSlcanLine(line)).toBeNull();
    },
  );

  it('ignores an adapter timestamp suffix appended after a full 8-byte payload', () => {
    // A real adapter in timestamp mode appends extra hex digits after the
    // last data byte - the regex's own payload capture is `dlc*2` bytes,
    // so anything beyond that is simply not part of the match at all
    // (substring() truncates), matching pre-extraction behavior.
    const result = parseSlcanLine('t1F881122334455667788ABCD');
    expect(result?.data).toEqual([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
  });
});
