import { describe, expect, it } from 'vitest';
import vectors from './generated/bus_health_vectors.json';
import {
  BUS_ERRORS, BUS_HEALTH_STORAGE_KEY, BUS_WARNING_CODES, CAN_ID_HEALTH_PROFILE, DEFAULT_THRESHOLDS, LEGACY_HEAD_KNOWN, MIXED_BUS_SUSPECTED, NO_HEAD_AT_ANY_SPEED,
  busWarnings, isLegacyHead, loadThresholds, profileFromFrame, thresholdsFromConfig,
} from './busHealth';
import { CAN_ID_HEALTH_PROFILE as GENERATED_ID } from './generated/urtcCanIds';

describe('the same judgement as the Python module, held to the same cases', () => {
  it('reads the thresholds of every section of the vectors the same way', () => {
    for (const item of vectors.thresholds) expect(thresholdsFromConfig(item.section)).toEqual(item.expected);
  });

  it('reads the frames of the vectors the same way', () => {
    for (const item of vectors.profiles) expect(profileFromFrame(item.frame)).toEqual(item.expected);
  });

  it('gives the warnings of every case of the vectors', () => {
    expect(vectors.warnings.length).toBeGreaterThanOrEqual(15);
    for (const item of vectors.warnings) {
      expect(busWarnings(item.profiles as never[], item.found_nobody, item.heads, thresholdsFromConfig(item.section))).toEqual(item.expected);
    }
  });

  it('exercises every warning code', () => {
    const seen = new Set(vectors.warnings.flatMap((item) => item.expected));
    expect([...seen].sort()).toEqual([...BUS_WARNING_CODES].sort());
  });
});

describe('the judgement', () => {
  it('uses the health identifier of the specification', () => {
    expect(CAN_ID_HEALTH_PROFILE).toBe(GENERATED_ID);
    expect(CAN_ID_HEALTH_PROFILE).toBe(0x1b8);
  });

  it('says nothing about a quiet bus and warns of errors at the threshold', () => {
    expect(busWarnings([{ tec: 0, rec: 0, bus_off_count: 0 }])).toEqual([]);
    expect(busWarnings([{ tec: 95, rec: 95, bus_off_count: 0 }])).toEqual([]);
    for (const profile of [{ tec: 96, rec: 0, bus_off_count: 0 }, { tec: 0, rec: 96, bus_off_count: 0 }, { tec: 0, rec: 0, bus_off_count: 1 }]) {
      expect(busWarnings([profile])).toEqual([BUS_ERRORS]);
    }
  });

  it('says a bus mixes speeds only when a known legacy head and errors come together', () => {
    const limits = thresholdsFromConfig({ legacy_heads: ['HEAD-OLD'] });
    const noisy = [{ tec: 120, rec: 0, bus_off_count: 0 }];
    expect(busWarnings(noisy, false, ['HEAD-OLD'], limits)).toEqual([MIXED_BUS_SUSPECTED, BUS_ERRORS, LEGACY_HEAD_KNOWN]);
    expect(busWarnings(noisy, false, ['HEAD-NEW'], limits)).toEqual([BUS_ERRORS]);
    expect(busWarnings([], false, ['HEAD-OLD'], limits)).toEqual([LEGACY_HEAD_KNOWN]);
    expect(busWarnings(noisy, false, ['HEAD-OLD'])).toEqual([BUS_ERRORS]);
  });

  it('warns when a search at every speed found nobody', () => {
    expect(busWarnings([], true)).toEqual([NO_HEAD_AT_ANY_SPEED]);
  });

  it('matches the names of the legacy heads as text', () => {
    const limits = thresholdsFromConfig({ legacy_heads: [12345, 'abc'] });
    expect(isLegacyHead(12345, limits) && isLegacyHead('12345', limits) && isLegacyHead('abc', limits)).toBe(true);
    expect(isLegacyHead(null, limits) || isLegacyHead(undefined, limits) || isLegacyHead('other', limits)).toBe(false);
  });

  it('keeps the defaults for a value outside the limits and does not share the list between calls', () => {
    expect(thresholdsFromConfig({ tec_warn: 0, rec_warn: 256, bus_off_warn: 1.5 })).toEqual(DEFAULT_THRESHOLDS);
    const a = thresholdsFromConfig(null);
    a.legacy_heads.push('x');
    expect(thresholdsFromConfig(null).legacy_heads).toEqual([]);
  });
});

describe('the thresholds kept in this browser', () => {
  const store = (value: string | null | (() => never)) => ({ getItem: (key: string) => { if (typeof value === 'function') value(); return key === BUS_HEALTH_STORAGE_KEY ? value as string | null : null; } });

  it('are read as JSON, and anything unreadable gives the defaults', () => {
    expect(loadThresholds(store('{"tec_warn": 40, "legacy_heads": ["A"]}'))).toEqual({ ...DEFAULT_THRESHOLDS, tec_warn: 40, legacy_heads: ['A'] });
    expect(loadThresholds(store('{oops'))).toEqual(DEFAULT_THRESHOLDS);
    expect(loadThresholds(store(null))).toEqual(DEFAULT_THRESHOLDS);
    expect(loadThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
    expect(loadThresholds(store(() => { throw new Error('blocked'); }))).toEqual(DEFAULT_THRESHOLDS);
  });
});
