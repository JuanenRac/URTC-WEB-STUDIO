import { describe, expect, it } from 'vitest';
import { ThermalError, ThermalStatusError, THERMAL_STATUS_ERROR, THERMAL_STATUS_READY, thermalStatus, waitThermalReady } from './thermalView';

describe('the status frame of the thermal head (0x251)', () => {
  it('reads 0x02 as ready, 0xFF as an error and any other byte as still capturing', () => {
    expect(thermalStatus([THERMAL_STATUS_READY])).toBe('ready');
    expect(thermalStatus([THERMAL_STATUS_ERROR])).toBe('error');
    expect(thermalStatus([0x00])).toBe('busy');
    expect(thermalStatus([0x01])).toBe('busy');
  });

  it('does not take a payload of another length for a status', () => {
    expect(thermalStatus([])).toBe('unknown');
    expect(thermalStatus([THERMAL_STATUS_READY, 0])).toBe('unknown');
  });
});

describe('waiting for the head before the chunks are asked for', () => {
  const answers = (list: Array<number[] | null>) => {
    let asked = 0;
    return { read: async () => list[Math.min(asked++, list.length - 1)], asked: () => asked };
  };

  it('returns as soon as the head is ready, without asking again', async () => {
    const source = answers([[0], [0], [THERMAL_STATUS_READY], [THERMAL_STATUS_ERROR]]);
    await waitThermalReady(source.read);
    expect(source.asked()).toBe(3);
  });

  it('stops at once on a capture error and says so', async () => {
    const source = answers([[0], [THERMAL_STATUS_ERROR], [THERMAL_STATUS_READY]]);
    await expect(waitThermalReady(source.read)).rejects.toMatchObject({ reason: 'capture_error', message: 'the head reports a capture error' });
    expect(source.asked()).toBe(2);
  });

  it('asks again after a lost answer and after a payload that is not a status', async () => {
    const source = answers([null, [1, 2], [THERMAL_STATUS_READY]]);
    await waitThermalReady(source.read);
    expect(source.asked()).toBe(3);
  });

  it('gives up after the attempts when the head never says it is ready', async () => {
    const source = answers([[0]]);
    const failure = await waitThermalReady(source.read, 5).catch((e) => e);
    expect(failure).toBeInstanceOf(ThermalStatusError);
    expect(failure).toBeInstanceOf(ThermalError);
    expect(failure.reason).toBe('not_ready');
    expect(failure.message).toBe('the head did not become ready');
    expect(source.asked()).toBe(5);
  });

  it('asks 50 times by default, and a head that never answers is not ready', async () => {
    const source = answers([null]);
    await expect(waitThermalReady(source.read)).rejects.toMatchObject({ reason: 'not_ready' });
    expect(source.asked()).toBe(50);
  });
});
