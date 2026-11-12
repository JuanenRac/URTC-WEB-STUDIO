import { describe, expect, it } from "vitest";
import { dataChunkData, endUpdateData, hmacChunkData, parseImgsig, recordChunkData, RECORD_CHUNK_COUNT, RECORD_SIZE, startUpdateData } from "./flashFrames";
import { packUInt32BE, unpackUInt32BE } from "./flasher";

// The data bytes of the frames of a firmware update over generated images and records (fixed seeds, the same run every time): cut in frames and put together again
// they give back what was cut, and a .imgsig file is read as written or refused with an error and never with anything else.

/** A small seeded generator (mulberry32): the same numbers for the same seed, on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEEDS = Array.from({ length: 30 }, (_, i) => i);
const randomBytes = (r: () => number, length: number) => Uint8Array.from({ length }, () => Math.floor(r() * 256));
const hex = (data: ArrayLike<number>) => Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");

describe("the data of the frames of an update", () => {
  it.each(SEEDS)("puts an image of any length (seed %i) together again from its frames of eight bytes", (seed) => {
    const r = rng(seed);
    const image = randomBytes(r, Math.floor(r() * 700));
    const frames: number[][] = [];
    for (let from = 0; from < image.length; from += 8) frames.push(dataChunkData(image, from));
    expect(frames.length).toBe(Math.ceil(image.length / 8));
    expect(frames.every((frame, i) => frame.length === (i < frames.length - 1 ? 8 : image.length - 8 * (frames.length - 1)))).toBe(true);
    expect(frames.flat()).toEqual(Array.from(image));
  });

  it.each(SEEDS)("never reads past the end that is given (seed %i)", (seed) => {
    const r = rng(seed);
    const image = randomBytes(r, 1 + Math.floor(r() * 200));
    const end = Math.floor(r() * (image.length + 20));
    const from = Math.floor(r() * (image.length + 20));
    const chunk = dataChunkData(image, from, end);
    expect(chunk.length).toBeLessThanOrEqual(8);
    expect(chunk.length).toBe(Math.max(0, Math.min(from + 8, end, image.length) - from));
    chunk.forEach((value, i) => expect(value).toBe(image[from + i]));
  });

  it.each(SEEDS)("cuts a 32-byte signature in four frames and joins them (seed %i)", (seed) => {
    const signature = randomBytes(rng(seed), 32);
    const joined = [0, 1, 2, 3].flatMap((i) => hmacChunkData(signature, i));
    expect(joined).toEqual(Array.from(signature));
    expect(hmacChunkData(signature, 4)).toEqual([]);
  });

  it.each(SEEDS)("cuts a 76-byte record in eleven frames with the index in front and joins them (seed %i)", (seed) => {
    const record = randomBytes(rng(seed), RECORD_SIZE);
    const frames = Array.from({ length: RECORD_CHUNK_COUNT }, (_, i) => recordChunkData(record, i));
    expect(frames.every((frame, i) => frame.length === 8 && frame[0] === i)).toBe(true);
    const joined = frames.flatMap((frame) => frame.slice(1)).slice(0, RECORD_SIZE);
    expect(joined).toEqual(Array.from(record));
    expect(frames[RECORD_CHUNK_COUNT - 1].slice(1 + (RECORD_SIZE % 7)).every((b) => b === 0)).toBe(true);   // the last frame is padded with zeros
  });

  it.each(SEEDS)("writes the start and the end of the update as big-endian fields that read back (seed %i)", (seed) => {
    const r = rng(seed);
    const size = Math.floor(r() * 0xffffffff);
    const hardware = Math.floor(r() * 0xffffffff);
    const start = startUpdateData(size, hardware);
    expect(start).toHaveLength(8);
    expect(unpackUInt32BE(start.slice(0, 4))).toBe(size);
    expect(unpackUInt32BE(start.slice(4))).toBe(hardware);
    const crc = Math.floor(r() * 0xffffffff);
    const end = endUpdateData(crc, 0x0102, 0x0304);
    expect(end).toEqual([...packUInt32BE(crc), 1, 2, 3, 4]);
  });
});

describe("a .imgsig file", () => {
  it.each(SEEDS)("is read as it was written, in either case and with spaces around it (seed %i)", (seed) => {
    const r = rng(seed);
    const record = randomBytes(r, RECORD_SIZE);
    const written = hex(record);
    expect(Array.from(parseImgsig(written))).toEqual(Array.from(record));
    expect(Array.from(parseImgsig(`  ${written.toUpperCase()}\r\n`))).toEqual(Array.from(record));
  });

  it.each(SEEDS)("is refused with an error when it is not exactly 152 hexadecimal digits (seed %i)", (seed) => {
    const r = rng(seed);
    const good = hex(randomBytes(r, RECORD_SIZE));
    const position = Math.floor(r() * good.length);
    const damaged = [
      good.slice(0, good.length - 1 - Math.floor(r() * 4)),
      good + "0".repeat(1 + Math.floor(r() * 4)),
      good.slice(0, position) + "g" + good.slice(position + 1),
      good.slice(0, 76) + " " + good.slice(76, 151),
      "",
    ];
    for (const text of damaged) expect(() => parseImgsig(text)).toThrow(Error);
  });
});
