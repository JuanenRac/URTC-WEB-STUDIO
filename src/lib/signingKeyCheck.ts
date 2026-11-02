// The signing key the bootloader accepts against the key the image was signed with, compared before a single data frame goes out.
// The bootloader publishes the first eight bytes of the fingerprint of its key (0x7FA, eleven bytes); the manifest of the image declares
// `signing_key_id`, which may be that fingerprint or a longer one that starts with it. Either side missing is "unknown", never a mismatch.

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
