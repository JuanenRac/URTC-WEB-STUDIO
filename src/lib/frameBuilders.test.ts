import { describe, expect, it } from 'vitest';
import {
  FEATURES_MAGIC, featuresWrite, motionMove, motionStop, spiPassthrough, statusLedCommand, thermalMotionCommand, weldFire,
} from './toolFrames';
import { dataChunkData, endUpdateData, hmacChunkData, startUpdateData } from './flashFrames';

describe('the frames of the global controls and of the optional panels', () => {
  it('writes the status LED, the OLED mode and the ring in eight bytes', () => {
    expect(statusLedCommand({ r: 0, g: 200, b: 255 }, 'standard', { r: 255, g: 255, b: 255 }, false)).toEqual([0, 200, 255, 0x00, 255, 255, 255, 0]);
    expect(statusLedCommand({ r: 1, g: 2, b: 3 }, 'night', { r: 4, g: 5, b: 6 }, true)).toEqual([1, 2, 3, 0x01, 4, 5, 6, 1]);
    expect(statusLedCommand({ r: 1, g: 2, b: 3 }, 'standby', { r: 4, g: 5, b: 6 }, true)[3]).toBe(0x0F);
  });
  it('keeps a colour inside its byte instead of wrapping it into another colour', () => {
    expect(statusLedCommand({ r: 300, g: -4, b: Number.NaN }, 'standard', { r: 255.4, g: 0, b: 0 }, false)).toEqual([255, 0, 0, 0, 255, 0, 0, 0]);
  });
  it('counts the bytes of an SPI passthrough and sends at most seven', () => {
    expect(spiPassthrough([1, 2, 3])).toEqual([3, 1, 2, 3]);
    expect(spiPassthrough([])).toEqual([0]);
    expect(spiPassthrough([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([7, 1, 2, 3, 4, 5, 6, 7]);
    expect(spiPassthrough([256, -1])).toEqual([2, 255, 0]);
  });
  it('writes the optional functions with the magic word and only the four known bits', () => {
    expect(FEATURES_MAGIC).toEqual([0x46, 0x45, 0x41, 0x54]);
    expect(featuresWrite(0b0101)).toEqual([0x46, 0x45, 0x41, 0x54, 5]);
    expect(featuresWrite(0xFF)).toEqual([0x46, 0x45, 0x41, 0x54, 0x0F]);
    expect(featuresWrite(-3)).toEqual([0x46, 0x45, 0x41, 0x54, 0]);
  });
});

describe('the frames of the printer head, the weld pulse and the stepper moves', () => {
  it('writes the nozzle set point, the direction and 24 bits of steps', () => {
    expect(thermalMotionCommand(200, true, 0)).toEqual([0, 200, 1, 0, 0, 0]);
    expect(thermalMotionCommand(0, false, 0x010203)).toEqual([0, 0, 0, 1, 2, 3]);
    expect(thermalMotionCommand(310, true, 0xFFFFFF + 5)).toEqual([1, 54, 1, 255, 255, 255]);
    expect(thermalMotionCommand(Number.NaN, true, -7)).toEqual([0, 0, 1, 0, 0, 0]);
  });
  it('holds a weld pulse between 1 ms and the longest the firmware accepts', () => {
    expect(weldFire(200, 2000)).toEqual([1, 0, 200]);
    expect(weldFire(5000, 2000)).toEqual([1, 0x07, 0xD0]);
    expect(weldFire(0, 2000)).toEqual([1, 0, 1]);
    expect(weldFire(Number.NaN, 2000)).toEqual([1, 0, 1]);
  });
  it('writes a move with its direction and refuses a step count that does not fit', () => {
    expect(motionMove(true, 1)).toEqual([1, 0, 0, 0, 1]);
    expect(motionMove(false, 0x01020304)).toEqual([0, 1, 2, 3, 4]);
    expect(() => motionMove(true, 0)).toThrow(RangeError);
    expect(motionStop(true)).toEqual([1, 0, 0, 0, 0]);
    expect(motionStop(false)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('the frames of a firmware update', () => {
  it('writes START_UPDATE with the size and the hardware identifier, big-endian', () => {
    expect(startUpdateData(0x0001C000, 0x0303CC01)).toEqual([0x00, 0x01, 0xC0, 0x00, 0x03, 0x03, 0xCC, 0x01]);
    expect(startUpdateData(0, 0x0303CB01)).toEqual([0, 0, 0, 0, 0x03, 0x03, 0xCB, 0x01]);
  });
  it('cuts the 32-byte signature in four frames of eight bytes', () => {
    const signature = Uint8Array.from({ length: 32 }, (_, i) => i);
    const chunks = [0, 1, 2, 3].map(i => hmacChunkData(signature, i));
    expect(chunks.map(c => c.length)).toEqual([8, 8, 8, 8]);
    expect(chunks.flat()).toEqual(Array.from(signature));
    expect(hmacChunkData(signature, 4)).toEqual([]);
    expect(hmacChunkData(new Uint8Array(0), 0)).toEqual([]);
  });
  it('cuts an image in frames of eight bytes and keeps the real length of the last one', () => {
    const image = Uint8Array.from({ length: 21 }, (_, i) => i + 1);
    expect(dataChunkData(image, 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(dataChunkData(image, 16)).toEqual([17, 18, 19, 20, 21]);
    expect(dataChunkData(image, 21)).toEqual([]);
    // a page ends where its data ends, even inside an image that goes on
    expect(dataChunkData(image, 4, 10)).toEqual([5, 6, 7, 8, 9, 10]);
    const all: number[] = [];
    for (let from = 0; from < image.length; from += 8) all.push(...dataChunkData(image, from));
    expect(all).toEqual(Array.from(image));
  });
  it('writes END_UPDATE with the CRC-32, the major number and the minor field', () => {
    expect(endUpdateData(0xDEADBEEF, 0, 3)).toEqual([0xDE, 0xAD, 0xBE, 0xEF, 0, 0, 0, 3]);
    expect(endUpdateData(0, 0x0102, 0x8005)).toEqual([0, 0, 0, 0, 1, 2, 0x80, 0x05]);
  });
});
