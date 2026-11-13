import { describe, expect, it } from "vitest";
import { retryUntil } from "./retryUntil";

describe("asking again when an answer does not come", () => {
  it("returns the first answer without asking again", async () => {
    let calls = 0;
    expect(await retryUntil(3, async () => { calls++; return "ok"; })).toBe("ok");
    expect(calls).toBe(1);
  });

  it("asks again after a missing answer and stops at the first one that comes", async () => {
    const seen: number[] = [];
    const answer = await retryUntil(3, async (n) => { seen.push(n); return n === 2 ? [1, 2, 3] : null; });
    expect(answer).toEqual([1, 2, 3]);
    expect(seen).toEqual([1, 2]);
  });

  it("gives up with null after the last attempt", async () => {
    let calls = 0;
    expect(await retryUntil(3, async () => { calls++; return undefined; })).toBeNull();
    expect(calls).toBe(3);
  });

  it("tries at least once whatever the number of attempts it is given", async () => {
    for (const attempts of [0, -4, Number.NaN, 0.4, Number.NEGATIVE_INFINITY]) {
      let calls = 0;
      expect(await retryUntil(attempts, async () => { calls++; return null; })).toBeNull();
      expect(calls).toBe(1);
    }
  });

  it("does not take an empty list or zero for no answer", async () => {
    expect(await retryUntil(2, async () => [])).toEqual([]);
    expect(await retryUntil(2, async () => 0)).toBe(0);
    expect(await retryUntil(2, async () => "")).toBe("");
  });

  it("lets a failure of the attempt through instead of hiding it", async () => {
    await expect(retryUntil(3, async () => { throw new Error("the transport went away"); })).rejects.toThrow("the transport went away");
  });
});
