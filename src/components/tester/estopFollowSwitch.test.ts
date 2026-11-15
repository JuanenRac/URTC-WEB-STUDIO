import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { featuresWrite } from '../../lib/toolFrames';
import { ERROR_REASON_KEYS } from '../../lib/clearError';

// The switch that makes a tool head follow the emergency stop of the stack is a safety option: it starts off. The panel is not drawn by any test, so it is held
// to its source, like the memoization of the panels.
const source = readFileSync(new URL('./ExtrasPanels.tsx', import.meta.url), 'utf8');

describe('the switch of the emergency stop following', () => {
  it('is the eighth bit of the optional functions with its own text', () => {
    expect(source).toContain("[128, 'feature_estop_follow']");
    expect(source).toContain('setMask(data[0] & 0xFF);');
  });

  it('starts unticked: the mask of the panel is zero until a head answers or the person ticks a box', () => {
    expect(source).toContain('const [mask, setMask] = useState(0);');
  });

  it('is written as the bit 0x80, and a mask is kept inside one byte', () => {
    expect(featuresWrite(0x80)).toEqual([0x46, 0x45, 0x41, 0x54, 0x80]);
    expect(featuresWrite(0x100)).toEqual([0x46, 0x45, 0x41, 0x54, 0xFF]);
  });

  it('has the text of the two reasons of an error that the stop can leave', () => {
    expect(ERROR_REASON_KEYS[9]).toBe('error_reason_estop');
    expect(ERROR_REASON_KEYS[10]).toBe('error_reason_estop_silence');
  });
});
