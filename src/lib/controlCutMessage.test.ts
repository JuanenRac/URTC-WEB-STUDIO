import { describe, expect, it } from 'vitest';
import { cutMessage, stopMessage } from './controlCutMessage';

describe('what is said after switching off', () => {
  it('says the frame was sent only when it was', () => {
    expect(cutMessage('blur', true)?.key).toBe('toolcatalog.real_cut_blur');
    expect(cutMessage('blur', false)?.key).toBe('toolcatalog.real_off_not_sent');
    expect(cutMessage('expired', false)?.key).toBe('toolcatalog.real_off_not_sent');
    expect(cutMessage('connection', false)?.key).toBe('toolcatalog.real_cut_connection');
    expect(cutMessage('switch', false)?.key).toBe('toolcatalog.real_off_not_sent');
    expect(cutMessage('switch', true)).toBeNull();
    expect(cutMessage('unmount', false)).toBeNull();
  });

  it('answers the STOP button from what really went out', () => {
    expect(stopMessage(true, true).key).toBe('toolcatalog.real_cut_stop');
    expect(stopMessage(null, true).key).toBe('toolcatalog.real_cut_stop');
    expect(stopMessage(true, null).key).toBe('toolcatalog.real_cut_stop');
    expect(stopMessage(false, true).key).toBe('toolcatalog.real_off_not_sent');
    expect(stopMessage(true, false).key).toBe('toolcatalog.real_off_not_sent');
    expect(stopMessage(null, null).key).toBe('toolcatalog.real_stop_nothing_sent');
  });
});
