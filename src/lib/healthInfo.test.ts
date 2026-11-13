import { describe, expect, it } from 'vitest';
import vectors from './generated/bus_health_vectors.json';
import { CAN_ID_HEALTH_INFO as GENERATED_ID, BUS_RATE_MBIT_1, BUS_RATE_KBIT_500, BUS_RATE_KBIT_250, BUS_RATE_KBIT_125, BUS_RATE_UNKNOWN, PROTOCOL_VERSION } from './generated/urtcCanIds';
import { CAN_ID_HEALTH_INFO, FIRST_DECLARING_VERSION, RATE_OF_CODE, declaredRates, distinctRates, parseHealthInfo, rateText } from './healthInfo';
import { summarizeBoardFrames } from './boardTelemetry';

describe('the identity frame, held to the same cases as the Python reader', () => {
  it('reads every frame of the vectors the same way', () => {
    expect(vectors.info.length).toBeGreaterThanOrEqual(10);
    for (const item of vectors.info) expect(parseHealthInfo(item.frame)).toEqual(item.expected);
  });

  it('uses the identifier, the version and the codes of the specification', () => {
    expect(CAN_ID_HEALTH_INFO).toBe(GENERATED_ID);
    expect(CAN_ID_HEALTH_INFO).toBe(0x1bb);
    expect(PROTOCOL_VERSION).toBe(FIRST_DECLARING_VERSION);
    expect(RATE_OF_CODE).toEqual({ [BUS_RATE_MBIT_1]: 1_000_000, [BUS_RATE_KBIT_500]: 500_000, [BUS_RATE_KBIT_250]: 250_000, [BUS_RATE_KBIT_125]: 125_000 });
    expect(RATE_OF_CODE[BUS_RATE_UNKNOWN]).toBeUndefined();
  });
});

describe('the declared speed', () => {
  const v2 = (rate: number, extra = 0) => [2, 8, 4, 4, 0, rate, extra >> 8, extra & 255];

  it('is read from a frame of version two and not from one of version one', () => {
    expect(parseHealthInfo(v2(1, 3600))?.rate_bps).toBe(1_000_000);
    expect(parseHealthInfo(v2(1, 3600))?.uptime_s).toBe(3600);
    expect(parseHealthInfo([1, 8, 4, 4, 0, 1, 14, 16])).toMatchObject({ rate_code: null, rate_bps: null, uptime_s: 0x010e10 });
    expect(parseHealthInfo(v2(77))?.rate_bps).toBeNull();
  });

  it('is not read from a payload that is not eight bytes', () => {
    for (const length of [0, 1, 7, 9]) expect(parseHealthInfo(new Array(length).fill(2))).toBeNull();
  });

  it('lists the declared speeds of a set of frames, skipping the heads that declare nothing', () => {
    const frames = [v2(1), [1, 0, 0, 0, 0, 2, 0, 0], [2], v2(0), v2(2)];
    expect(declaredRates(frames)).toEqual([1_000_000, 500_000]);
    expect(distinctRates([...frames, v2(2)])).toEqual([1_000_000, 500_000]);
  });

  it('is written with numbers and units only', () => {
    expect([1_000_000, 500_000, 250_000, 125_000, null, 0].map(rateText)).toEqual(['1 Mbit/s', '500 kbit/s', '250 kbit/s', '125 kbit/s', '', '']);
  });

  it('is picked from the frames that go by in a batch, apart from the health frames', () => {
    const frame = (id: number, data: number[]) => ({ id, data, direction: 'Rx' as const, simulated: false });
    const facts = summarizeBoardFrames([frame(0x1bb, v2(1)), frame(0x1b8, [0, 0, 0, 16, 7, 65, 12, 228]), frame(0x1bb, v2(2))]);
    expect(facts.infoFrames).toEqual([v2(1), v2(2)]);
    expect(facts.healthFrames).toEqual([[0, 0, 0, 16, 7, 65, 12, 228]]);
    expect(summarizeBoardFrames([{ ...frame(0x1bb, v2(1)), simulated: true }]).infoFrames).toBeUndefined();
  });
});
