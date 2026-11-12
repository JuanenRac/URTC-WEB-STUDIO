import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TRACE_SETTINGS, parseCanTrace, type TraceLoad, type TraceSettings } from '../lib/canTrace';
import { TRACE_WORKER_MIN_CHARS, createTraceParser, type TraceWorkerPort } from '../lib/traceParseClient';

export type TraceWorkerFactory = (() => TraceWorkerPort) | null;

/** The worker of the page; null where the browser has none (the recording is then read in the page). */
export const pageTraceWorker: TraceWorkerFactory =
  typeof Worker === 'undefined' ? null : () => new Worker(new URL('../lib/traceWorker.ts', import.meta.url), { type: 'module' }) as unknown as TraceWorkerPort;

const NOTHING_LOADED: TraceLoad = parseCanTrace('', DEFAULT_TRACE_SETTINGS);

/**
 * The reading of a recording. A short one is read at once; a long one is read in a worker, and until the reading arrives the previous one stays on the
 * screen, so the page never freezes and never shows rows that do not belong to the file that was chosen.
 */
export function useTraceLoad(text: string, settings: TraceSettings, makeWorker: TraceWorkerFactory = pageTraceWorker): { load: TraceLoad; parsing: boolean } {
  const [parser] = useState(() => createTraceParser(makeWorker));   // one parser, and so one worker, for as long as the viewer is on screen
  useEffect(() => () => parser.dispose(), [parser]);

  const quick = useMemo(() => (text.length < TRACE_WORKER_MIN_CHARS ? parseCanTrace(text, settings) : null), [text, settings]);
  const [late, setLate] = useState<{ text: string; settings: TraceSettings; load: TraceLoad } | null>(null);

  useEffect(() => {
    if (quick !== null) return undefined;
    let current = true;
    parser.parse(text, settings).then(
      (load) => { if (current) setLate({ text, settings, load }); },
      () => { if (current) setLate({ text, settings, load: NOTHING_LOADED }); },
    );
    return () => { current = false; };
  }, [parser, quick, text, settings]);

  if (quick !== null) return { load: quick, parsing: false };
  const answered = late !== null && late.text === text && late.settings === settings;
  return { load: late !== null ? late.load : NOTHING_LOADED, parsing: !answered };
}
