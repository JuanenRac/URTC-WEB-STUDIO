import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TRACE_SETTINGS, parseCanTrace } from "./canTrace";
import { TRACE_WORKER_MIN_CHARS, answerTraceJob, createTraceParser, type TraceAnswer, type TraceJob, type TraceWorkerPort } from "./traceParseClient";

const trc = (n: number) => `${String(n).padStart(7)})${(n * 2).toFixed(1).padStart(12)}  Rx  0111  4  0A 00 00 00`;
const recording = (frames: number) => [";$FILEVERSION=1.1", ";", ...Array.from({ length: frames }, (_, i) => trc(i + 1))].join("\r\n") + "\r\n";

// A worker that answers when the test says so, or never.
function fakeWorker() {
  const jobs: TraceJob[] = [];
  const port: TraceWorkerPort & { terminated: boolean } = {
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(job) { jobs.push(job); },
    terminate() { port.terminated = true; },
  };
  const answer = (message: TraceAnswer) => port.onmessage?.({ data: message });
  return { port, jobs, answer };
}

describe("what the worker answers", () => {
  it("reads the recording and keeps the id of the job", () => {
    const answer = answerTraceJob({ id: 7, text: recording(3), settings: DEFAULT_TRACE_SETTINGS });
    expect(answer.id).toBe(7);
    expect("load" in answer && answer.load.rows.length).toBe(3);
  });

  it("turns a failure into an answer that says so", () => {
    const broken = answerTraceJob({ id: 2, text: null as unknown as string, settings: DEFAULT_TRACE_SETTINGS });
    expect(broken).toMatchObject({ id: 2 });
    expect("error" in broken && broken.error.length).toBeGreaterThan(0);
    const text = { get length(): number { throw "plain text"; } } as unknown as string;
    expect(answerTraceJob({ id: 3, text, settings: DEFAULT_TRACE_SETTINGS })).toEqual({ id: 3, error: "plain text" });
  });
});

describe("reading a recording away from the page", () => {
  it("reads in the page when there is no way to make a worker", async () => {
    const parser = createTraceParser(null);
    const load = await parser.parse(recording(4), DEFAULT_TRACE_SETTINGS);
    expect(load.rows.length).toBe(4);
    expect(load).toEqual(parseCanTrace(recording(4), DEFAULT_TRACE_SETTINGS));
    parser.dispose();
  });

  it("hands the job to the worker and resolves with its answer; one worker serves every job", async () => {
    const { port, jobs, answer } = fakeWorker();
    const make = vi.fn(() => port);
    const parser = createTraceParser(make);
    const first = parser.parse("first", DEFAULT_TRACE_SETTINGS);
    const second = parser.parse("second", DEFAULT_TRACE_SETTINGS);
    expect(make).toHaveBeenCalledTimes(1);
    expect(jobs.map((j) => j.text)).toEqual(["first", "second"]);
    const loadOf = (n: number) => parseCanTrace(recording(n), DEFAULT_TRACE_SETTINGS);
    answer({ id: jobs[1].id, load: loadOf(2) });
    answer({ id: jobs[0].id, load: loadOf(1) });
    expect((await second).rows.length).toBe(2);
    expect((await first).rows.length).toBe(1);
    answer({ id: 999, load: loadOf(5) });   // an answer nobody waits for is ignored
  });

  it("rejects when the worker says it failed", async () => {
    const { port, jobs, answer } = fakeWorker();
    const parser = createTraceParser(() => port);
    const pending = parser.parse("x", DEFAULT_TRACE_SETTINGS);
    answer({ id: jobs[0].id, error: "it broke" });
    await expect(pending).rejects.toThrow("it broke");
  });

  it("reads in the page what the worker was reading when it died, and everything after it", async () => {
    const { port } = fakeWorker();
    const make = vi.fn(() => port);
    const parser = createTraceParser(make);
    const pending = parser.parse(recording(3), DEFAULT_TRACE_SETTINGS);
    port.onerror?.({});
    expect((await pending).rows.length).toBe(3);
    expect(port.terminated).toBe(true);
    expect((await parser.parse(recording(2), DEFAULT_TRACE_SETTINGS)).rows.length).toBe(2);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it("rejects what the page cannot read either", async () => {
    const { port } = fakeWorker();
    const parser = createTraceParser(() => port);
    const pending = parser.parse(null as unknown as string, DEFAULT_TRACE_SETTINGS);
    port.onerror?.({});
    await expect(pending).rejects.toBeInstanceOf(Error);
    await expect(createTraceParser(null).parse(null as unknown as string, DEFAULT_TRACE_SETTINGS)).rejects.toBeInstanceOf(Error);
    const text = { get length(): number { throw "not text"; } } as unknown as string;
    await expect(createTraceParser(null).parse(text, DEFAULT_TRACE_SETTINGS)).rejects.toThrow("not text");
  });

  it("reads in the page when the worker cannot be made or does not take the job", async () => {
    const refusing = createTraceParser(() => { throw new Error("blocked"); });
    expect((await refusing.parse(recording(2), DEFAULT_TRACE_SETTINGS)).rows.length).toBe(2);
    expect((await refusing.parse(recording(3), DEFAULT_TRACE_SETTINGS)).rows.length).toBe(3);

    const { port } = fakeWorker();
    port.postMessage = () => { throw new Error("cannot clone"); };
    const parser = createTraceParser(() => port);
    expect((await parser.parse(recording(4), DEFAULT_TRACE_SETTINGS)).rows.length).toBe(4);
    expect(port.terminated).toBe(true);
  });

  it("stops the worker when it is disposed, and a later recording starts a new one", () => {
    const first = fakeWorker();
    const second = fakeWorker();
    const queue = [first.port, second.port];
    const parser = createTraceParser(() => queue.shift() as TraceWorkerPort);
    void parser.parse("a", DEFAULT_TRACE_SETTINGS);
    parser.dispose();
    expect(first.port.terminated).toBe(true);
    parser.dispose();
    void parser.parse("b", DEFAULT_TRACE_SETTINGS);
    expect(second.jobs.map((j) => j.text)).toEqual(["b"]);
  });

  it("keeps the threshold below the size of the biggest file the viewer reads", () => {
    expect(TRACE_WORKER_MIN_CHARS).toBeGreaterThan(1000);
    expect(TRACE_WORKER_MIN_CHARS).toBeLessThan(5 * 1024 * 1024);
  });
});
