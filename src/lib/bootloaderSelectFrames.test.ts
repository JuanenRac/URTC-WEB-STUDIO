import { describe, expect, it } from "vitest";
import * as ids from "./generated/urtcCanIds";

const hex = (frame: { data: number[] }): string => frame.data.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join("");

// The generated builders and readers of the block 0x7EA to 0x7ED, held to the examples of the specification.
describe("the frames of the addressing of a bootloader, built and read with the generated functions", () => {
  it("builds the operations of 0x7EA with the fixed first byte filled in", () => {
    expect(hex(ids.encodeBootloaderSelectRequestProbe(0, 0))).toBe("010000000000");
    expect(hex(ids.encodeBootloaderSelectRequestSelect(0x01020304, 7))).toBe("020102030407");
    expect(hex(ids.encodeBootloaderSelectRequestRelease())).toBe("03");
    expect(hex(ids.encodeBootloaderSelectRequestUid(1))).toBe("0401");
    expect(ids.encodeBootloaderSelectRequestUid(1).id).toBe(ids.CAN_ID_BOOTLOADER_SELECT);
  });

  it("builds the answers of 0x7EB", () => {
    expect(hex(ids.encodeBootloaderSelectResponseResponseProbe())).toBe("01A5");
    expect(hex(ids.encodeBootloaderSelectResponseResponseSelect(0x01020304, 7))).toBe("020102030407");
    expect(hex(ids.encodeBootloaderSelectResponseResponseUid(0, 0x11111111))).toBe("040011111111");
    expect(ids.encodeBootloaderSelectResponseResponseUid(0, 1).id).toBe(ids.CAN_ID_BOOTLOADER_SELECT_RESPONSE);
  });

  it("builds a chunk of the signature record and the identifier of the key", () => {
    expect(hex(ids.encodeBootloaderSignatureChunk(10, [1, 2, 3, 4, 5, 6, 7]))).toBe("0A01020304050607");
    expect(ids.encodeBootloaderSignatureChunk(0, new Uint8Array(7)).id).toBe(ids.CAN_ID_BOOTLOADER_SIGNATURE_CHUNK);
    expect(hex(ids.encodeBootloaderKeyId([1, 2, 3, 4, 5, 6, 7, 8]))).toBe("0102030405060708");
    expect(ids.encodeBootloaderKeyId(new Uint8Array(8)).id).toBe(ids.CAN_ID_BOOTLOADER_KEY_ID);
  });

  it("reads them back, and answers null for a payload that is too short", () => {
    expect(ids.decodeBootloaderSelectRequestProbe([1, 0, 0, 0, 0, 0])).toMatchObject({ nbits: 0, prefix: 0 });
    expect(ids.decodeBootloaderSelectRequestSelect([2, 1, 2, 3, 4, 7])).toMatchObject({ serial: 0x01020304, seq: 7 });
    expect(ids.decodeBootloaderSelectRequestRelease([3])).not.toBeNull();
    expect(ids.decodeBootloaderSelectRequestUid([4, 2])).toMatchObject({ part: 2 });
    expect(ids.decodeBootloaderSelectResponseResponseProbe([1, 0xa5])).not.toBeNull();
    expect(ids.decodeBootloaderSelectResponseResponseSelect([2, 1, 2, 3, 4, 7])).toMatchObject({ seq: 7 });
    expect(ids.decodeBootloaderSelectResponseResponseUid([4, 0, 0x11, 0x11, 0x11, 0x11])).toMatchObject({ part: 0, word: 0x11111111 });
    expect(ids.decodeBootloaderSignatureChunk([10, 1, 2, 3, 4, 5, 6, 7])).toMatchObject({ index: 10 });
    expect(ids.decodeBootloaderKeyId([1, 2, 3, 4, 5, 6, 7, 8], true)).not.toBeNull();
    expect(ids.decodeBootloaderKeyId([1, 2, 3])).toBeNull();
    expect(ids.decodeBootloaderSelectRequestSelect([2, 1])).toBeNull();
  });
});
