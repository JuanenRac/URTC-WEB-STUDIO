// =============================================================================
// URTC Web Studio - SLCAN line parsing: src/lib/slcan.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
//
// Extracted from useSerialCanBus.ts's own processBuffer() so the parsing
// logic itself - the part that decides whether a line of bytes off the
// wire is a real, well-formed CAN frame - can be unit tested directly,
// without a real (or faked) Web Serial port. Behavior is unchanged: same
// regex, same DLC/truncation checks, same rejection of anything that
// isn't a standard 11-bit `t` data frame.
//
// Only the standard `t` (11-bit data) frame is implemented - this
// project's own SLCAN traffic is exclusively standard-ID data frames
// (URTC's bus never uses extended IDs or remote frames), so `T`
// (29-bit), `r`/`R` (remote request, standard/extended) are
// deliberately not parsed and return null, same as any other
// unrecognized line.
// =============================================================================

export interface ParsedSlcanFrame {
  id: number;
  idHex: string;
  dlc: number;
  data: number[];
  dataHex: string;
}

// Case-sensitive on the leading 't' deliberately - a case-insensitive
// match here was a real bug this test suite caught: it let a real
// 29-bit extended-frame line ('T...', capital T is SLCAN's own marker
// for that different frame type) be silently misread as a standard 't'
// frame with a garbage ID/payload instead of being rejected. Hex digits
// themselves stay case-insensitive (both are legal per the SLCAN spec
// and real adapters emit either).
const SLCAN_T_FRAME_RE = /^t([0-9a-fA-F]{3})([0-8])([0-9a-fA-F]*)$/;

// Returns null (never throws) for anything that isn't a well-formed
// standard `t` frame - a malformed prefix, a DLC digit outside 0-8, a
// truncated or non-hex payload, or a recognized-but-unimplemented frame
// type (T/r/R). Any optional adapter timestamp suffix a real SLCAN
// device may append after the payload is ignored, matching the
// pre-extraction behavior.
export function parseSlcanLine(line: string): ParsedSlcanFrame | null {
  const match = SLCAN_T_FRAME_RE.exec(line);
  if (!match) return null;

  const idHex = match[1];
  const dlc = Number(match[2]);
  const dataHexStr = match[3].substring(0, dlc * 2);
  if (dataHexStr.length !== dlc * 2) return null;

  const id = Number.parseInt(idHex, 16);
  const data: number[] = [];
  for (let j = 0; j < dlc * 2; j += 2) {
    data.push(Number.parseInt(dataHexStr.substring(j, j + 2), 16));
  }

  return {
    id,
    idHex: `0x${idHex.toUpperCase()}`,
    dlc,
    data,
    dataHex: data.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' '),
  };
}
