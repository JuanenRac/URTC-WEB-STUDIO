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

function show(enabled: boolean) {
  const onEnabledChange = vi.fn();
  render(
    <ToolCatalog
      selectedToolId={0} onSelectTool={() => undefined} setpoint={320} onSetpointChange={() => undefined} liveReading={25}
      hardwareState={{} as HardwareState} onSaveToFram={() => undefined} firmwareVersion="0.1.0"
      realSend={{ connected: true, message: '', enabled, onEnabledChange, onSend: () => undefined, onStop: () => undefined }}
    />,
  );
  return { onEnabledChange };
}

describe('the switch that allows sending to the real board', () => {
  it('is checked and leaves the send button when on', () => {
    show(true);
    expect((screen.getByTestId('real-send-switch') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByTestId('real-send-button')).toBeTruthy();
    expect(screen.queryByTestId('real-send-off')).toBeNull();
  });

  it('hides the send and hold buttons when off, says so, and keeps STOP', () => {
    show(false);
    expect((screen.getByTestId('real-send-switch') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByTestId('real-send-button')).toBeNull();
    expect(screen.queryByTestId('real-hold-button')).toBeNull();
    expect(screen.getByTestId('real-send-off')).toBeTruthy();
    expect(screen.getByTestId('real-stop-button')).toBeTruthy();
  });

  it('reports the change of the check box', () => {
    const { onEnabledChange } = show(true);
    fireEvent.click(screen.getByTestId('real-send-switch'));
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });
});
