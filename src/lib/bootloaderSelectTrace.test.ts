import { describe, expect, it } from "vitest";
import { decodeTraceFrame } from "./canTrace";

// The operations of 0x7EA (probe, select, release, UID) and the answers of 0x7EB share an identifier and some of them a length: the fixed first byte tells them apart.
describe("reading the frames of the addressing of a bootloader", () => {
  it("tells the operations of 0x7EA apart by the byte they start with", () => {
    expect(decodeTraceFrame(0x7ea, [1, 0, 0, 0, 0, 0], 6, "Tx").name).toBe("bootloader_select_request_probe");
    expect(decodeTraceFrame(0x7ea, [2, 1, 2, 3, 4, 7], 6, "Tx").name).toBe("bootloader_select_request_select");
    expect(decodeTraceFrame(0x7ea, [3], 1, "Tx").name).toBe("bootloader_select_request_release");
    expect(decodeTraceFrame(0x7ea, [4, 1], 2, "Tx").name).toBe("bootloader_select_request_uid");
  });

  it("tells the answers of 0x7EB apart", () => {
    expect(decodeTraceFrame(0x7eb, [1, 0xa5], 2, "Rx").name).toBe("bootloader_select_response_response_probe");
    expect(decodeTraceFrame(0x7eb, [2, 1, 2, 3, 4, 7], 6, "Rx").name).toBe("bootloader_select_response_response_select");
    expect(decodeTraceFrame(0x7eb, [4, 0, 0x11, 0x11, 0x11, 0x11], 6, "Rx").name).toBe("bootloader_select_response_response_uid");
  });

  it("reads the signature chunk and the key identifier at eight bytes, and marks a key identifier of another length", () => {
    expect(decodeTraceFrame(0x7ec, [0, 1, 2, 3, 4, 5, 6, 7], 8, "Tx").name).toContain("bootloader_signature_chunk");
    const key = decodeTraceFrame(0x7ed, [1, 2, 3, 4, 5, 6, 7, 8], 8, "Rx");
    expect(key.name).toContain("bootloader_key_id");
    expect(key.result).not.toBe("malformed");
    expect(decodeTraceFrame(0x7ed, [1, 2, 3], 3, "Rx").result).toBe("malformed");
  });

  it("keeps 0x7FA at the three bytes of the version: eleven bytes do not fit it", () => {
    expect(decodeTraceFrame(0x7fa, [1, 0, 0], 3, "Rx").result).not.toBe("malformed");
    expect(decodeTraceFrame(0x7fa, [1, 0, 0, 1, 2, 3, 4, 5, 6, 7], 10, "Rx").result).toBe("malformed");
  });
});
