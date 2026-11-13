// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useControlSession } from './useControlSession';
import type { CutReason } from '../lib/controlHeartbeat';

const frame = { id: 0x130, data: [0x01, 0x40], offData: [0, 0] };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function setup(initial: { connected?: boolean; tabActive?: boolean; allowed?: boolean } = {}) {
  const send = vi.fn(async (_id: number, _data: number[]) => undefined);
  const ends: CutReason[] = [];
  const hook = renderHook((props: { connected: boolean; tabActive: boolean; allowed: boolean }) =>
    useControlSession({ ...props, send, onEnd: (reason) => { ends.push(reason); } }),
  { initialProps: { connected: true, tabActive: true, allowed: true, ...initial } });
  const offSends = () => send.mock.calls.filter(([, data]) => data[0] === 0 && data[1] === 0).length;
  return { send, ends, hook, offSends };
}

async function start(s: ReturnType<typeof setup>, seconds = 30) {
  await act(async () => { s.hook.result.current.startHold(frame, seconds); await vi.advanceTimersByTimeAsync(0); });
}

describe('what the Control tab keeps on', () => {
  it('refreshes the held setpoint inside the window of the firmware and shows that it is holding', async () => {
    const s = setup();
    await start(s);
    expect(s.hook.result.current.holding).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const sends = s.send.mock.calls.filter(([, data]) => data[0] === 1);
    expect(sends.length).toBeGreaterThanOrEqual(10);
    expect(s.offSends()).toBe(0);
    await act(async () => { s.hook.result.current.stop(); });
  });

  it('is cut at once, with the off frame, when the person presses STOP', async () => {
    const s = setup();
    await start(s);
    await act(async () => { s.hook.result.current.stop(); await vi.advanceTimersByTimeAsync(0); });
    expect(s.ends).toEqual(['stop']);
    expect(s.offSends()).toBe(1);
    expect(s.hook.result.current.holding).toBe(false);
    const count = s.send.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(s.send.mock.calls.length).toBe(count);
  });

  it('is cut when the hold time is up, and a new hold needs a new confirmation (a new start)', async () => {
    const s = setup();
    await start(s, 5);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(s.ends).toEqual(['expired']);
    expect(s.offSends()).toBe(1);
    expect(s.hook.result.current.holding).toBe(false);
  });

  it('is cut when the window loses focus and when the page is hidden', async () => {
    for (const lose of [() => window.dispatchEvent(new Event('blur')), () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }]) {
      const s = setup();
      await start(s);
      await act(async () => { lose(); await vi.advanceTimersByTimeAsync(0); });
      expect(s.ends).toEqual(['blur']);
      expect(s.offSends()).toBe(1);
      s.hook.unmount();
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    }
  });

  it('is cut when the tab is left, when the connection is lost and when the real-sending switch is turned off', async () => {
    const cases: Array<[Partial<{ connected: boolean; tabActive: boolean; allowed: boolean }>, CutReason]> = [
      [{ tabActive: false }, 'tab'], [{ connected: false }, 'connection'], [{ allowed: false }, 'stop'],
    ];
    for (const [change, reason] of cases) {
      const s = setup();
      await start(s);
      await act(async () => { s.hook.rerender({ connected: true, tabActive: true, allowed: true, ...change }); await vi.advanceTimersByTimeAsync(0); });
      expect(s.ends).toEqual([reason]);
      expect(s.offSends()).toBe(1);
      s.hook.unmount();
    }
  });

  it('is cut when the page goes away', async () => {
    const s = setup();
    await start(s);
    await act(async () => { s.hook.unmount(); await vi.advanceTimersByTimeAsync(0); });
    expect(s.offSends()).toBe(1);
  });

  it('cuts a single confirmed frame too: the off frame goes out when focus, the tab or the connection is lost', async () => {
    for (const lose of [
      (s: ReturnType<typeof setup>) => { window.dispatchEvent(new Event('blur')); return s; },
      (s: ReturnType<typeof setup>) => { s.hook.rerender({ connected: true, tabActive: false, allowed: true }); return s; },
    ]) {
      const s = setup();
      await act(async () => { s.hook.result.current.rememberSingle({ id: 0x140, data: [128, 0], offData: [0, 0] }); });
      expect(s.hook.result.current.active).toBe(true);
      await act(async () => { lose(s); await vi.advanceTimersByTimeAsync(0); });
      expect(s.offSends()).toBe(1);
      expect(s.ends.length).toBe(1);
      await act(async () => { window.dispatchEvent(new Event('blur')); await vi.advanceTimersByTimeAsync(0); });
      expect(s.offSends()).toBe(1);        // nothing is on any more: no second off frame, no second notice
      s.hook.unmount();
    }
  });

  it('does not send the off frame of a drill that is on when a new setpoint of the same drill replaces it', async () => {
    const s = setup();
    await act(async () => { s.hook.result.current.rememberSingle({ id: 0x140, data: [128, 0], offData: [0, 0] }); });
    await act(async () => { s.hook.result.current.rememberSingle({ id: 0x140, data: [140, 0], offData: [0, 0] }); await vi.advanceTimersByTimeAsync(0); });
    expect(s.offSends()).toBe(0);
    expect(s.ends).toEqual([]);
    expect(s.hook.result.current.active).toBe(true);
    await act(async () => { s.hook.result.current.stop(); await vi.advanceTimersByTimeAsync(0); });
    expect(s.offSends()).toBe(1);
    expect(s.ends).toEqual(['stop']);
    s.hook.unmount();
  });

  it('switches the first tool off when another tool takes its place', async () => {
    const s = setup();
    await act(async () => { s.hook.result.current.rememberSingle({ id: 0x140, data: [128, 0], offData: [0, 0] }); });
    await act(async () => { s.hook.result.current.rememberSingle({ id: 0x141, data: [50, 1], offData: [0, 0] }); await vi.advanceTimersByTimeAsync(0); });
    expect(s.offSends()).toBe(1);
    expect(s.ends).toEqual(['switch']);
    s.hook.unmount();
  });

  it('says nothing and sends nothing when nothing is on', async () => {
    const s = setup();
    await act(async () => { window.dispatchEvent(new Event('blur')); s.hook.rerender({ connected: false, tabActive: false, allowed: false }); await vi.advanceTimersByTimeAsync(0); });
    expect(s.ends).toEqual([]);
    expect(s.send).not.toHaveBeenCalled();
  });
});
