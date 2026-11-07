import { describe, expect, it } from "vitest";
import { CanFrame } from "../types";
import { VersionBus } from "./boardVersion";
import { compareWithRotation, minutesLeft, parseRotationStatus, queryKeyRotation } from "./keyRotation";

function frame(id: number, data: number[]): CanFrame {
  return { id, idHex: "0x" + id.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

const CURRENT = [1, 2, 3, 4, 5, 6, 7, 8];
const PREVIOUS = [9, 10, 11, 12, 13, 14, 15, 16];
const CURRENT_HEX = "0102030405060708";
const PREVIOUS_HEX = "090a0b0c0d0e0f10";

// A bus that plays the virtual bootloader: the status for the question and the fingerprints as a queue.
function busWith(status: number[] | null, keys: number[][]): VersionBus {
  const queue = keys.map(k => frame(0x7ed, k));
  return {
    async request(_id, _data, respId) { return status ? frame(respId, status) : null; },
    async waitForFrame(id) { return id === 0x7ed ? queue.shift() ?? null : null; },
    flushFrames() {},
  };
}

describe("rotation status", () => {
  it("reads the count, the flags and the seconds left", () => {
    expect(parseRotationStatus([5, 2, 1, 0, 0, 0x0e, 0x10])).toEqual({ count: 2, rotating: true, currentRevoked: false, secondsLeft: 3600 });
    expect(parseRotationStatus([5, 1, 0, 255, 255, 255, 255])).toEqual({ count: 1, rotating: false, currentRevoked: false, secondsLeft: undefined });
    expect(parseRotationStatus([5, 0, 2, 255, 255, 255, 255])?.currentRevoked).toBe(true);
  });

  it("refuses what is not a status", () => {
    expect(parseRotationStatus([4, 1, 0, 0, 0, 0, 0])).toBeNull();
    expect(parseRotationStatus([5, 3, 0, 0, 0, 0, 0])).toBeNull();
    expect(parseRotationStatus([5, 1, 4, 0, 0, 0, 0])).toBeNull();
    expect(parseRotationStatus([5, 1])).toBeNull();
  });

  it("rounds the minutes up", () => {
    expect(minutesLeft(3600)).toBe(60);
    expect(minutesLeft(61)).toBe(2);
    expect(minutesLeft(1)).toBe(1);
    expect(minutesLeft(undefined)).toBe(0);
  });
});

describe("asking the bootloader which keys it trusts", () => {
  it("reads both fingerprints during a rotation, the current one first", async () => {
    const info = await queryKeyRotation(busWith([5, 2, 1, 0, 0, 0x07, 0x08], [CURRENT, PREVIOUS]));
    expect(info).toEqual({ count: 2, rotating: true, currentRevoked: false, secondsLeft: 1800, keys: [CURRENT_HEX, PREVIOUS_HEX] });
  });

  it("reads one fingerprint when no rotation is in progress", async () => {
    const info = await queryKeyRotation(busWith([5, 1, 0, 255, 255, 255, 255], [CURRENT]));
    expect(info?.keys).toEqual([CURRENT_HEX]);
    expect(info?.rotating).toBe(false);
  });

  it("gives no data for a silent bootloader, a malformed status or a count that does not match", async () => {
    expect(await queryKeyRotation(busWith(null, []))).toBeNull();
    expect(await queryKeyRotation(busWith([5, 3, 0, 0, 0, 0, 0], [CURRENT]))).toBeNull();
    expect(await queryKeyRotation(busWith([5, 2, 1, 0, 0, 0, 60], [CURRENT]))).toBeNull();
  });
});

describe("an image against the trusted keys", () => {
  const rotation = { count: 2, rotating: true, currentRevoked: false, secondsLeft: 600, keys: [CURRENT_HEX, PREVIOUS_HEX] };

  it("matches the current key and the previous one, and says which", () => {
    expect(compareWithRotation(rotation, CURRENT_HEX)).toEqual({ check: "match", fingerprint: CURRENT_HEX, usesPreviousKey: false });
    expect(compareWithRotation(rotation, PREVIOUS_HEX)).toEqual({ check: "match", fingerprint: PREVIOUS_HEX, usesPreviousKey: true });
  });

  it("is a mismatch for another key, and no verdict without data", () => {
    expect(compareWithRotation(rotation, "ffffffffffffffff")?.check).toBe("mismatch");
    expect(compareWithRotation(null, CURRENT_HEX)).toBeNull();
    expect(compareWithRotation({ ...rotation, keys: [], count: 0 }, CURRENT_HEX)).toBeNull();
    expect(compareWithRotation(rotation, undefined)).toBeNull();
  });
});
