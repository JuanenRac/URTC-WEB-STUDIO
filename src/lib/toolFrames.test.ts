import { describe, expect, it } from 'vitest';
import {
  aoiRingCommand, be16, byte, drillCommand, drillStop, electromagnetCommand, hotAirCommand, hotAirOff, laserCommand, laserOff,
  pasteJettingConfig, pasteJettingPulse, powerByte, powerOff, solderOff, solderSetpoint,
} from './toolFrames';

describe('byte and be16', () => {
  it('round and keep the value inside the field', () => {
    expect(byte(12.4)).toBe(12);
    expect(byte(12.5)).toBe(13);
    expect(byte(300)).toBe(255);
    expect(byte(-5)).toBe(0);
    expect(byte(Number.NaN)).toBe(0);
    expect(byte(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('write two bytes, high byte first', () => {
    expect(be16(0)).toEqual([0, 0]);
    expect(be16(0x1234)).toEqual([0x12, 0x34]);
    expect(be16(350)).toEqual([0x01, 0x5E]);
    expect(be16(70000)).toEqual([0xFF, 0xFF]);
    expect(be16(-1)).toEqual([0, 0]);
    expect(be16(Number.NaN)).toEqual([0, 0]);
  });
});

describe('the payloads of the tool panels', () => {
  it('soldering iron', () => {
    expect(solderSetpoint(320)).toEqual([0x01, 0x40]);
    expect(solderOff()).toEqual([0, 0]);
  });

  it('drill: speed and direction, stop is two zeros', () => {
    expect(drillCommand(200, 'cw')).toEqual([200, 0]);
    expect(drillCommand(200, 'ccw')).toEqual([200, 1]);
    expect(drillCommand(999, 'cw')).toEqual([255, 0]);
    expect(drillStop()).toEqual([0, 0]);
  });

  it('inspection ring: mode then the period, big-endian', () => {
    expect(aoiRingCommand(2, 500)).toEqual([2, 0x01, 0xF4]);
  });

  it('laser: power then the interlock flag', () => {
    expect(laserCommand(50, true)).toEqual([50, 1]);
    expect(laserCommand(50, false)).toEqual([50, 0]);
    expect(laserOff()).toEqual([0, 0]);
  });

  it('fans and the UV lamp take one byte', () => {
    expect(powerByte(77)).toEqual([77]);
    expect(powerByte(1000)).toEqual([255]);
    expect(powerOff()).toEqual([0]);
  });

  it('electromagnet', () => {
    expect(electromagnetCommand(true)).toEqual([1]);
    expect(electromagnetCommand(false)).toEqual([0]);
  });

  it('hot air: set point then blower', () => {
    expect(hotAirCommand(350, 40)).toEqual([0x01, 0x5E, 40]);
    expect(hotAirOff()).toEqual([0, 0, 0]);
  });

  it('paste jetting: configuration and pulse', () => {
    expect(pasteJettingConfig(3, 150)).toEqual([3, 0, 150]);
    expect(pasteJettingConfig(1, 1000)).toEqual([1, 0x03, 0xE8]);
    expect(pasteJettingPulse(2, 80, 12)).toEqual([2, 80, 12]);
  });

  it('every payload fits a CAN frame and holds only bytes', () => {
    const all = [solderSetpoint(445), solderOff(), drillCommand(255, 'ccw'), drillStop(), aoiRingCommand(255, 65535), laserCommand(255, true), laserOff(),
      powerByte(255), powerOff(), electromagnetCommand(true), hotAirCommand(445, 255), hotAirOff(), pasteJettingConfig(255, 65535), pasteJettingPulse(255, 255, 255)];
    for (const payload of all) {
      expect(payload.length).toBeLessThanOrEqual(8);
      for (const value of payload) {
        expect(Number.isInteger(value) && value >= 0 && value <= 255).toBe(true);
      }
    }
  });
});
