import { describe, expect, it } from 'vitest';
import { URTC_TOOL_PROFILES } from './generated/urtcTools';
import { MOTION_TOOL_IDS, NO_HANDLER_TOOL_IDS, OWN_COMMAND_MOTION_TOOL_IDS, TOOL_NAMES } from './canIds';
import { rangeText, toolProfileView } from './toolProfileView';

describe('the panel of a tool follows its profile', () => {
  it('gives the plain motion panel to the stepper tools that have no command of their own', () => {
    expect([...MOTION_TOOL_IDS].sort((a, b) => a - b)).toEqual([1, 2, 3, 6, 7, 12, 16]);
    expect([...NO_HANDLER_TOOL_IDS].sort((a, b) => a - b)).toEqual([15, 20]);
  });

  it('never gives a tool two of the generic panels', () => {
    for (const id of MOTION_TOOL_IDS) expect(NO_HANDLER_TOOL_IDS.has(id) || OWN_COMMAND_MOTION_TOOL_IDS.has(id)).toBe(false);
  });

  it('writes a view for every profile from the profile alone', () => {
    expect(URTC_TOOL_PROFILES).toHaveLength(25);
    for (const profile of URTC_TOOL_PROFILES) {
      const view = toolProfileView(profile);
      expect(view.title).toBe(TOOL_NAMES[profile.id]);
      expect(view.minVal).toBeLessThanOrEqual(view.defaultSetpoint);
      expect(view.defaultSetpoint).toBeLessThanOrEqual(view.maxVal);
      expect(view.pins).toEqual(profile.pinsUsed);
      expect(view.features).toEqual(profile.features);
    }
  });

  it('reports the watchdog only for the tools that have one', () => {
    expect(toolProfileView(URTC_TOOL_PROFILES[0]).watchdogMs).toBe(250);
    expect(toolProfileView(URTC_TOOL_PROFILES[1]).watchdogMs).toBeNull();
  });

  it('shows the range with the unit of the hero metric', () => {
    expect(rangeText({ minVal: 150, maxVal: 445, unit: '°C' })).toBe('150 ... 445 °C');
    expect(rangeText({ minVal: 0, maxVal: 1, unit: '' })).toBe('0 ... 1');
  });
});
