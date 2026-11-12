// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DEFAULT_TRACE_SETTINGS, parseCanTrace } from '../lib/canTrace';
import { TRACE_WORKER_MIN_CHARS, type TraceJob, type TraceWorkerPort } from '../lib/traceParseClient';
import { pageTraceWorker, useTraceLoad } from './useTraceLoad';

afterEach(cleanup);

const trc = (n: number) => `${String(n).padStart(7)})${(n * 2).toFixed(1).padStart(12)}  Rx  0111  4  0A 00 00 00`;
const recording = (frames: number) => [';$FILEVERSION=1.1', ';', ...Array.from({ length: frames }, (_, i) => trc(i + 1))].join('\r\n') + '\r\n';
// long enough to go to the worker (a comment line is not a frame)
const long = (frames: number) => recording(frames) + ';' + 'x'.repeat(TRACE_WORKER_MIN_CHARS) + '\r\n';

function fakeWorker() {
  const jobs: TraceJob[] = [];
  const port: TraceWorkerPort & { terminated: boolean } = {
    terminated: false, onmessage: null, onerror: null,
    postMessage(job) { jobs.push(job); },
    terminate() { port.terminated = true; },
  };
  return { port, jobs };
}

describe('the reading of a recording in the viewer', () => {
  it('has no worker in a browser that has none', () => {
    expect(pageTraceWorker).toBeNull();
  });

  it('reads a short recording at once, without a worker', () => {
    const make = vi.fn(() => fakeWorker().port);
    const { result } = renderHook(() => useTraceLoad(recording(3), DEFAULT_TRACE_SETTINGS, make));
    expect(result.current.parsing).toBe(false);
    expect(result.current.load.rows.length).toBe(3);
    expect(make).not.toHaveBeenCalled();
  });

  it('reads a long recording in the worker and keeps the previous reading on screen until the answer arrives', async () => {
    const { port, jobs } = fakeWorker();
    const { result, rerender } = renderHook(({ text }) => useTraceLoad(text, DEFAULT_TRACE_SETTINGS, () => port), { initialProps: { text: recording(2) } });
    expect(result.current.load.rows.length).toBe(2);
    const text = long(5);
    rerender({ text });
    expect(result.current.parsing).toBe(true);
    expect(result.current.load.rows.length).toBe(0);
    expect(jobs).toHaveLength(1);
    await act(async () => { port.onmessage?.({ data: { id: jobs[0].id, load: parseCanTrace(text, DEFAULT_TRACE_SETTINGS) } }); });
    expect(result.current.parsing).toBe(false);
    expect(result.current.load.rows.length).toBe(5);
    const other = long(7);
    rerender({ text: other });
    expect(result.current.parsing).toBe(true);
    expect(result.current.load.rows.length).toBe(5);
    await act(async () => { port.onmessage?.({ data: { id: jobs[1].id, load: parseCanTrace(other, DEFAULT_TRACE_SETTINGS) } }); });
    expect(result.current.load.rows.length).toBe(7);
  });

  it('ignores the answer for a recording that is no longer the one on screen', async () => {
    const { port, jobs } = fakeWorker();
    const first = long(4);
    const { result, rerender } = renderHook(({ text }) => useTraceLoad(text, DEFAULT_TRACE_SETTINGS, () => port), { initialProps: { text: first } });
    rerender({ text: recording(2) });   // the person chose a short one before the long one was read
    await act(async () => { port.onmessage?.({ data: { id: jobs[0].id, load: parseCanTrace(first, DEFAULT_TRACE_SETTINGS) } }); });
    expect(result.current.load.rows.length).toBe(2);
    expect(result.current.parsing).toBe(false);
  });

  it('shows nothing loaded when the worker could not read it', async () => {
    const { port, jobs } = fakeWorker();
    const { result } = renderHook(() => useTraceLoad(long(3), DEFAULT_TRACE_SETTINGS, () => port));
    await act(async () => { port.onmessage?.({ data: { id: jobs[0].id, error: 'broken' } }); });
    expect(result.current.load.rows.length).toBe(0);
    expect(result.current.parsing).toBe(false);
  });

  it('reads a long recording in the page when there is no worker', async () => {
    const { result } = renderHook(() => useTraceLoad(long(6), DEFAULT_TRACE_SETTINGS, null));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(result.current.load.rows.length).toBe(6);
    expect(result.current.parsing).toBe(false);
  });

  it('stops the worker when the viewer goes away', () => {
    const { port } = fakeWorker();
    const { unmount } = renderHook(() => useTraceLoad(long(2), DEFAULT_TRACE_SETTINGS, () => port));
    unmount();
    expect(port.terminated).toBe(true);
  });
});
