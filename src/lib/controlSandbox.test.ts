import { describe, expect, it, vi } from 'vitest';
import { CONTROL_SEND_STORAGE_KEY, loadControlSend, planControlSend, runControlSend, saveControlSend } from './controlSandbox';
import { CAN_ID_SOLDER_SETPOINT } from './canIds';

const base = { allowReal: true, connected: true, toolId: 0, value: 320, toolMin: 150, toolMax: 445 };

function memory(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return { store, getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
}

describe('the switch that lets the Control tab send', () => {
  it('is off when nothing was saved, when the storage cannot be read and for any value but 1', () => {
    expect(loadControlSend(undefined)).toBe(false);
    expect(loadControlSend(memory())).toBe(false);
    expect(loadControlSend(memory({ [CONTROL_SEND_STORAGE_KEY]: 'true' }))).toBe(false);
    expect(loadControlSend({ getItem: () => { throw new Error('blocked'); }, setItem: () => undefined })).toBe(false);
  });

  it('is on only after it was saved as on, and saving again as off turns it off', () => {
    const storage = memory();
    saveControlSend(storage, true);
    expect(loadControlSend(storage)).toBe(true);
    saveControlSend(storage, false);
    expect(loadControlSend(storage)).toBe(false);
    expect(() => saveControlSend({ getItem: () => null, setItem: () => { throw new Error('full'); } }, true)).not.toThrow();
    expect(() => saveControlSend(undefined, true)).not.toThrow();
  });
});

describe('what the button of the Control tab may do', () => {
  it('only simulates, and never plans a frame, while the switch is off or no board is connected', () => {
    expect(planControlSend({ ...base, allowReal: false })).toEqual({ kind: 'simulate' });
    expect(planControlSend({ ...base, connected: false })).toEqual({ kind: 'simulate' });
    expect(planControlSend({ ...base, allowReal: false, connected: false })).toEqual({ kind: 'simulate' });
  });

  it('plans the setpoint frame of the soldering iron to be confirmed, rounded to whole degrees', () => {
    expect(planControlSend(base)).toEqual({ kind: 'confirm', id: CAN_ID_SOLDER_SETPOINT, data: [0x01, 0x40], action: 'heater', value: 320 });
    expect(planControlSend({ ...base, value: 320.4 })).toMatchObject({ value: 320, data: [0x01, 0x40] });
    expect(planControlSend({ ...base, value: 445 })).toMatchObject({ kind: 'confirm', value: 445 });
  });

  it('works from the limits of the firmware when the tool gives none', () => {
    expect(planControlSend({ allowReal: true, connected: true, toolId: 0, value: 200 })).toMatchObject({ kind: 'confirm', value: 200 });
    expect(planControlSend({ allowReal: true, connected: true, toolId: 0, value: 500 })).toEqual({ kind: 'out_of_range' });
  });

  it('refuses a value outside the limits of the tool or of the firmware, and one that is not a number', () => {
    expect(planControlSend({ ...base, value: 149 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...base, value: 446 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...base, value: 0 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...base, value: Number.NaN })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...base, value: 9999, toolMax: 9999 })).toEqual({ kind: 'out_of_range' });
  });

  it('plans nothing for a tool whose setpoint is not one frame of its own', () => {
    for (const toolId of [1, 5, 9, 22, 99]) expect(planControlSend({ ...base, toolId })).toEqual({ kind: 'unsupported' });
  });
});

describe('sending the planned frame', () => {
  const confirmWith = (answer: boolean) => vi.fn(async () => answer);

  it('sends nothing, and asks nothing, for a plan that is not a frame to confirm', async () => {
    for (const plan of [{ kind: 'simulate' }, { kind: 'unsupported' }, { kind: 'out_of_range' }] as const) {
      const confirm = confirmWith(true);
      const send = vi.fn(async () => undefined);
      await runControlSend(plan, confirm, send);
      expect(confirm).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    }
    expect(await runControlSend({ kind: 'simulate' }, confirmWith(true), async () => undefined)).toBe('simulated');
    expect(await runControlSend({ kind: 'unsupported' }, confirmWith(true), async () => undefined)).toBe('unsupported');
    expect(await runControlSend({ kind: 'out_of_range' }, confirmWith(true), async () => undefined)).toBe('out_of_range');
  });

  it('does not send without the confirmation of that frame', async () => {
    const send = vi.fn(async () => undefined);
    const plan = planControlSend(base);
    expect(await runControlSend(plan, confirmWith(false), send)).toBe('cancelled');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends exactly one frame per confirmation, and asks again for the next one', async () => {
    const send = vi.fn(async () => undefined);
    const confirm = confirmWith(true);
    const plan = planControlSend(base);
    expect(await runControlSend(plan, confirm, send)).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(CAN_ID_SOLDER_SETPOINT, [0x01, 0x40]);
    expect(confirm).toHaveBeenCalledWith('heater', { value: 320 });
    expect(await runControlSend(plan, confirm, send)).toBe('sent');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('only a true answer counts as a confirmation', async () => {
    const send = vi.fn(async () => undefined);
    const plan = planControlSend(base);
    expect(await runControlSend(plan, (async () => undefined) as unknown as () => Promise<boolean>, send)).toBe('cancelled');
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a failure of the adapter reach the caller instead of reporting a send', async () => {
    const plan = planControlSend(base);
    await expect(runControlSend(plan, confirmWith(true), async () => { throw new Error('port closed'); })).rejects.toThrow('port closed');
  });
});
