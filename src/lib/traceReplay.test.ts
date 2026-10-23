import { describe, expect, it } from "vitest";
import { toAscTrace, toTrcTrace } from "./traceExport";
import { LOOP_PAUSE_MS, MAX_GAP_MS, parseTrace, Scheduler, TraceEntry, TracePlayer } from "./traceReplay";

const frame = (timestamp: string, idHex: string, dlc: number, dataHex: string, direction: "Tx" | "Rx" = "Rx") => ({ timestamp, idHex, dlc, dataHex, direction });

const LOG = [
  frame("10:00:00.000", "0x100", 8, "FF 80 00 00 00 00 00 00", "Tx"),
  frame("10:00:00.012", "0x135", 2, "00 DC"),
  frame("10:00:00.512", "0x7F9", 8, "00 01 02 03 04 05 06 07"),
  frame("10:00:01.000", "0x110", 0, ""),
];

describe("reading a recorded trace", () => {
  it("reads back what the Studio itself exports as a PCAN trace, keeping only the received frames", () => {
    const parsed = parseTrace(toTrcTrace(LOG, new Date(2000, 0, 1)));
    expect(parsed.format).toBe("trc");
    expect(parsed.entries.map((e) => e.id)).toEqual([0x135, 0x7f9, 0x110]);
    expect(parsed.entries[0]).toEqual({ timeMs: 0, id: 0x135, data: [0x00, 0xdc] });
    expect(parsed.entries[1].timeMs).toBeCloseTo(500, 1);
    expect(parsed.entries[1].data).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(parsed.entries[2].data).toEqual([]);
    expect(parsed.rejected).toBe(0);
  });

  it("reads back a Vector trace the same way", () => {
    const parsed = parseTrace(toAscTrace(LOG, new Date(2000, 0, 1, 15, 4, 5)));
    expect(parsed.format).toBe("asc");
    expect(parsed.entries.map((e) => e.id)).toEqual([0x135, 0x7f9, 0x110]);
    expect(parsed.entries[1].timeMs).toBeCloseTo(500, 1);
  });

  it("skips headers and comments and refuses a line whose length does not match its data", () => {
    const text = [
      ";$FILEVERSION=1.1",
      ";   Message   Time    Type ID     Len  Data",
      "      1)         0.0  Rx  0110  2  AA BB",
      "      2)         5.0  Rx  0111  3  AA BB",
      "      3)         6.0  Rx  0112  9  00 01 02 03 04 05 06 07 08",
      "      4)         7.0  Rx  0113  2  ZZ 01",
      "garbage",
    ].join("\r\n");
    const parsed = parseTrace(text);
    expect(parsed.entries).toEqual([{ timeMs: 0, id: 0x110, data: [0xaa, 0xbb] }]);
    expect(parsed.rejected).toBe(2); // the line with letters that are not hexadecimal is not a frame at all
  });

  it("refuses an identifier that does not fit 11 bits", () => {
    const parsed = parseTrace("      1)         0.0  Rx  1FFFFFFF  1  AA");
    expect(parsed.entries).toEqual([]);
    expect(parsed.rejected).toBe(1);
  });

  it("puts the frames in time order whatever the order of the lines", () => {
    const parsed = parseTrace(["      1)        10.0  Rx  0102  0", "      2)         0.0  Rx  0101  0"].join("\n"));
    expect(parsed.entries.map((e) => e.id)).toEqual([0x101, 0x102]);
  });

  it("says unknown for a file with no frames", () => {
    const parsed = parseTrace("hello\nworld");
    expect(parsed).toEqual({ format: "unknown", entries: [], rejected: 0 });
  });
});

/** A clock the test moves by hand: a timer fires when the clock reaches it. */
class FakeScheduler implements Scheduler {
  now = 0;
  private timers: Array<{ at: number; callback: () => void; handle: number }> = [];
  private next = 1;
  setTimeout(callback: () => void, ms: number): unknown {
    const handle = this.next++;
    this.timers.push({ at: this.now + ms, callback, handle });
    return handle;
  }
  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((t) => t.handle !== handle);
  }
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      const due = this.timers[0];
      if (!due || due.at > target) break;
      this.timers.shift();
      this.now = due.at;
      due.callback();
    }
    this.now = target;
  }
  get pending(): number { return this.timers.length; }
}

