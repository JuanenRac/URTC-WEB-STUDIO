import type { ThermalStats } from './thermalStats';

// The lifetime thermal counters of the board (lib/thermalStats.ts) read again and again become a history: how the hours of the heater
// grow and when a runaway fault was added. The history is a list of readings with the time they were taken; the chart, the CSV and the
// storage rules are here, with no React and no port, so they are tested directly.

export interface ThermalSample {
  /** Milliseconds since 1970 when the reading was taken. */
  at: number;
  faultCount: number;
  heaterOnSeconds: number;
  lastFault: number;
}

/** Oldest readings are dropped past this many (a reading every ten seconds fills it in about an hour and a half). */
export const HISTORY_LIMIT = 500;
export const HISTORY_STORAGE_KEY = 'urtc-web-studio-thermal-history';

export function sampleOf(stats: Pick<ThermalStats, 'faultCount' | 'heaterOnSeconds' | 'lastFault'>, at: number): ThermalSample {
  return { at, faultCount: stats.faultCount, heaterOnSeconds: stats.heaterOnSeconds, lastFault: stats.lastFault };
}

/**
 * The history with one more reading. The counters of a board only grow: a reading below the one before means another board (or counters
 * that were cleared), and the history of the earlier one does not belong in the same line, so it starts again from this reading.
 */
export function addSample(history: ThermalSample[], sample: ThermalSample, limit = HISTORY_LIMIT): ThermalSample[] {
  const last = history[history.length - 1];
  const restart = last !== undefined && (sample.faultCount < last.faultCount || sample.heaterOnSeconds < last.heaterOnSeconds || sample.at < last.at);
  const next = restart ? [sample] : [...history, sample];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Faults added between the first and the last reading of the history. */
export function faultsAdded(history: ThermalSample[]): number {
  return history.length < 2 ? 0 : history[history.length - 1].faultCount - history[0].faultCount;
}

export interface ThermalHistoryChart {
  /** Polyline points of the hours the heater was on. */
  heater: string;
  /** Polyline points of the faults, drawn as steps. */
  faults: string;
  spanMs: number;
  maxHours: number;
  maxFaults: number;
  /** Faults appear as marks where the count went up. */
  faultMarks: number[];
  grid: Array<{ y: number; hours: number }>;
}

/** Two lines over time: the hours of the heater (scale of the left) and the faults (their own scale, at least 1). */
export function thermalHistoryChart(history: ThermalSample[], width: number, height: number, pad = 8): ThermalHistoryChart {
  const first = history.length ? history[0].at : 0;
  const spanMs = history.length ? history[history.length - 1].at - first : 0;
  const hours = history.map((s) => s.heaterOnSeconds / 3600);
  const peakHours = hours.length ? Math.max(...hours) : 0;
  const maxHours = niceCeiling(peakHours);
  const maxFaults = Math.max(1, ...history.map((s) => s.faultCount));
  const x = (at: number) => pad + (spanMs === 0 ? 0 : ((at - first) / spanMs) * (width - 2 * pad));
  const yHours = (h: number) => height - pad - (h / maxHours) * (height - 2 * pad);
  const yFaults = (n: number) => height - pad - (n / maxFaults) * (height - 2 * pad);
  const fmt = (n: number) => n.toFixed(1);
  const heater = history.map((s, i) => `${fmt(x(s.at))},${fmt(yHours(hours[i]))}`).join(' ');
  const steps: string[] = [];
  history.forEach((s, i) => {
    if (i > 0) steps.push(`${fmt(x(s.at))},${fmt(yFaults(history[i - 1].faultCount))}`);
    steps.push(`${fmt(x(s.at))},${fmt(yFaults(s.faultCount))}`);
  });
  const faultMarks = history.flatMap((s, i) => (i > 0 && s.faultCount > history[i - 1].faultCount ? [x(s.at)] : []));
  const grid = Array.from({ length: 5 }, (_, i) => ({ y: yHours((maxHours * i) / 4), hours: Math.round(((maxHours * i) / 4) * 100) / 100 }));
  return { heater, faults: steps.join(' '), spanMs, maxHours, maxFaults, faultMarks, grid };
}

/** A round upper end for the scale of the hours (1, 2, 5 times a power of ten), never below 0.1 h. */
export function niceCeiling(value: number): number {
  if (!(value > 0.1)) return 0.1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 2, 5, 10]) if (value <= step * power) return step * power;
  return 10 * power;
}

/** The history as a table for a spreadsheet: one line per reading, oldest first. */
export function thermalHistoryCsv(history: ThermalSample[]): string {
  const lines = ['time,fault_count,heater_on_seconds,heater_on_hours,last_fault'];
  for (const s of history) lines.push([new Date(s.at).toISOString(), s.faultCount, s.heaterOnSeconds, (s.heaterOnSeconds / 3600).toFixed(4), s.lastFault].join(','));
  return lines.join('\n') + '\n';
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The stored history; anything that is not a list of well-formed readings gives an empty history (storage can hold anything). */
export function loadHistory(storage: Storage | undefined): ThermalSample[] {
  try {
    const raw = storage?.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const valid = (v: unknown): v is ThermalSample => {
      if (typeof v !== 'object' || v === null) return false;
      const s = v as Record<string, unknown>;
      return ['at', 'faultCount', 'heaterOnSeconds', 'lastFault'].every((k) => typeof s[k] === 'number' && Number.isFinite(s[k] as number) && (s[k] as number) >= 0);
    };
    if (!data.every(valid)) return [];
    return data.slice(-HISTORY_LIMIT).map((s) => ({ at: s.at, faultCount: s.faultCount, heaterOnSeconds: s.heaterOnSeconds, lastFault: s.lastFault }));
  } catch {
    return [];
  }
}

export function saveHistory(storage: Storage | undefined, history: ThermalSample[]): void {
  try {
    if (history.length === 0) storage?.removeItem(HISTORY_STORAGE_KEY);
    else storage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable or full (private window): the history of this session is kept in memory only
  }
}
