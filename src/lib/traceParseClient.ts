import { parseCanTrace, type TraceLoad, type TraceSettings } from './canTrace';

/** A recording shorter than this many characters is read at once in the page: a round trip to a worker would cost more than the reading. */
export const TRACE_WORKER_MIN_CHARS = 50_000;

export interface TraceJob { id: number; text: string; settings: TraceSettings }
export type TraceAnswer = { id: number; load: TraceLoad } | { id: number; error: string };

/** What the worker does with a job: reads the recording and answers with it; a failure becomes an answer that says so, never an exception inside the worker. */
export function answerTraceJob(job: TraceJob): TraceAnswer {
  try {
    return { id: job.id, load: parseCanTrace(job.text, job.settings) };
  } catch (error) {
    return { id: job.id, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The part of a Worker that the client uses, so a test can hand in a stand-in. */
export interface TraceWorkerPort {
  postMessage(job: TraceJob): void;
  terminate(): void;
  onmessage: ((event: { data: TraceAnswer }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface TraceParser {
  /** Reads the recording: in the worker when there is one, in the page when there is none or the worker failed. */
  parse(text: string, settings: TraceSettings): Promise<TraceLoad>;
  /** Stops the worker; what was still being read is never answered. */
  dispose(): void;
}

interface Waiting { text: string; settings: TraceSettings; resolve: (load: TraceLoad) => void; reject: (error: Error) => void }

/**
 * Reads a recording of up to 200,000 frames away from the page, so the page does not freeze while a big file is read. With no way to make a worker
 * (`makeWorker` null) or after a worker failed to start, every recording is read in the page, which is what the viewer always did.
 */
export function createTraceParser(makeWorker: (() => TraceWorkerPort) | null): TraceParser {
  let worker: TraceWorkerPort | null = null;
  let broken = makeWorker === null;
  let next = 0;
  const waiting = new Map<number, Waiting>();

  const inPage = (text: string, settings: TraceSettings): Promise<TraceLoad> => {
    try {
      return Promise.resolve(parseCanTrace(text, settings));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };

  // The worker could not start or died: what it was reading is read in the page, and so is everything after it.
  const fail = () => {
    broken = true;
    worker?.terminate();
    worker = null;
    const pending = [...waiting.values()];
    waiting.clear();
    for (const job of pending) inPage(job.text, job.settings).then(job.resolve, job.reject);
  };

  const start = (): TraceWorkerPort | null => {
    if (worker) return worker;
    if (broken || makeWorker === null) return null;
    try {
      worker = makeWorker();
    } catch {
      broken = true;
      return null;
    }
    worker.onmessage = (event) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if ('error' in event.data) job.reject(new Error(event.data.error)); else job.resolve(event.data.load);
    };
    worker.onerror = fail;
    return worker;
  };

  return {
    parse(text, settings) {
      const port = start();
      if (port === null) return inPage(text, settings);
      const id = ++next;
      return new Promise<TraceLoad>((resolve, reject) => {
        waiting.set(id, { text, settings, resolve, reject });
        try {
          port.postMessage({ id, text, settings });
        } catch {
          fail();
        }
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      waiting.clear();
    },
  };
}
