// Replay of a recorded CAN trace (PCAN-View .trc or Vector .asc, the two formats lib/traceExport.ts writes) into
// the screens, with no board and no adapter. Only the frames that were *received* are played: a line marked as
// transmitted is what the recording tool itself sent, and it never arrived from the bus. No React and no timer of
// the browser is in the parser; the player takes its clock from the caller so the timing rules are tested directly.

export interface TraceEntry {
  /** Milliseconds after the first frame of the trace. */
  timeMs: number;
  id: number;
  data: number[];
}

export interface ParsedTrace {
  format: 'trc' | 'asc' | 'unknown';
  entries: TraceEntry[];
  /** Lines of the file that looked like frames but were refused (a data length that does not match, more than 8 bytes). */
  rejected: number;
}

const TRC_ROW = /^\s*\d+\)\s+([0-9.]+)\s+(Rx|Tx)\s+([0-9A-Fa-f]+)\s+(\d+)\s*([0-9A-Fa-f ]*)$/;
const ASC_ROW = /^\s*([0-9.]+)\s+\d+\s+([0-9A-Fa-f]+)\s+(Rx|Tx)\s+d\s+(\d+)\s*([0-9A-Fa-f ]*)$/;

/** Longest trace the player accepts: a recording of hours would fill the memory of the tab for nothing. */
export const MAX_TRACE_FRAMES = 200_000;

function bytesOf(text: string): number[] | null {
  const compact = text.replace(/\s+/g, '');
  if (compact.length % 2 !== 0 || !/^[0-9A-Fa-f]*$/.test(compact)) return null;
  const out: number[] = [];
  for (let i = 0; i < compact.length; i += 2) out.push(parseInt(compact.slice(i, i + 2), 16));
  return out;
}

/** The received frames of a .trc or .asc trace, in file order. Lines that are not frames (headers, comments, events) are skipped. */
export function parseTrace(text: string): ParsedTrace {
  const entries: TraceEntry[] = [];
  let format: ParsedTrace['format'] = 'unknown';
  let rejected = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith(';')) continue;
    let time: number;
    let direction: string;
    let idText: string;
    let dlcText: string;
    let dataText: string;
    const trc = TRC_ROW.exec(raw);
    if (trc) {
      format = format === 'unknown' ? 'trc' : format;
      time = parseFloat(trc[1]);
      [direction, idText, dlcText, dataText] = [trc[2], trc[3], trc[4], trc[5]];
    } else {
      const asc = ASC_ROW.exec(raw);
      if (!asc) continue;
      format = format === 'unknown' ? 'asc' : format;
      time = parseFloat(asc[1]) * 1000;
      [idText, direction, dlcText, dataText] = [asc[2], asc[3], asc[4], asc[5]];
    }
    if (direction !== 'Rx') continue;
    const data = bytesOf(dataText);
    const dlc = parseInt(dlcText, 10);
    const id = parseInt(idText, 16);
    if (data === null || data.length !== dlc || dlc > 8 || !Number.isFinite(time) || id > 0x7ff) {
      rejected++;
      continue;
    }
    if (entries.length >= MAX_TRACE_FRAMES) {
      rejected++;
      continue;
    }
    entries.push({ timeMs: time, id, data });
  }
  // A trace is played in time order whatever the order of the lines was.
  entries.sort((a, b) => a.timeMs - b.timeMs);
  const origin = entries.length > 0 ? entries[0].timeMs : 0;
  for (const entry of entries) entry.timeMs -= origin;
  return { format, entries, rejected };
}

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;

/** The longest wait the player puts between two frames at normal speed: a recording with a long silence does not freeze the screen. */
export const MAX_GAP_MS = 2000;

/** The pause before a looping trace starts again. */
export const LOOP_PAUSE_MS = 250;

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type PlayerState = 'idle' | 'playing' | 'paused' | 'finished';

export interface TracePlayerOptions {
  speed?: number;
  loop?: boolean;
  scheduler?: Scheduler;
  onState?: (state: PlayerState, played: number, total: number) => void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Hands the frames of a trace to `emit` one by one, keeping the gaps between them (divided by the speed, silences capped). */
export class TracePlayer {
  private index = 0;
  private handle: unknown = null;
  private state: PlayerState = 'idle';
  private speedValue: number;
  private loopValue: boolean;
  private readonly scheduler: Scheduler;
  private readonly onState?: TracePlayerOptions['onState'];

  constructor(private readonly entries: TraceEntry[], private readonly emit: (entry: TraceEntry) => void, options: TracePlayerOptions = {}) {
    this.speedValue = TracePlayer.checkedSpeed(options.speed ?? 1);
    this.loopValue = options.loop ?? false;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.onState = options.onState;
  }

  private static checkedSpeed(speed: number): number {
    return Number.isFinite(speed) && speed > 0 ? Math.min(speed, 100) : 1;
  }

  get playing(): boolean { return this.state === 'playing'; }
  get status(): PlayerState { return this.state; }
  get played(): number { return this.index; }
  get total(): number { return this.entries.length; }
  get speed(): number { return this.speedValue; }
  get loop(): boolean { return this.loopValue; }

  setSpeed(speed: number): void { this.speedValue = TracePlayer.checkedSpeed(speed); }
  setLoop(loop: boolean): void { this.loopValue = loop; }

  private set(state: PlayerState): void {
    this.state = state;
    this.onState?.(state, this.index, this.entries.length);
  }

  private gapBefore(index: number): number {
    if (index === 0) return 0;
    const gap = this.entries[index].timeMs - this.entries[index - 1].timeMs;
    return Math.min(MAX_GAP_MS, Math.max(0, gap)) / this.speedValue;
  }

  private schedule(): void {
    if (this.index >= this.entries.length) {
      if (this.loopValue && this.entries.length > 0) {
        this.index = 0;
        // A pause before the trace starts again, so a trace of one frame does not run in a tight loop.
        this.handle = this.scheduler.setTimeout(() => this.tick(), LOOP_PAUSE_MS);
        return;
      } else {
        this.handle = null;
        this.set('finished');
        return;
      }
    }
    this.handle = this.scheduler.setTimeout(() => this.tick(), this.gapBefore(this.index));
  }

  private tick(): void {
    this.handle = null;
    if (this.state !== 'playing') return;
    const entry = this.entries[this.index];
    this.index++;
    this.emit(entry);
    this.onState?.('playing', this.index, this.entries.length);
    if (this.state === 'playing') this.schedule();
  }

  /** Starts from the beginning, or goes on after a pause. */
  start(): void {
    if (this.entries.length === 0 || this.state === 'playing') return;
    if (this.state === 'finished' || this.state === 'idle') this.index = 0;
    this.set('playing');
    this.schedule();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    if (this.handle !== null) this.scheduler.clearTimeout(this.handle);
    this.handle = null;
    this.set('paused');
  }

  /** Stops and goes back to the first frame. */
  stop(): void {
    if (this.handle !== null) this.scheduler.clearTimeout(this.handle);
    this.handle = null;
    this.index = 0;
    this.set('idle');
  }
}
