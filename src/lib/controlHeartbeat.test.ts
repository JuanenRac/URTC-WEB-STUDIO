import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEARTBEAT_INTERVAL_MS, HOLD_SECONDS_DEFAULT, HOLD_STORAGE_KEY, clampHoldSeconds, loadHoldSeconds, saveHoldSeconds, startHeartbeat,
} from './controlHeartbeat';
import { activeSafeOffCount, runAllSafeOff } from './safeOff';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(async () => { await runAllSafeOff(); vi.useRealTimers(); });

function memory(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return { store, getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
}

describe('the hold time', () => {
  it('is a whole number of seconds from 5 to 120, and the default for anything else', () => {
    expect(clampHoldSeconds(5)).toBe(5);
    expect(clampHoldSeconds(120)).toBe(120);
    expect(clampHoldSeconds('45')).toBe(45);
    for (const bad of [4, 121, 0, -3, 12.5, Number.NaN, 'abc', '', '1e2', null, undefined, true]) expect(clampHoldSeconds(bad)).toBe(HOLD_SECONDS_DEFAULT);
  });

  it('is read from the browser and written back clamped, and a storage that fails gives the default', () => {
    const storage = memory();
    expect(loadHoldSeconds(storage)).toBe(HOLD_SECONDS_DEFAULT);
    saveHoldSeconds(storage, 60);
    expect(storage.store[HOLD_STORAGE_KEY]).toBe('60');
    expect(loadHoldSeconds(storage)).toBe(60);
    saveHoldSeconds(storage, 5000);
    expect(loadHoldSeconds(storage)).toBe(HOLD_SECONDS_DEFAULT);
    expect(loadHoldSeconds(undefined)).toBe(HOLD_SECONDS_DEFAULT);
    expect(loadHoldSeconds({ getItem: () => { throw new Error('blocked'); }, setItem: () => undefined })).toBe(HOLD_SECONDS_DEFAULT);
    expect(() => saveHoldSeconds({ getItem: () => null, setItem: () => { throw new Error('full'); } }, 30)).not.toThrow();
  });

  it('refreshes well inside the 250 ms window of the firmware', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(250);
  });
});

describe('the heartbeat', () => {
  it('sends at once, refreshes every interval and registers its off for a global switch-off while it runs', async () => {
    const send = vi.fn(async () => undefined);
    const off = vi.fn(async () => undefined);
    const beat = startHeartbeat({ send, off, durationMs: 30_000, onEnd: () => undefined });
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(activeSafeOffCount()).toBeGreaterThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(send).toHaveBeenCalledTimes(4);
    beat.stop('stop');
  });

  it('ends on STOP: no more refreshes, the off frame once and the end told once', async () => {
    const send = vi.fn(async () => undefined);
    const off = vi.fn(async () => undefined);
    const onEnd = vi.fn();
    const beat = startHeartbeat({ send, off, durationMs: 30_000, onEnd });
    await vi.advanceTimersByTimeAsync(250);
    beat.stop('stop');
    beat.stop('blur');
    await vi.advanceTimersByTimeAsync(2000);
    const sends = send.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(send.mock.calls.length).toBe(sends);
    expect(off).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith('stop');
    expect(beat.running).toBe(false);
    expect(activeSafeOffCount()).toBe(0);
  });

  it('ends by itself when the time is up, and not one millisecond before', async () => {
    const off = vi.fn(async () => undefined);
    const onEnd = vi.fn();
    const beat = startHeartbeat({ send: async () => undefined, off, durationMs: 5_000, onEnd });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(beat.running).toBe(true);
    expect(off).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(beat.running).toBe(false);
    expect(onEnd).toHaveBeenCalledWith('expired');
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('ends as a lost connection when a refresh cannot be sent', async () => {
    const off = vi.fn(async () => undefined);
    const onEnd = vi.fn();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const beat = startHeartbeat({ send: async () => { throw new Error('port closed'); }, off, durationMs: 30_000, onEnd });
    await vi.advanceTimersByTimeAsync(0);
    expect(onEnd).toHaveBeenCalledWith('connection');
    expect(beat.running).toBe(false);
    quiet.mockRestore();
  });

  it('is switched off by the global switch-off of the page', async () => {
    const off = vi.fn(async () => undefined);
    startHeartbeat({ send: async () => undefined, off, durationMs: 30_000, onEnd: () => undefined });
    await vi.advanceTimersByTimeAsync(0);
    await runAllSafeOff();
    expect(off).toHaveBeenCalledTimes(1);
  });
});
