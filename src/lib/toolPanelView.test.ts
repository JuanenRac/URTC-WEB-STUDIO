import { describe, expect, it } from 'vitest';
import { URTC_TOOL_PROFILES } from './generated/urtcTools';
import { MOTION_TOOL_IDS, OWN_COMMAND_MOTION_TOOL_IDS, WELD_PULSE_MAX_MS } from './canIds';
import { AOI_STROBE_MAX_MS, AOI_STROBE_MIN_MS, MAX_HEATER_SETPOINT_C, MAX_MOTION_STEPS, PASTE_PULSE_MAX_MS, PASTE_PULSE_MIN_MS } from './toolLimits';
import {
  PANEL_ENCODERS, clampControl, initialValues, labelParams, panelControls, panelOf, panelText, readingOf,
} from './toolPanelView';

const control = (toolId: number, id: string) => panelControls(panelOf(toolId)!).find((c) => c.id === id)!;
const plain = (_key: string, fallback: string, params: Record<string, unknown> = {}) =>
  fallback.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(params[name]));

describe('the panels that are described in the profiles', () => {
  it('exist for the tools the studio draws from data, and for no other', () => {
    const withPanel = URTC_TOOL_PROFILES.filter((p) => p.panel).map((p) => p.id);
    expect(withPanel).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 16, 18, 19, 21, 23, 24]);
  });

  it('cover every plain stepper tool and the crimping actuator with the same one-shot move', () => {
    for (const id of [...MOTION_TOOL_IDS, ...[...OWN_COMMAND_MOTION_TOOL_IDS].filter((i) => i !== 0)]) {
      const actions = panelOf(id)!.sections[0].actions!;
      expect(actions.map((a) => a.encoder)).toEqual(['motionMove', 'motionStop']);
    }
    expect(panelOf(1)!.sections[0].actions![0].canId).toBe(0x120);
    expect(panelOf(21)!.sections[0].actions![0].canId).toBe(0x1F0);
  });

  it('only name frame builders the studio has', () => {
    for (const profile of URTC_TOOL_PROFILES) {
      for (const section of profile.panel?.sections ?? []) {
        for (const action of section.actions ?? []) {
          expect(PANEL_ENCODERS[action.encoder], `${profile.id} ${action.encoder}`).toBeTypeOf('function');
          if (action.off_encoder) expect(PANEL_ENCODERS[action.off_encoder]).toBeTypeOf('function');
        }
      }
    }
  });

  it('use the same limits as the firmware checks of the studio', () => {
    expect(control(19, 'temp')).toMatchObject({ min: 0, max: MAX_HEATER_SETPOINT_C });
    expect(control(1, 'steps')).toMatchObject({ min: 1, max: MAX_MOTION_STEPS });
    expect(control(8, 'period')).toMatchObject({ min: AOI_STROBE_MIN_MS, max: AOI_STROBE_MAX_MS });
    expect(control(23, 'pulse')).toMatchObject({ min: PASTE_PULSE_MIN_MS, max: PASTE_PULSE_MAX_MS });
    expect(control(14, 'ms')).toMatchObject({ min: 1, max: WELD_PULSE_MAX_MS });
    expect(control(24, 'ms')).toMatchObject({ min: 1, max: WELD_PULSE_MAX_MS });
  });

  it('build the same frames the hand-written panels sent', () => {
    expect(PANEL_ENCODERS.drillCommand(120, 'ccw')).toEqual([120, 1]);
    expect(PANEL_ENCODERS.laserCommand(200, true)).toEqual([200, 1]);
    expect(PANEL_ENCODERS.powerByte(300)).toEqual([255]);
    expect(PANEL_ENCODERS.hotAirCommand(350, 80)).toEqual([0x01, 0x5E, 80]);
    expect(PANEL_ENCODERS.motionMove('fwd', 200)).toEqual([1, 0, 0, 0, 200]);
    expect(PANEL_ENCODERS.motionStop('rev')).toEqual([0, 0, 0, 0, 0]);
    expect(PANEL_ENCODERS.weldFire(99999)).toEqual([1, WELD_PULSE_MAX_MS >> 8, WELD_PULSE_MAX_MS & 0xFF]);
    expect(PANEL_ENCODERS.electromagnetCommand(true)).toEqual([1]);
    expect(PANEL_ENCODERS.aoiRingCommand('2', 100)).toEqual([2, 0, 100]);
    expect(PANEL_ENCODERS.pasteJettingPulse(1, 50, 20)).toEqual([1, 50, 20]);
  });

  it('take the identifier of each command and reading from the protocol', () => {
    const drill = panelOf(5)!.sections[0];
    expect(drill.actions![0].canId).toBe(0x140);
    expect(drill.telemetry!.map((r) => [r.canId, r.offset, r.width])).toEqual([[0x147, 0, 2], [0x147, 2, 1]]);
    expect(panelOf(19)!.sections[0].telemetry![0].canId).toBe(0x135);
  });
});

describe('what a panel needs besides its screen', () => {
  it('starts every control at the value of the description', () => {
    expect(initialValues(panelOf(9)!)).toEqual({ power: 0, interlock: false });
    expect(initialValues(panelOf(23)!)).toEqual({ channel: 0, freq: 1000, duty: 50, pulse: 50 });
  });

  it('holds a typed value to the range of its control and falls back to the lowest on text', () => {
    const steps = control(1, 'steps');
    expect(clampControl(steps, '0')).toBe(1);
    expect(clampControl(steps, 'abc')).toBe(1);
    expect(clampControl(control(19, 'temp'), '9999')).toBe(MAX_HEATER_SETPOINT_C);
    expect(clampControl(control(5, 'speed'), 77)).toBe(77);
  });

  it('reads a number from a telemetry frame and refuses a frame that is too short', () => {
    expect(readingOf({ offset: 0, width: 2 }, [0x01, 0x2C, 1])).toBe(300);
    expect(readingOf({ offset: 2, width: 1 }, [0x01, 0x2C, 1])).toBe(1);
    expect(readingOf({ offset: 2, width: 2 }, [0x01, 0x2C, 1])).toBeNull();
  });

  it('writes a label with the value of its control and the range', () => {
    const power = control(18, 'power');
    expect(panelText(plain, power.label, labelParams(power, 40))).toBe('Power (40)');
    const ms = control(14, 'ms');
    expect(panelText(plain, ms.label, labelParams(ms, 5))).toBe(`Pulse duration (1-${WELD_PULSE_MAX_MS} ms)`);
    expect(panelText(plain, panelOf(1)!.sections[0].title, { tool: 'Paste Dispenser' })).toBe('Paste Dispenser (0x120)');
  });
});
