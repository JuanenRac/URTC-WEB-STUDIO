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

function show(realSend?: { allowed: boolean; connected: boolean; message?: string }) {
  const onAllowedChange = vi.fn();
  const onSend = vi.fn();
  render(
    <ToolCatalog
      selectedToolId={0} onSelectTool={() => undefined} setpoint={320} onSetpointChange={() => undefined} liveReading={25}
      hardwareState={{} as HardwareState} onSaveToFram={() => undefined} firmwareVersion="0.1.0"
      realSend={realSend ? { ...realSend, message: realSend.message ?? '', onAllowedChange, onSend } : undefined}
    />,
  );
  return { onAllowedChange, onSend };
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
