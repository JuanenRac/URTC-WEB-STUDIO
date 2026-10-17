// Every actuator that is kept alive by a repeated command registers here how
// to switch itself off. The registry lets one call (closing the page, losing
// the connection, an emergency stop) turn all of them off, whichever panel
// they were started from.

type Off = () => unknown;

const entries = new Set<Off>();

/** Registers an "off" action; returns the function that removes it again. */
export function registerSafeOff(off: Off): () => void {
  entries.add(off);
  return () => { entries.delete(off); };
}

/** Number of actuators that are currently switched on. */
export function activeSafeOffCount(): number {
  return entries.size;
}

/** Runs every registered "off". A failing one never stops the others. Resolves when all have finished. */
export async function runAllSafeOff(): Promise<number> {
  const all = [...entries];
  await Promise.allSettled(all.map(async (off) => { await off(); }));
  return all.length;
}
