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

function show(realSend?: { allowed: boolean; connected: boolean; message?: string; canHold?: boolean; holding?: boolean }) {
  const onAllowedChange = vi.fn();
  const onSend = vi.fn();
  const onStop = vi.fn();
  const onHold = vi.fn();
  const onHoldSecondsChange = vi.fn();
  render(
    <ToolCatalog
      selectedToolId={0} onSelectTool={() => undefined} setpoint={320} onSetpointChange={() => undefined} liveReading={25}
      hardwareState={{} as HardwareState} onSaveToFram={() => undefined} firmwareVersion="0.1.0"
      realSend={realSend ? { ...realSend, message: realSend.message ?? '', holdSeconds: 30, onAllowedChange, onSend, onStop, onHold, onHoldSecondsChange } : undefined}
    />,
  );
  return { onAllowedChange, onSend, onStop, onHold, onHoldSecondsChange };
}

describe('the real-send switch of the Control tab', () => {
  it('shows the switch off and no send button while it is off', () => {
    show({ allowed: false, connected: true });
    expect((screen.getByTestId('real-send-switch') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId('real-send-button')).toBeNull();
  });

  it('has no send button with the switch on but no board connected', () => {
    show({ allowed: true, connected: false });
    expect(screen.queryByTestId('real-send-button')).toBeNull();
  });

  it('shows the button only with the switch on and a board connected, and reports a click once', () => {
    const { onSend } = show({ allowed: true, connected: true });
    fireEvent.click(screen.getByTestId('real-send-button'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('reports the switch being turned on', () => {
    const { onAllowedChange } = show({ allowed: false, connected: true });
    fireEvent.click(screen.getByTestId('real-send-switch'));
    expect(onAllowedChange).toHaveBeenCalledWith(true);
  });

  it('shows the last answer, and nothing at all without the prop', () => {
    show({ allowed: true, connected: true, message: 'Cancelled. Nothing was sent.' });
    expect(screen.getByText('Cancelled. Nothing was sent.')).toBeTruthy();
    cleanup();
    show(undefined);
    expect(screen.queryByTestId('real-send-switch')).toBeNull();
  });
});

describe('STOP and the hold of the Control tab', () => {
  it('shows STOP whenever real sending is on and a board is connected, and never otherwise', () => {
    const { onStop } = show({ allowed: true, connected: true });
    fireEvent.click(screen.getByTestId('real-stop-button'));
    expect(onStop).toHaveBeenCalledTimes(1);
    cleanup();
    show({ allowed: false, connected: true });
    expect(screen.queryByTestId('real-stop-button')).toBeNull();
    cleanup();
    show({ allowed: true, connected: false });
    expect(screen.queryByTestId('real-stop-button')).toBeNull();
  });

  it('offers the hold only for a tool that can be held, with its time field', () => {
    show({ allowed: true, connected: true, canHold: false });
    expect(screen.queryByTestId('real-hold-button')).toBeNull();
    expect(screen.queryByTestId('real-hold-seconds')).toBeNull();
    cleanup();
    const { onHold, onHoldSecondsChange } = show({ allowed: true, connected: true, canHold: true });
    fireEvent.click(screen.getByTestId('real-hold-button'));
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByTestId('real-hold-seconds'), { target: { value: '45' } });
    expect(onHoldSecondsChange).toHaveBeenCalledWith(45);
  });

  it('cannot start a second hold while one is running, and STOP stays', () => {
    show({ allowed: true, connected: true, canHold: true, holding: true });
    expect((screen.getByTestId('real-hold-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('real-stop-button')).toBeTruthy();
  });
});
