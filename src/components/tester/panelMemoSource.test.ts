import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The panels of the tester page are big files that no test draws, so they are held to being memoized by reading their source: importing them here
// would only add their lines to the coverage without testing them. The behaviour of a memoized panel is checked in panelMemo.dom.test.tsx.
const PANELS: Record<string, string[]> = {
  'GlobalPanels.tsx': ['GlobalControlsPanel', 'ExpansionBoardPanel', 'FramPanel', 'SelfTestPanel', 'BusMonitorPanel', 'CustomFramePanel'],
  'ExtrasPanels.tsx': ['BlackBoxPanel', 'FeaturesPanel', 'PidPanel', 'ThermalViewPanel', 'RackBenchPanel', 'EvidenceHistoryPanel'],
  'GeneratedToolPanel.tsx': ['GeneratedToolPanel'],
  'TraceViewerPanel.tsx': ['TraceViewerPanel'],
  'ToolProfilePanel.tsx': ['ToolProfilePanel'],
  'ToolPanels.tsx': ['NoHandlerPanel'],
};

describe('the panels of the tester page', () => {
  for (const [file, names] of Object.entries(PANELS)) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    for (const name of names) {
      it(`${name} is exported memoized`, () => {
        expect(source).toContain(`export const ${name} = React.memo(${name}Body);`);
        expect(source).not.toMatch(new RegExp(`export const ${name}: React\\.FC`));
      });
    }
  }
});
