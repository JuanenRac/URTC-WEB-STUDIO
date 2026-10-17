import { CanFrame } from '../types';

// Trace files the usual CAN tools can open. Both formats need the time of each
// frame relative to the first one, so the "HH:MM:SS.mmm" stamp the log keeps is
// turned back into milliseconds (and carried over midnight).

type TraceFrame = Pick<CanFrame, 'timestamp' | 'direction' | 'idHex' | 'dlc' | 'dataHex'>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds since midnight of an "HH:MM:SS.mmm" stamp, or null if it is not one. */
export function timestampToMs(stamp: string): number | null {
  const m = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/.exec(stamp);
  if (!m) return null;
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number(m[4]);
}

/** Time of every frame in milliseconds after the first one (oldest first in, same order out). */
export function relativeTimesMs(frames: TraceFrame[]): number[] {
  let previous: number | null = null;
  let day = 0;
  let origin: number | null = null;
  return frames.map((f) => {
    const ms = timestampToMs(f.timestamp);
    if (ms === null) return previous === null ? 0 : previous - (origin ?? 0);
    if (previous !== null && ms + day * DAY_MS < previous) day++; // passed midnight
    const absolute = ms + day * DAY_MS;
    previous = absolute;
    if (origin === null) origin = absolute;
    return absolute - origin;
  });
}

/** Bits a standard data frame occupies on the bus, without bit stuffing. */
export function traceBitCount(dlc: number): number {
  return 47 + 8 * dlc;
}

const idDigits = (idHex: string, width: number) => idHex.replace(/^0x/i, '').toUpperCase().padStart(width, '0');

/** PCAN-View text trace (file version 1.1). Frames oldest first. */
export function toTrcTrace(frames: TraceFrame[], now: Date = new Date()): string {
  const times = relativeTimesMs(frames);
  // Days since 1899-12-30, the epoch of the start time field.
  const startDays = now.getTime() / DAY_MS + 25569;
  const lines = [
    ';$FILEVERSION=1.1',
    `;$STARTTIME=${startDays.toFixed(10)}`,
    ';',
    ';   Message   Time    Type ID     Len  Data',
    ...frames.map((f, i) => `${String(i + 1).padStart(7)})${times[i].toFixed(1).padStart(12)}  ${f.direction}  ${idDigits(f.idHex, 4)}  ${f.dlc}  ${f.dataHex}`.trimEnd()),
  ];
  return lines.join('\r\n') + '\r\n';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Vector ASC text trace. Frames oldest first. */
export function toAscTrace(frames: TraceFrame[], now: Date = new Date()): string {
  const times = relativeTimesMs(frames);
  const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  const header = `date ${DAYS[now.getDay()]} ${MONTHS[now.getMonth()]} ${pad(now.getDate())} ${pad(hour12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() < 12 ? 'am' : 'pm'} ${now.getFullYear()}`;
  const lines = [
    header,
    'base hex  timestamps absolute',
    'no internal events logged',
    ...frames.map((f, i) => `${(times[i] / 1000).toFixed(6).padStart(11)} 1  ${idDigits(f.idHex, 1).padEnd(15)} ${f.direction}   d ${f.dlc} ${f.dataHex}`.trimEnd()),
  ];
  return lines.join('\r\n') + '\r\n';
}

export function traceFileName(format: 'trc' | 'asc'): string {
  return `urtc_bus_trace.${format}`;
}
