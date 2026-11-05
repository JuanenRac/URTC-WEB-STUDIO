// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ConfirmDialog } from './ConfirmDialog';
import { Sidebar } from './Sidebar';
import { confirmController } from '../lib/confirmController';

// An instance with no texts: every label shows the English default written in the component.
i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

afterEach(() => { cleanup(); confirmController.answer(false); });

const options = { title: 'Fire the pulse?', message: 'The weld will start.', confirmLabel: 'Fire', cancelLabel: 'Cancel', risk: 'danger' as const };

describe('the confirmation dialog', () => {
  it('shows nothing until a command asks for a confirmation', () => {
    render(<ConfirmDialog />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the question with the focus on Cancel and answers true only when the person confirms', async () => {
    render(<ConfirmDialog />);
    let answer: Promise<boolean> | undefined;
    act(() => { answer = confirmController.ask(options); });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Fire the pulse?')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => { fireEvent.click(screen.getByText('Fire')); });
    expect(await answer).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('answers false on Cancel, on Escape and on a click outside the box', async () => {
    render(<ConfirmDialog />);
    for (const close of [
      () => fireEvent.click(screen.getByText('Cancel')),
      () => fireEvent.keyDown(window, { key: 'Escape' }),
      () => fireEvent.mouseDown(screen.getByRole('alertdialog').parentElement as HTMLElement),
    ]) {
      let answer: Promise<boolean> | undefined;
      act(() => { answer = confirmController.ask({ ...options, risk: 'caution' as const }); });
      await act(async () => { close(); });
      expect(await answer).toBe(false);
    }
  });
});

describe('the side navigation', () => {
  it('lists the seven screens, marks the active one and tells the page which one was chosen', () => {
    const setActiveTab = vi.fn();
    render(<Sidebar activeTab="can" setActiveTab={setActiveTab} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    expect(buttons.filter((b) => b.className.includes('bg-amber-500'))).toHaveLength(1);
    fireEvent.click(screen.getByText('Firmware OTA / Flasher'));
    expect(setActiveTab).toHaveBeenCalledWith('flasher');
    fireEvent.click(screen.getByText('Tester Diagnostics'));
    expect(setActiveTab).toHaveBeenLastCalledWith('tester');
  });
});
