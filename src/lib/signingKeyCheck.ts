// The signing key the bootloader accepts against the key the image was signed with, compared before a single data frame goes out.
// The bootloader publishes the first eight bytes of the fingerprint of its key on 0x7ED (eight bytes, right after its 0x7F9 answer; 0x7FA stays at the
// three bytes of the version); the manifest of the image declares `signing_key_id`, which may be that fingerprint or a longer one that starts with it.
// Either side missing is "unknown" (no data), never a mismatch and never an error: an older bootloader, or one without a key, sends no 0x7ED.

export type KeyCheck = 'match' | 'mismatch' | 'unknown';
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
