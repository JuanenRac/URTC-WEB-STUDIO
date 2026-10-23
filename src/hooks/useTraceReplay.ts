import { useCallback, useEffect, useRef, useState } from 'react';
import { CanFrame } from '../types';
import { parseTrace, PlayerState, TraceEntry, TracePlayer } from '../lib/traceReplay';

/** Biggest trace file the page reads: the text of a recording of many minutes is a few megabytes. */
export const MAX_TRACE_FILE_BYTES = 20 * 1024 * 1024;

export type TraceLoadError = 'too_big' | 'empty' | 'unreadable';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function toFrame(entry: TraceEntry, seq: number): CanFrame {
  const now = new Date();
  const dataHex = entry.data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  return {
    id: entry.id,
    idHex: `0x${entry.id.toString(16).toUpperCase().padStart(3, '0')}`,
    dlc: entry.data.length,
    data: entry.data,
    dataHex,
    timestamp: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`,
    direction: 'Rx',
    description: 'Replayed from a recorded trace',
    replayed: true,
    seq,
  };
}

/**
 * Plays a recorded .trc / .asc trace into the screens with no board. It never plays while `blocked` is true (a real board is
 * connected: a recording must not be mixed with what the board says), and it stops by itself when a board is connected.
 */
export function useTraceReplay(emit: (frame: CanFrame) => void, blocked: boolean, onStopped?: () => void) {
  const [fileName, setFileName] = useState('');
  const [total, setTotal] = useState(0);
  const [played, setPlayed] = useState(0);
  const [state, setState] = useState<PlayerState>('idle');
  const [speed, setSpeedState] = useState(1);
  const [loop, setLoopState] = useState(false);
  const [error, setError] = useState<TraceLoadError | null>(null);
  const [rejected, setRejected] = useState(0);
  const playerRef = useRef<TracePlayer | null>(null);
  const entriesRef = useRef<TraceEntry[]>([]);
  const seqRef = useRef(0);
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const stoppedRef = useRef(onStopped);
  stoppedRef.current = onStopped;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const build = useCallback((entries: TraceEntry[]) => {
    playerRef.current?.stop();
    playerRef.current = new TracePlayer(entries, (entry) => emitRef.current(toFrame(entry, ++seqRef.current)), {
      speed: speedRef.current,
      loop: loopRef.current,
      onState: (s, count, all) => { setState(s); setPlayed(count); setTotal(all); },
    });
  }, []);

  const load = useCallback(async (file: File) => {
    setError(null);
    setRejected(0);
    if (file.size > MAX_TRACE_FILE_BYTES) { setError('too_big'); return; }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('unreadable');
      return;
    }
    const parsed = parseTrace(text);
    if (parsed.entries.length === 0) { setError('empty'); return; }
    entriesRef.current = parsed.entries;
    setFileName(file.name);
    setRejected(parsed.rejected);
    setTotal(parsed.entries.length);
    setPlayed(0);
    setState('idle');
    build(parsed.entries);
  }, [build]);

  const play = useCallback(() => { if (!blocked) playerRef.current?.start(); }, [blocked]);
  const pause = useCallback(() => playerRef.current?.pause(), []);
  const stop = useCallback(() => {
    playerRef.current?.stop();
    stoppedRef.current?.();
  }, []);
  const setSpeed = useCallback((value: number) => { setSpeedState(value); playerRef.current?.setSpeed(value); }, []);
  const setLoop = useCallback((value: boolean) => { setLoopState(value); playerRef.current?.setLoop(value); }, []);

  useEffect(() => {
    if (blocked && playerRef.current?.playing) playerRef.current.pause();
  }, [blocked]);
  useEffect(() => () => playerRef.current?.stop(), []);

  return { fileName, total, played, state, speed, loop, error, rejected, blocked, load, play, pause, stop, setSpeed, setLoop };
}

export type TraceReplay = ReturnType<typeof useTraceReplay>;
