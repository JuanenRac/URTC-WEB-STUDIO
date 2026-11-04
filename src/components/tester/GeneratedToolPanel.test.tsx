import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { URTC_TOOL_PROFILES } from '../../lib/generated/urtcTools';
import { panelOf } from '../../lib/toolPanelView';
import { GeneratedToolPanel } from './GeneratedToolPanel';
import type { ToolCtx } from './ToolPanels';

// An instance with no texts: every label shows the English default written in the profile.
i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

const ctx: ToolCtx = {
  sendFrame: async () => undefined, waitForFrame: async () => null, request: async () => null, flushFrames: () => undefined,
  subscribe: () => () => undefined, isConnected: true,
};
const html = (id: number) => renderToStaticMarkup(<GeneratedToolPanel ctx={ctx} panel={panelOf(id)!} toolName={URTC_TOOL_PROFILES[id].shortName} />);

describe('a tool panel drawn from its profile', () => {
  it('draws the controls, the repeated command and the readings of a drill', () => {
    const out = html(5);
    expect(out).toContain('Drill (0x140 / telemetry 0x147)');
    expect(out).toContain('type="range"');
    expect(out).toContain('Counter-clockwise');
    expect(out).toContain('Active');
    expect(out).toContain('Speed (0)');
    expect(out).toContain('data-testid="reading-rpm"');
    expect(out).toContain('data-testid="reading-endstop"');
  });

  it('draws two sections side by side for paste jetting and one control set for both', () => {
    const out = html(23);
    expect(out).toContain('lg:grid-cols-2');
    expect(out).toContain('Configure');
    expect(out).toContain('Fire Pulse');
  });

  it('draws the latched switch of the electromagnet and the notice of the laser', () => {
    expect(html(13)).toContain('Energize');
    expect(html(9)).toContain('Interlock must be armed');
  });

  it('puts the name of the tool in the title of a stepper move', () => {
    expect(html(3)).toContain('Screwdriver (0x120)');
    expect(html(21)).toContain('Crimping Actuator (0x1F0)');
  });

  it('draws the soldering iron: heater, feeder move, position query and reset', () => {
    const out = html(0);
    expect(out).toContain('Heater (0x130 / telemetry 0x135)');
    expect(out).toContain('data-testid="reading-live"');
    expect(out).toContain('Wire Feeder');
    expect(out).toContain('data-testid="query-1"');
    expect(out).toContain('Position:');
    expect(out).toContain('Query');
    expect(out).toContain('Reset');
  });

  it('draws the 3D printer as a nozzle and two fan sections with their readings', () => {
    const out = html(10);
    expect(out).toContain('lg:grid-cols-2');
    expect(out).toContain('Move Extruder Once');
    expect(out).toContain('data-testid="reading-hotend"');
    expect(out).toContain('data-testid="reading-layer_rpm"');
    expect(out).toContain('data-testid="reading-hotend_rpm"');
    expect(out).toContain('Layer fan (0)');
    expect(out).toContain('Hotend fan (0)');
  });

  it('draws the scan probe counters, the flying probe config field and the thermal status and picture buttons', () => {
    const probe = html(11);
    expect(probe).toContain('Impacts this session:');
    expect(probe).toContain('data-testid="reading-last"');
    const flying = html(17);
    expect(flying).toContain('value="8583"');
    expect(flying).toContain('Trigger Conversion');
    expect(flying).toContain('Read Result');
    const thermal = html(22);
    expect(thermal).toContain('Trigger Capture');
    expect(thermal).toContain('Check Status');
    expect(thermal).toContain('Read Thermal Image');
    expect(thermal).toContain('data-testid="panel-image"');
  });

  it('draws every panel of the specification without failing', () => {
    for (const profile of URTC_TOOL_PROFILES.filter((p) => p.panel)) expect(html(profile.id)).toContain('generated-tool-panel');
  });
});
