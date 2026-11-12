import { describe, expect, it, vi } from 'vitest';
import { CONTROL_SEND_STORAGE_KEY, canHoldTool, confirmPlan, loadControlSend, planControlSend, runControlSend, saveControlSend, scaleToByte, stopFrameFor } from './controlSandbox';
import { CAN_ID_DRILL_CMD, CAN_ID_LASER_CMD, CAN_ID_SOLDER_SETPOINT } from './canIds';

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
    expect(planControlSend(base)).toMatchObject({ second: null, heartbeat: true, offData: [0, 0], action: 'heater' });
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
    for (const toolId of [1, 2, 22, 99]) expect(planControlSend({ ...base, toolId })).toEqual({ kind: 'unsupported' });
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

describe('the drill and the laser', () => {
  const drill = { allowReal: true, connected: true, toolId: 5, value: 12000, toolMin: 1000, toolMax: 24000 };
  const laser = { allowReal: true, connected: true, toolId: 9, value: 50, toolMin: 0, toolMax: 100 };

  it('plan one frame each, scaled to the byte of the firmware, with a second confirmation and no heartbeat', () => {
    expect(planControlSend(drill)).toEqual({ kind: 'confirm', id: CAN_ID_DRILL_CMD, data: [128, 0], offData: [0, 0], action: 'drill', value: 12000, second: 'drill', heartbeat: false });
    expect(planControlSend(laser)).toEqual({ kind: 'confirm', id: CAN_ID_LASER_CMD, data: [128, 1], offData: [0, 0], action: 'laser', value: 50, second: 'laser', heartbeat: false });
  });

  it('refuse a value outside the limits of the tool, and a laser at zero (which would arm it for nothing)', () => {
    expect(planControlSend({ ...drill, value: 999 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...drill, value: 24001 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...drill, value: Number.NaN })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...laser, value: 0 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...laser, value: 101 })).toEqual({ kind: 'out_of_range' });
    expect(planControlSend({ ...laser, value: 100 })).toMatchObject({ kind: 'confirm', data: [255, 1] });
  });

  it('never plan a frame while the switch is off or no board is connected', () => {
    for (const input of [{ ...drill, allowReal: false }, { ...drill, connected: false }, { ...laser, allowReal: false }, { ...laser, connected: false }]) {
      expect(planControlSend(input)).toEqual({ kind: 'simulate' });
    }
  });

  it('ask twice, the second time marked as the explicit one, and send only after both', async () => {
    for (const input of [drill, laser]) {
      const plan = planControlSend(input);
      const confirm = vi.fn(async () => true);
      const send = vi.fn(async () => undefined);
      expect(await runControlSend(plan, confirm, send)).toBe('sent');
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(confirm.mock.calls[0]).toEqual([plan.kind === 'confirm' ? plan.action : '', { value: input.value }]);
      expect(confirm.mock.calls[1]).toEqual([plan.kind === 'confirm' ? plan.action : '', { value: input.value, second: true }]);
      expect(send).toHaveBeenCalledTimes(1);
    }
  });

  it('send nothing when either of the two answers is not a true', async () => {
    for (const input of [drill, laser]) {
      const plan = planControlSend(input);
      for (const answers of [[false], [true, false], [true, undefined]]) {
        const queue = [...answers];
        const confirm = vi.fn(async () => queue.shift() as boolean);
        const send = vi.fn(async () => undefined);
        expect(await runControlSend(plan, confirm, send)).toBe('cancelled');
        expect(send).not.toHaveBeenCalled();
      }
    }
  });

  it('ask a heater once, and a plan that is not a frame to confirm is never confirmed', async () => {
    const confirm = vi.fn(async () => true);
    expect(await confirmPlan(planControlSend(base), confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(await confirmPlan({ kind: 'simulate' }, confirm)).toBe(false);
    expect(await confirmPlan({ kind: 'out_of_range' }, confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('what STOP sends and what can be held', () => {
  it('gives the off frame of each tool of this tab, and none for another tool', () => {
    expect(stopFrameFor(0)).toEqual({ id: CAN_ID_SOLDER_SETPOINT, data: [0, 0] });
    expect(stopFrameFor(5)).toEqual({ id: CAN_ID_DRILL_CMD, data: [0, 0] });
    expect(stopFrameFor(9)).toEqual({ id: CAN_ID_LASER_CMD, data: [0, 0] });
    expect(stopFrameFor(1)).toBeNull();
  });

  it('only the heater can be held; the drill and the laser are one confirmed frame', () => {
    expect(canHoldTool(0)).toBe(true);
    for (const toolId of [5, 9, 1, 99]) expect(canHoldTool(toolId)).toBe(false);
  });

  it('scales a value to the byte, kept between 0 and 255', () => {
    expect(scaleToByte(24000, 24000)).toBe(255);
    expect(scaleToByte(0, 24000)).toBe(0);
    expect(scaleToByte(30000, 24000)).toBe(255);
    expect(scaleToByte(-5, 100)).toBe(0);
    expect(scaleToByte(10, 0)).toBe(0);
  });
});
