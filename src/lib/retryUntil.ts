// Asks again when an answer did not come: a frame of a long reading can be lost on a busy bus, and one lost chunk must not throw the whole image away.
// `attempt` returns the answer, or null/undefined for none; it is tried up to `attempts` times (at least once) and the first answer is returned.
export async function retryUntil<T>(attempts: number, attempt: (number: number) => Promise<T | null | undefined>): Promise<T | null> {
  const tries = Math.max(1, Math.floor(Number.isFinite(attempts) ? attempts : 1));
  for (let number = 1; number <= tries; number++) {
    const answer = await attempt(number);
    if (answer !== null && answer !== undefined) return answer;
  }
  return null;
}
