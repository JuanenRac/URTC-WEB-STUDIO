// Is the bus of the tool heads healthy, or does it mix speeds? Decided from the symptoms, with no change of the protocol: the same judgement as urtc_common.bus_health of
// URTC-COMMON (Python), held to the same cases (generated/bus_health_vectors.json).
//
// A head at another speed than the bus cannot be heard, so it cannot state its speed. What can be seen is what it does to the bus: the error counters of the heads that ARE
// heard rise (the health frame 0x1B8 carries tec, rec and bus_off_count), or a head known to have been built for the legacy speed (500 kbit/s) is on a bus of 1 Mbit/s.

export const CAN_ID_HEALTH_PROFILE = 0x1b8;

/** Warning codes, from the most to the least serious. */
export const MIXED_BUS_SUSPECTED = 'mixed_bus_suspected';
export const NO_HEAD_AT_ANY_SPEED = 'no_head_at_any_speed';
export const BUS_ERRORS = 'bus_errors';
export const LEGACY_HEAD_KNOWN = 'legacy_head_known';
export const BUS_WARNING_CODES = [MIXED_BUS_SUSPECTED, NO_HEAD_AT_ANY_SPEED, BUS_ERRORS, LEGACY_HEAD_KNOWN] as const;
export type BusWarning = (typeof BUS_WARNING_CODES)[number];

export interface Thresholds { tec_warn: number; rec_warn: number; bus_off_warn: number; legacy_heads: string[] }
export interface Profile { tec: number; rec: number; bus_off_count: number }
type PartialProfile = Partial<Profile> | Record<string, never>;

export const DEFAULT_THRESHOLDS: Thresholds = { tec_warn: 96, rec_warn: 96, bus_off_warn: 1, legacy_heads: [] };
const LIMITS: [number, number] = [1, 255];

const whole = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= LIMITS[0] && value <= LIMITS[1] ? value : fallback;

/** The thresholds from a configuration section; a value that is not a whole number inside the limits keeps its default. */
export function thresholdsFromConfig(section: unknown): Thresholds {
  if (section === null || typeof section !== 'object' || Array.isArray(section)) return { ...DEFAULT_THRESHOLDS, legacy_heads: [] };
  const given = section as Record<string, unknown>;
  const heads = Array.isArray(given.legacy_heads)
    ? given.legacy_heads.filter((item): item is string | number => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item))).map(String)
    : [];
  return {
    tec_warn: whole(given.tec_warn, DEFAULT_THRESHOLDS.tec_warn),
    rec_warn: whole(given.rec_warn, DEFAULT_THRESHOLDS.rec_warn),
    bus_off_warn: whole(given.bus_off_warn, DEFAULT_THRESHOLDS.bus_off_warn),
    legacy_heads: heads,
  };
}

/** The three fields of a health frame that are judged, or null when the payload is shorter than the bytes they need. */
export function profileFromFrame(data: number[]): Profile | null {
  return data.length >= 3 ? { tec: data[0], rec: data[1], bus_off_count: data[2] } : null;
}

export function isLegacyHead(name: string | number | null | undefined, thresholds: Thresholds): boolean {
  return name !== null && name !== undefined && thresholds.legacy_heads.includes(String(name));
}

/** The warning codes for what is known about a bus, most serious first; an empty list is a bus with nothing to say. */
export function busWarnings(
  profiles: PartialProfile[], foundNobodyAtAnySpeed = false, headsOnBus: Array<string | number> = [], thresholds: Thresholds = DEFAULT_THRESHOLDS,
): BusWarning[] {
  let errors = false;
  let off = false;
  for (const profile of profiles) {
    const p = profile as Partial<Profile>;
    errors = errors || (p.tec ?? 0) >= thresholds.tec_warn || (p.rec ?? 0) >= thresholds.rec_warn;
    off = off || (p.bus_off_count ?? 0) >= thresholds.bus_off_warn;
  }
  const legacy = headsOnBus.some((name) => isLegacyHead(name, thresholds));
  const found: BusWarning[] = [];
  if (legacy && (errors || off)) found.push(MIXED_BUS_SUSPECTED);
  if (foundNobodyAtAnySpeed) found.push(NO_HEAD_AT_ANY_SPEED);
  if (errors || off) found.push(BUS_ERRORS);
  if (legacy) found.push(LEGACY_HEAD_KNOWN);
  return found;
}

export const BUS_HEALTH_STORAGE_KEY = 'urtc-web-studio-bus-health';

/** The thresholds kept in this browser (a JSON object like the ``bus_health`` section of the other tools); anything unreadable gives the defaults. */
export function loadThresholds(storage?: Pick<Storage, 'getItem'>): Thresholds {
  try {
    const raw = storage?.getItem(BUS_HEALTH_STORAGE_KEY);
    return thresholdsFromConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return thresholdsFromConfig(null);
  }
}
