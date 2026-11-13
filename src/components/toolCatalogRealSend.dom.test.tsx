// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ToolCatalog } from './ToolCatalog';
import type { HardwareState } from '../types';

i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });
afterEach(cleanup);

function show(realSend?: { connected: boolean; message?: string; canHold?: boolean; holding?: boolean }) {
  const onSend = vi.fn();
  const onStop = vi.fn();
  const onHold = vi.fn();
  const onHoldSecondsChange = vi.fn();
  render(
    <ToolCatalog
      selectedToolId={0} onSelectTool={() => undefined} setpoint={320} onSetpointChange={() => undefined} liveReading={25}
      hardwareState={{} as HardwareState} onSaveToFram={() => undefined} firmwareVersion="0.1.0"
      realSend={realSend ? { ...realSend, message: realSend.message ?? '', holdSeconds: 30, onSend, onStop, onHold, onHoldSecondsChange } : undefined}
    />,
  );
  return { onSend, onStop, onHold, onHoldSecondsChange };
}

describe('the real bus label of the Control tab', () => {
  it('shows the real bus label with a board connected, and no switch at all', () => {
    show({ connected: true });
    expect(screen.getByTestId('real-bus-badge').textContent).toBe('Real bus');
    expect(screen.queryByTestId('real-send-switch')).toBeNull();
    expect(screen.getByTestId('real-send-button')).toBeTruthy();
  });

  it('has no send button with no board connected', () => {
    show({ connected: false });
    expect(screen.queryByTestId('real-send-button')).toBeNull();
  });

  it('reports a click on the send button once', () => {
    const { onSend } = show({ connected: true });
    fireEvent.click(screen.getByTestId('real-send-button'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('shows the last answer, and nothing at all without the prop', () => {
    show({ connected: true, message: 'Cancelled. Nothing was sent.' });
    expect(screen.getByText('Cancelled. Nothing was sent.')).toBeTruthy();
    cleanup();
    show(undefined);
    expect(screen.queryByTestId('real-send-switch')).toBeNull();
  });
});

describe('STOP and the hold of the Control tab', () => {
  it('shows STOP whenever a board is connected, and never otherwise', () => {
    const { onStop } = show({ connected: true });
    fireEvent.click(screen.getByTestId('real-stop-button'));
    expect(onStop).toHaveBeenCalledTimes(1);
    cleanup();
    show({ connected: false });
    expect(screen.queryByTestId('real-stop-button')).toBeNull();
  });

  it('offers the hold only for a tool that can be held, with its time field', () => {
    show({ connected: true, canHold: false });
    expect(screen.queryByTestId('real-hold-button')).toBeNull();
    expect(screen.queryByTestId('real-hold-seconds')).toBeNull();
    cleanup();
    const { onHold, onHoldSecondsChange } = show({ connected: true, canHold: true });
    fireEvent.click(screen.getByTestId('real-hold-button'));
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId('real-hold-seconds'), { target: { value: '45' } });
    expect(onHoldSecondsChange).toHaveBeenCalledWith(45);
  });

  it('cannot start a second hold while one is running, and STOP stays', () => {
    show({ connected: true, canHold: true, holding: true });
    expect((screen.getByTestId('real-hold-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('real-stop-button')).toBeTruthy();
  });
});
