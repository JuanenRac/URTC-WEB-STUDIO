// The signing key the bootloader accepts against the key the image was signed with, compared before a single data frame goes out.
// The bootloader publishes the first eight bytes of the fingerprint of its key on 0x7ED (eight bytes, right after its 0x7F9 answer; 0x7FA stays at the
// three bytes of the version); the manifest of the image declares `signing_key_id`, which may be that fingerprint or a longer one that starts with it.
// Either side missing is "unknown" (no data), never a mismatch and never an error: an older bootloader, or one without a key, sends no 0x7ED.

export type KeyCheck = 'match' | 'mismatch' | 'unknown';
/** What the transfer reports: a comparison, or that the bootloader gave nothing to compare (older, or without a key). */
export type PrecheckOutcome = KeyCheck | 'no_data';
export type KeyPrecheckPolicy = 'warn' | 'refuse';

function clean(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase().replace(/^0x/, '');
}

export function compareSigningKey(boardKeyId: string | undefined | null, imageKeyId: string | undefined | null): KeyCheck {
  const board = clean(boardKeyId);
  const image = clean(imageKeyId);
  if (!board || !image) return 'unknown';
  return image.startsWith(board) || board.startsWith(image) ? 'match' : 'mismatch';
}

/** The comparison, or `no_data` when a bootloader answered without a fingerprint while the image declares one: said once in the log, never a difference and never an error. */
export function precheckOutcome(boardKeyId: string | undefined | null, imageKeyId: string | undefined | null, boardIsBootloader: boolean): PrecheckOutcome {
  const check = compareSigningKey(boardKeyId, imageKeyId);
  return check === 'unknown' && boardIsBootloader && !clean(boardKeyId) && clean(imageKeyId) ? 'no_data' : check;
}

/** The key id a signature record names: its first eight bytes (key id, counter, signature). The record is what the bootloader checks, so it wins over the key an older manifest declares. */
export function recordKeyId(record: Uint8Array | null | undefined): string | undefined {
  if (!record || record.length < 8) return undefined;
  return Array.from(record.slice(0, 8), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The fingerprint the image declares: the key id of its record when there is one, else the one of the manifest. */
export function imageKeyId(record: Uint8Array | null | undefined, manifestKeyId: string | undefined): string | undefined {
  return recordKeyId(record) ?? (manifestKeyId || undefined);
}
