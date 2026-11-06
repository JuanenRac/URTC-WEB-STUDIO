// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Field, KeepaliveCheckbox, LiveGraph, Section, safeInt } from './shared';

i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

afterEach(cleanup);

describe('safeInt', () => {
  it('reads a whole number, falls back when there is none and keeps the result inside the limits', () => {
    expect(safeInt('42', 7)).toBe(42);
    expect(safeInt('12abc', 7)).toBe(12);
    expect(safeInt('', 7)).toBe(7);
    expect(safeInt('x', 7)).toBe(7);
    expect(safeInt('-5', 7, 0)).toBe(0);
    expect(safeInt('500', 7, 0, 255)).toBe(255);
    expect(safeInt('abc', 300, 0, 255)).toBe(255);
    expect(safeInt('10', 7, 0, 255)).toBe(10);
  });
});

describe('the section and the field', () => {
  it('show the title, the subtitle only when there is one, and the content', () => {
    const { rerender } = render(<Section title="Heater" subtitle="Setpoint in C" className="extra"><p>content</p></Section>);
    expect(screen.getByText('Heater')).toBeTruthy();
    expect(screen.getByText('Setpoint in C')).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
    expect(document.querySelector('.extra')).not.toBeNull();
    rerender(<Section title="Heater"><p>content</p></Section>);
    expect(screen.queryByText('Setpoint in C')).toBeNull();
    cleanup();
    render(<Field label="Duty"><input aria-label="duty" /></Field>);
    expect(screen.getByText('Duty')).toBeTruthy();
    expect(screen.getByLabelText('duty')).toBeTruthy();
  });
});

describe('the keepalive checkbox', () => {
  it('shows the watchdog, reports the new state and is dimmed and unclickable while it is disabled', () => {
    const onChange = vi.fn();
    const { rerender } = render(<KeepaliveCheckbox checked={false} onChange={onChange} watchdogMs={250} />);
    expect(screen.getByText('(250ms watchdog)')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<KeepaliveCheckbox checked={true} onChange={onChange} watchdogMs={250} disabled />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('(250ms watchdog)').closest('label')?.className).toContain('pointer-events-none');
  });
});

describe('the live graph', () => {
  const polyline = () => document.querySelector('polyline');

  it('draws nothing until there are two readings and scales them to the top of the range', () => {
    const { rerender } = render(<LiveGraph value={null} yMax={100} />);
    expect(polyline()).toBeNull();
    rerender(<LiveGraph value={50} yMax={100} />);
    expect(polyline()).toBeNull();
    rerender(<LiveGraph value={100} yMax={100} />);
    expect(polyline()?.getAttribute('points')).toBe('0.0,30.0 240.0,0.0');
  });

  it('ignores a repeated reading and a missing one, and clamps a reading beyond the range', () => {
    const { rerender } = render(<LiveGraph value={10} yMax={100} height={100} color="#ff0000" />);
    rerender(<LiveGraph value={10} yMax={100} height={100} color="#ff0000" />);
    rerender(<LiveGraph value={null} yMax={100} height={100} color="#ff0000" />);
    expect(polyline()).toBeNull();
    rerender(<LiveGraph value={500} yMax={100} height={100} color="#ff0000" />);
    expect(polyline()?.getAttribute('points')).toBe('0.0,90.0 240.0,0.0');
    expect(polyline()?.getAttribute('stroke')).toBe('#ff0000');
  });

  it('keeps the last sixty readings', () => {
    const { rerender } = render(<LiveGraph value={0} yMax={100} />);
    for (let i = 1; i <= 70; i++) act(() => { rerender(<LiveGraph value={i} yMax={100} />); });
    expect(polyline()?.getAttribute('points')?.split(' ')).toHaveLength(60);
  });
});
