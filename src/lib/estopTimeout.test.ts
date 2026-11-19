import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ESTOP_TIMEOUT_MAX_MS, ESTOP_TIMEOUT_MIN_MS, FEATURES_QUERY_ESTOP_IN_FORCE, FEATURES_QUERY_ESTOP_STORED, estopTimeoutValid, estopTimeoutWrite, parseEstopTimeoutAnswer,
} from './featuresMap';

// The silence of the master of the emergency stop on the bus: 0x1AE with eight bytes writes it, 0x1AF with the byte 3 or 4 answers it with eight bytes.
const panel = readFileSync(new URL('../components/tester/ExtrasPanels.tsx', import.meta.url), 'utf8');

describe('the limits and the queries', () => {
  it('are the ones of the specification', () => {
    expect([ESTOP_TIMEOUT_MIN_MS, ESTOP_TIMEOUT_MAX_MS]).toEqual([40, 500]);
    expect(FEATURES_QUERY_ESTOP_IN_FORCE).toEqual([3]);
    expect(FEATURES_QUERY_ESTOP_STORED).toEqual([4]);
  });

  it('take 0 and the range and nothing else', () => {
    for (const ms of [0, 40, 41, 100, 499, 500]) expect(estopTimeoutValid(ms)).toBe(true);
    for (const ms of [-1, 1, 20, 39, 501, 65535, 50.5, Number.NaN, Number.POSITIVE_INFINITY, '50', null, undefined, true]) expect(estopTimeoutValid(ms)).toBe(false);
  });
});

describe('the eight-byte write', () => {
  it('keeps the switches of both bytes and puts the silence high byte first', () => {
    expect(estopTimeoutWrite(0x91, 0x02, 80)).toEqual([0x46, 0x45, 0x41, 0x54, 0x91, 0x02, 0x00, 0x50]);
    expect(estopTimeoutWrite(0x80, 0x00, 500)).toEqual([0x46, 0x45, 0x41, 0x54, 0x80, 0x00, 0x01, 0xF4]);
    expect(estopTimeoutWrite(0x80, 0x00, 0).slice(-2)).toEqual([0, 0]);
  });

  it('is refused for every value outside 0 and the limits', () => {
    for (const ms of [1, 39, 501, 1000, 65535, -4, 12.5]) expect(() => estopTimeoutWrite(0x80, 0, ms)).toThrow(RangeError);
  });

  it('is the vector of the specification', () => {
    expect(estopTimeoutWrite(0x80, 0x00, 50)).toEqual([...Buffer.from('4645415480000032', 'hex')]);
  });
});

describe('the eight-byte answer', () => {
  it('has the two masks, what the head supports and the silence', () => {
    expect(parseEstopTimeoutAnswer([0x80, 0x80, 0xFF, 0x00, 0x00, 0x03, 0x00, 0x32])).toEqual({
      stored: 0x80, running: 0x80, supported: 0xFF, storedExt: 0, runningExt: 0, supportedExt: 3, extended: true, timeoutMs: 50,
    });
    expect(parseEstopTimeoutAnswer([0, 0, 0xFF, 0, 0, 3, 0x01, 0xF4])?.timeoutMs).toBe(500);
  });

  it('is not guessed from the answers of an older head (three or six bytes) or from nothing', () => {
    expect(parseEstopTimeoutAnswer([1, 2, 3])).toBeNull();
    expect(parseEstopTimeoutAnswer([1, 2, 3, 4, 5, 6])).toBeNull();
    expect(parseEstopTimeoutAnswer([1, 2, 3, 4, 5, 6, 7])).toBeNull();
    expect(parseEstopTimeoutAnswer([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBeNull();
    expect(parseEstopTimeoutAnswer(undefined)).toBeNull();
    expect(parseEstopTimeoutAnswer(null)).toBeNull();
  });
});

describe('the panel', () => {
  it('asks before it writes, refuses a value outside the limits before anything is sent, and does not write during an update', () => {
    const body = panel.slice(panel.indexOf('const writeTimeout'), panel.indexOf('const [clearStatus'));
    expect(body.indexOf('estopTimeoutValid(ms)')).toBeGreaterThan(-1);
    expect(body.indexOf('estopTimeoutValid(ms)')).toBeLessThan(body.indexOf('CAN_ID_SET_FEATURES'));
    expect(body.indexOf("confirm('program_config')")).toBeLessThan(body.indexOf('CAN_ID_SET_FEATURES'));
    expect(body.indexOf('ctx.writesBlocked')).toBeLessThan(body.indexOf('CAN_ID_SET_FEATURES'));
    expect(body).toContain('FEATURES_QUERY_ESTOP_STORED');   // the stored state is asked for first: an older head is never written
    expect(panel).toContain('disabled={!ctx.isConnected || ctx.writesBlocked === true}');
  });

  it('starts empty: nothing is written until the person types a value and presses the button', () => {
    expect(panel).toContain("const [timeoutText, setTimeoutText] = useState('');");
  });
});

describe('the texts', () => {
  it('are in the eight languages', () => {
    const keys = ['label', 'read', 'write', 'result', 'invalid', 'mismatch', 'unsupported'].map((k) => `estop_timeout_${k}`);
    for (const language of ['de', 'en', 'es', 'fr', 'it', 'ja', 'pt', 'zh']) {
      const catalog = JSON.parse(readFileSync(new URL(`../locales/${language}.json`, import.meta.url), 'utf8')).testerextras as Record<string, string>;
      for (const key of keys) expect(catalog[key], `${language} ${key}`).toBeTruthy();
    }
  });
});
