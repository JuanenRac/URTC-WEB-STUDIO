// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { URTC_TOOL_PROFILES } from '../../lib/generated/urtcTools';
import { confirmController } from '../../lib/confirmController';
import { panelOf } from '../../lib/toolPanelView';
import { GeneratedToolPanel } from './GeneratedToolPanel';
import type { ToolCtx } from './ToolPanels';

// An instance with no texts: every label shows the English default written in the profile.
i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

afterEach(() => { cleanup(); confirmController.answer(false); vi.useRealTimers(); });

type Listener = (f: { id: number; data: number[] }) => void;

function makeCtx(overrides: Partial<ToolCtx> = {}) {
  const listeners = new Map<number, Set<Listener>>();
  const sent: Array<[number, number[]]> = [];
  const ctx = {
    sendFrame: vi.fn(async (id: number, data: number[]) => { sent.push([id, data]); }),
    waitForFrame: vi.fn(async () => null),
    request: vi.fn(async () => null),
    flushFrames: vi.fn(),
    subscribe: (id: number, cb: Listener) => {
      const set = listeners.get(id) ?? new Set<Listener>();
      set.add(cb);
      listeners.set(id, set);
      return () => { set.delete(cb); };
    },
    isConnected: true,
    ...overrides,
  } as unknown as ToolCtx;
  const emit = (id: number, data: number[]) => act(() => { listeners.get(id)?.forEach((cb) => cb({ id, data } as never)); });
  return { ctx, sent, emit };
}

const draw = (id: number, ctx: ToolCtx) => render(<GeneratedToolPanel ctx={ctx} panel={panelOf(id)!} toolName={URTC_TOOL_PROFILES[id].shortName} />);

describe('a tool panel in a page', () => {
  it('shows the number a telemetry frame holds', () => {
    const { ctx, emit } = makeCtx();
    draw(0, ctx);
    expect(screen.getByTestId('reading-live').textContent).toContain('--');
    emit(0x135, [0x00, 0xdc]);
    expect(screen.getByTestId('reading-live').textContent).toContain('220');
  });

  it('sends the command of a button with the values of the controls', async () => {
    const { ctx, sent } = makeCtx();
    draw(0, ctx);
    fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '300' } });
    await act(async () => { fireEvent.click(screen.getByText('Move')); });
    await act(async () => { confirmController.answer(true); });
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(sent[0][0]).toBe(0x120);
    expect(sent[0][1].slice(1)).toEqual([0, 0, 1, 0x2c]);
  });

  it('holds a value to the range of its control', () => {
    const { ctx } = makeCtx();
    draw(0, ctx);
    const heater = screen.getAllByRole('spinbutton')[0] as HTMLInputElement;
    fireEvent.change(heater, { target: { value: '9999' } });
    expect(heater.value).toBe('445');
  });

  it('asks the board a question and shows the name of the state or the number that comes back', async () => {
    const { ctx } = makeCtx({ request: vi.fn(async () => ({ id: 0x131, data: [0, 0, 0, 7] })) as never });
    draw(0, ctx);
    await act(async () => { fireEvent.click(screen.getByText('Query')); });
    await waitFor(() => expect(screen.getByTestId('query-1').textContent).not.toBe('--'));
    expect(ctx.request).toHaveBeenCalled();
  });

  it('pulls the thermal picture chunk by chunk and draws it, and says so when a frame is missing', async () => {
    const frame = { id: 0x253, data: [0x01, 0x90, 0x01, 0x90, 0x01, 0x90, 0x01, 0x90] };
    const good = makeCtx({ waitForFrame: vi.fn(async () => frame) as never });
    draw(22, good.ctx);
    await act(async () => { fireEvent.click(screen.getByText('Read Thermal Image')); });
    await waitFor(() => expect(screen.getByTestId('panel-image').querySelectorAll('div[title]').length).toBeGreaterThan(0));
    cleanup();
    const bad = makeCtx({ waitForFrame: vi.fn(async () => null) as never });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    draw(22, bad.ctx);
    await act(async () => { fireEvent.click(screen.getByText('Read Thermal Image')); });
    await waitFor(() => expect(screen.getByTestId('panel-image').textContent).toMatch(/\S/));
    spy.mockRestore();
  });

  it('repeats a command while Active is checked after the confirmation, and sends the off frame when it is unchecked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { ctx, sent } = makeCtx();
    draw(5, ctx);
    const active = screen.getAllByRole('checkbox').find((c) => c.closest('label')?.textContent?.includes('Active')) as HTMLInputElement;
    await act(async () => { fireEvent.click(active); });
    await act(async () => { confirmController.answer(true); });
    await waitFor(() => expect(sent.length).toBeGreaterThan(0));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    const during = sent.length;
    expect(during).toBeGreaterThan(1);
    await act(async () => { fireEvent.click(active); });
    await waitFor(() => expect(sent[sent.length - 1][1].every((b) => b === 0)).toBe(true));
  });

  it('does not repeat a command that was not confirmed', async () => {
    const { ctx, sent } = makeCtx();
    draw(9, ctx);
    const active = screen.getAllByRole('checkbox').find((c) => c.closest('label')?.textContent?.includes('Active')) as HTMLInputElement | undefined;
    if (!active) return;
    await act(async () => { fireEvent.click(active); });
    await act(async () => { confirmController.answer(false); });
    expect(active.checked).toBe(false);
    expect(sent.length).toBe(0);
  });
});
