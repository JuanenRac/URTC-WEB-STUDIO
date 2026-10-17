/** A device serial number typed by hand: a whole number from 0 to 255, or null. Anything else is refused, never masked into a different number. */
export function parseSerialNumber(text: string): number | null {
  const clean = text.trim();
  if (!/^\d{1,3}$/.test(clean)) return null;
  const n = Number(clean);
  return n <= 255 ? n : null;
}
