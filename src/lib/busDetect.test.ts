import { describe, expect, it } from 'vitest';
import { BITRATE_TRY_ORDER } from './busRate';
import { AUTO_RATE, BusDetectIo, chosenRate, detectBusRate, openAtBusRate, passiveIdentifiers } from './busDetect';

const last = (items: string[]) => items[items.length - 1];
const IDS = passiveIdentifiers(0x1b1, 0x1b2);

// A fake adapter: records every command; a listen resolves true when the speed set last is one of `heardAt` and the channel was opened listen-only
// (or in normal mode for an answer), the way a real bus would be heard only at its own speed.
function fakeAdapter(heardAt: string[], failOn?: string) {
  const sent: string[] = [];
  let code = '';
  let mode: 'closed' | 'listen' | 'normal' = 'closed';
  let cleared = 0;
  const io: BusDetectIo = {
    async send(command) {
      if (command === failOn) throw new Error('writer gone');
      sent.push(command);
      if (command === 'C') mode = 'closed';
      else if (command.startsWith('S')) code = command.slice(1);
      else if (command === 'L') mode = 'listen';
      else if (command === 'O') mode = 'normal';
    },
    async settle() {},
    clearReceived() { cleared++; },
    listen(_ids, _ms) {
      return new Promise((resolve) => setTimeout(() => resolve(mode !== 'closed' && heardAt.includes(code)), 0));
    },
  };
  return { io, sent, cleared: () => cleared, mode: () => mode };
}

describe('the search for the speed of a bus', () => {
  it('never transmits while it searches: it only opens listen-only and does not send a frame', async () => {
    const adapter = fakeAdapter(['6']);
    const label = await detectBusRate(adapter.io, { identifiers: IDS });
    expect(label).toBe('500 kbit/s');
    expect(adapter.sent.some((command) => command.startsWith('t'))).toBe(false);
    expect(adapter.sent.filter((command) => command === 'L')).toHaveLength(2); // 1 Mbit/s and then 500 kbit/s
    expect(adapter.sent.filter((command) => command === 'O')).toHaveLength(1);
  });

  it('opens normal mode only after a head was heard, at the speed that was heard', async () => {
    const adapter = fakeAdapter(['5']);
    const label = await detectBusRate(adapter.io, { identifiers: IDS });
    expect(label).toBe('250 kbit/s');
    expect(adapter.sent.slice(-3)).toEqual(['C', 'S5', 'O']);
    expect(adapter.mode()).toBe('normal');
    expect(adapter.sent.indexOf('O')).toBe(adapter.sent.length - 1);
  });

  it('tries 1 Mbit/s first and stops at the first speed that is heard', async () => {
    const adapter = fakeAdapter(['8', '6']);
    expect(await detectBusRate(adapter.io, { identifiers: IDS })).toBe('1 Mbit/s');
    expect(adapter.sent.filter((command) => command.startsWith('S') && command !== 'S8')).toEqual([]);
  });

  it('closes the channel and returns null when no speed is heard, having tried every speed of the table', async () => {
    const adapter = fakeAdapter([]);
    expect(await detectBusRate(adapter.io, { identifiers: IDS })).toBeNull();
    expect(adapter.sent.filter((command) => command === 'L')).toHaveLength(BITRATE_TRY_ORDER.length);
    expect(last(adapter.sent)).toBe('C');
    expect(adapter.mode()).toBe('closed');
    expect(adapter.sent).not.toContain('O');
  });

  it('drops the partial line of the previous speed before each one', async () => {
    const adapter = fakeAdapter([]);
    await detectBusRate(adapter.io, { identifiers: IDS, order: BITRATE_TRY_ORDER.slice(0, 3) });
    expect(adapter.cleared()).toBe(3);
  });

  it('closes the channel and rethrows when the adapter fails in the middle', async () => {
    const adapter = fakeAdapter([], 'L');
    await expect(detectBusRate(adapter.io, { identifiers: IDS })).rejects.toThrow('writer gone');
    expect(last(adapter.sent)).toBe('C');
  });

  it('does not hide the first failure when the close fails as well', async () => {
    const io: BusDetectIo = {
      async send(command) { throw new Error(`cannot ${command}`); },
      async settle() {}, clearReceived() {}, listen: async () => false,
    };
    await expect(detectBusRate(io, { identifiers: IDS })).rejects.toThrow('cannot C');
  });

  it('listens for the identifiers that only the heads of the family send', () => {
    expect(IDS).toEqual([0x1b8, 0x1bb, 0x1b1, 0x1b2]);
  });
});

describe('opening at the speed the person chose', () => {
  const options = { queryCommand: 't1000', answerIdentifiers: [0x1b1] };

  it('opens normal mode at that speed, asks once, and keeps the channel open when a head answers', async () => {
    const adapter = fakeAdapter(['3']);
    expect(await openAtBusRate(adapter.io, { label: '100 kbit/s', code: '3' }, options)).toBe(true);
    expect(adapter.sent).toEqual(['C', 'S3', 'O', 't1000']);
    expect(adapter.mode()).toBe('normal');
  });

  it('closes the channel when nobody answers', async () => {
    const adapter = fakeAdapter([]);
    expect(await openAtBusRate(adapter.io, { label: '100 kbit/s', code: '3' }, options)).toBe(false);
    expect(last(adapter.sent)).toBe('C');
    expect(adapter.mode()).toBe('closed');
  });

  it('closes the channel and rethrows when the adapter fails', async () => {
    const adapter = fakeAdapter([], 'O');
    await expect(openAtBusRate(adapter.io, { label: '100 kbit/s', code: '3' }, options)).rejects.toThrow('writer gone');
    expect(last(adapter.sent)).toBe('C');
  });
});

describe('the choice of the selector', () => {
  it('is automatic for the default, for an empty value and for anything that is not a code of the table', () => {
    expect(AUTO_RATE).toBe('auto');
    expect(chosenRate('auto')).toBeNull();
    expect(chosenRate(undefined)).toBeNull();
    expect(chosenRate(null)).toBeNull();
    expect(chosenRate('')).toBeNull();
    expect(chosenRate('9')).toBeNull();
  });

  it('gives the speed of every code of the table', () => {
    for (const entry of BITRATE_TRY_ORDER) expect(chosenRate(entry.code)).toEqual(entry);
  });
});