const ENTRIES: TraceEntry[] = [
  { timeMs: 0, id: 0x110, data: [] },
  { timeMs: 100, id: 0x111, data: [1] },
  { timeMs: 300, id: 0x112, data: [2] },
];

describe("playing a trace", () => {
  it("emits the frames with the gaps of the recording", () => {
    const clock = new FakeScheduler();
    const seen: Array<[number, number]> = [];
    const player = new TracePlayer(ENTRIES, (e) => seen.push([clock.now, e.id]), { scheduler: clock });
    player.start();
    clock.advance(1000);
    expect(seen).toEqual([[0, 0x110], [100, 0x111], [300, 0x112]]);
    expect(player.status).toBe("finished");
    expect(player.played).toBe(3);
  });

  it("divides the gaps by the speed and can change it while playing", () => {
    const clock = new FakeScheduler();
    const seen: number[] = [];
    const player = new TracePlayer(ENTRIES, () => seen.push(clock.now), { scheduler: clock, speed: 2 });
    player.start();
    clock.advance(0);
    clock.advance(50);
    expect(seen).toEqual([0, 50]);
    player.setSpeed(1);
    clock.advance(1000);
    expect(seen).toEqual([0, 50, 150]); // the wait already scheduled keeps the old speed
  });

  it("caps a long silence of the recording", () => {
    const clock = new FakeScheduler();
    const seen: number[] = [];
    const player = new TracePlayer([{ timeMs: 0, id: 1, data: [] }, { timeMs: 3_600_000, id: 2, data: [] }], () => seen.push(clock.now), { scheduler: clock });
    player.start();
    clock.advance(MAX_GAP_MS + 1);
    expect(seen).toEqual([0, MAX_GAP_MS]);
  });

  it("pauses without losing its place and goes on", () => {
    const clock = new FakeScheduler();
    const seen: number[] = [];
    const player = new TracePlayer(ENTRIES, (e) => seen.push(e.id), { scheduler: clock });
    player.start();
    clock.advance(0);
    player.pause();
    expect(player.status).toBe("paused");
    clock.advance(10_000);
    expect(seen).toEqual([0x110]);
    player.start();
    clock.advance(1000);
    expect(seen).toEqual([0x110, 0x111, 0x112]);
  });

  it("stops and goes back to the first frame, with nothing left scheduled", () => {
    const clock = new FakeScheduler();
    const seen: number[] = [];
    const player = new TracePlayer(ENTRIES, (e) => seen.push(e.id), { scheduler: clock });
    player.start();
    clock.advance(150);
    player.stop();
    expect(player.status).toBe("idle");
    expect(player.played).toBe(0);
    expect(clock.pending).toBe(0);
    player.start();
    clock.advance(0);
    expect(seen).toEqual([0x110, 0x111, 0x110]);
  });

  it("starts again from the first frame after it finished, and loops when asked to", () => {
    const clock = new FakeScheduler();
    const seen: number[] = [];
    const player = new TracePlayer(ENTRIES, (e) => seen.push(e.id), { scheduler: clock, loop: true });
    player.start();
    clock.advance(300 + LOOP_PAUSE_MS);
    expect(seen).toEqual([0x110, 0x111, 0x112, 0x110]);
    player.setLoop(false);
    clock.advance(1000);
    expect(player.status).toBe("finished");
    expect(seen.length).toBe(6);
  });

  it("reports its state to the screen and ignores a nonsense speed or an empty trace", () => {
    const clock = new FakeScheduler();
    const states: string[] = [];
    const player = new TracePlayer(ENTRIES, () => undefined, { scheduler: clock, speed: -3, onState: (s) => states.push(s) });
    expect(player.speed).toBe(1);
    player.start();
    clock.advance(1000);
    expect(states[0]).toBe("playing");
    expect(states[states.length - 1]).toBe("finished");
    const empty = new TracePlayer([], () => undefined, { scheduler: clock });
    empty.start();
    expect(empty.status).toBe("idle");
  });
});
