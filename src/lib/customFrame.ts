export type CustomFrameResult =
  | { ok: true; id: number; data: number[] }
  | { ok: false; error: 'bad_id' | 'bad_byte' | 'too_many_bytes' };

/** Parses a hand-typed identifier and data bytes (hex). Anything that is not valid is rejected, never masked, dropped or shifted into a different frame. */
export function parseCustomFrame(idText: string, dataText: string): CustomFrameResult {
  const idClean = idText.trim().replace(/^0x/i, '');
  if (!/^[0-9a-f]{1,3}$/i.test(idClean)) return { ok: false, error: 'bad_id' };
  const id = parseInt(idClean, 16);
  if (id > 0x7FF) return { ok: false, error: 'bad_id' };
  const tokens = dataText.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 8) return { ok: false, error: 'too_many_bytes' };
  const data: number[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^0x/i, '');
    if (!/^[0-9a-f]{1,2}$/i.test(clean)) return { ok: false, error: 'bad_byte' };
    data.push(parseInt(clean, 16));
  }
  return { ok: true, id, data };
}

type Translate = (key: string, fallback: string) => string;

export function customFrameErrorText(t: Translate, error: 'bad_id' | 'bad_byte' | 'too_many_bytes'): string {
  switch (error) {
    case 'bad_id': return t('testerglobal.custom_frame_bad_id', 'The identifier must be 1 to 3 hexadecimal digits, from 0 to 7FF.');
    case 'bad_byte': return t('testerglobal.custom_frame_bad_byte', 'Every data byte must be 1 or 2 hexadecimal digits.');
    default: return t('testerglobal.custom_frame_too_many', 'A CAN frame carries at most 8 data bytes.');
  }
}
