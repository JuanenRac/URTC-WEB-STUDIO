import { decodeThermalStatsResp } from './generated/urtcCanIds';
import { THERMAL_FAULT_NAMES } from './blackBox';

// The lifetime thermal counters of the board (0x1AA asks, 0x1AB answers): how many thermal runaway faults it ever had, how many seconds
// its heater was on, which fault came last, and whether the F-RAM keeps the numbers (when it does not, they are RAM-only since the last
// boot). Firmware from before the counters never answers 0x1AA. No React and no port here.

export interface ThermalStats {
  faultCount: number;
  heaterOnSeconds: number;
  heaterOnHours: number;
  /** The code of the last fault: 0 none, 1 temperature ceiling, 2 heating without a rise, 3 dropped at the target; anything else is unknown. */
  lastFault: number;
  lastFaultName: string;
  /** False when the F-RAM did not answer: the numbers are RAM-only since the last boot. */
  persisted: boolean;
}

/** The 0x1AB payload as a description; null when the payload is not an answer (too short, or longer than a frame). */
export function parseThermalStats(data: ArrayLike<number>): ThermalStats | null {
  if (data.length !== 8) return null;
  const fields = decodeThermalStatsResp(data);
  if (!fields) return null;
  const lastFault = Number(fields.last_fault);
  const seconds = Number(fields.heater_on_seconds);
  return {
    faultCount: Number(fields.fault_count),
    heaterOnSeconds: seconds,
    heaterOnHours: seconds / 3600,
    lastFault,
    lastFaultName: lastFault < THERMAL_FAULT_NAMES.length ? THERMAL_FAULT_NAMES[lastFault] : `unknown_${lastFault}`,
    persisted: Number(fields.persisted) === 1,
  };
}

/** The key of the text of a fault name (the catalog of the interface has one for each of the three faults). */
export function thermalFaultTextKey(stats: ThermalStats): string {
  return stats.lastFault >= 1 && stats.lastFault < THERMAL_FAULT_NAMES.length ? `testerextras.counters_fault_${stats.lastFaultName}` : 'testerextras.counters_fault_unknown';
}
