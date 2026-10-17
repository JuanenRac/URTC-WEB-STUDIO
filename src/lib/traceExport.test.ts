import { describe, expect, it, vi } from "vitest";
import { relativeTimesMs, timestampToMs, toAscTrace, toTrcTrace, traceBitCount } from "./traceExport";
import { downloadBlob, REVOKE_DELAY_MS } from "./download";

const frame = (timestamp: string, idHex: string, dlc: number, dataHex: string, direction: "Tx" | "Rx" = "Rx") => ({ timestamp, idHex, dlc, dataHex, direction });

describe("bus trace files", () => {
  it("turns the log stamps back into milliseconds", () => {
    expect(timestampToMs("00:00:01.250")).toBe(1250);
    expect(timestampToMs("01:02:03.004")).toBe(3723004);
    expect(timestampToMs("garbage")).toBeNull();
  });

  it("gives every frame its time after the first one, also across midnight", () => {
    const times = relativeTimesMs([frame("23:59:59.900", "0x100", 0, ""), frame("00:00:00.100", "0x100", 0, "")]);
    expect(times).toEqual([0, 200]);
  });

  it("writes a PCAN trace with a header, relative times and 4-digit identifiers", () => {
    const text = toTrcTrace([
      frame("10:00:00.000", "0x100", 8, "FF 80 00 00 00 00 00 00", "Tx"),
      frame("10:00:00.012", "0x135", 2, "00 DC"),
    ], new Date(2000, 0, 1));
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(";$FILEVERSION=1.1");
    expect(lines[1]).toMatch(/^;\$STARTTIME=\d+\.\d{10}$/);
    expect(lines[4]).toMatch(/^\s+1\)\s+0\.0\s+Tx\s+0100\s+8\s+FF 80 00 00 00 00 00 00$/);
    expect(lines[5]).toMatch(/^\s+2\)\s+12\.0\s+Rx\s+0135\s+2\s+00 DC$/);
  });

  it("writes a Vector ASC trace with seconds relative to the first frame", () => {
    const text = toAscTrace([frame("10:00:00.000", "0x100", 1, "01", "Tx"), frame("10:00:01.500", "0x7F5", 1, "03")], new Date(2000, 0, 1, 15, 4, 5));
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("date Sat Jan 01 03:04:05 pm 2000");
    expect(lines[1]).toBe("base hex  timestamps absolute");
    expect(lines[3]).toMatch(/^\s*0\.000000 1\s+100\s+Tx\s+d 1 01$/);
    expect(lines[4]).toMatch(/^\s*1\.500000 1\s+7F5\s+Rx\s+d 1 03$/);
  });

  it("counts the real length of a frame for the bus load", () => {
    expect(traceBitCount(0)).toBe(47);
    expect(traceBitCount(8)).toBe(111);
  });
});

describe("saving a file", () => {
  it("attaches the link while it is clicked and releases the object URL later", () => {
    const calls: string[] = [];
    const a: any = { style: {}, click: () => calls.push("click"), remove: () => calls.push("remove") };
    const later = vi.fn();
    downloadBlob(new Blob(["x"]), "f.txt", {
      document: { createElement: () => a, body: { appendChild: () => calls.push("append") } } as any,
      url: { createObjectURL: () => "blob:1", revokeObjectURL: (u: string) => calls.push("revoke " + u) },
      later,
    });
    expect(calls).toEqual(["append", "click", "remove"]);
    expect(a.download).toBe("f.txt");
    expect(later).toHaveBeenCalledWith(expect.any(Function), REVOKE_DELAY_MS);
    later.mock.calls[0][0]();
    expect(calls[calls.length - 1]).toBe("revoke blob:1");
  });
});
