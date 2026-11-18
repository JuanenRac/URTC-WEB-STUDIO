import { describe, expect, it } from 'vitest';
import { FEATURES_QUERY_EXTENDED, FEATURE_COMMS_WATCHDOG, FEATURE_EXT_ALLOW_UPDATE_ACTIVE_ACTUATOR, FEATURE_EXT_WATCHDOG_HOST_ONLY, featuresWriteFor, parseFeaturesAnswer } from './featuresMap';
import { FEATURES_MAGIC, featuresWrite } from './toolFrames';

describe('the second byte of the map of optional functions', () => {
  it('asks for the six-byte answer with the single byte 02', () => {
    expect(FEATURES_QUERY_EXTENDED).toEqual([0x02]);
  });

  it('reads the answer of a head that knows the second byte', () => {
    expect(parseFeaturesAnswer([0x20, 0x00, 0xFF, 0x01, 0x00, 0x01])).toEqual({
      stored: 0x20, running: 0, supported: 0xFF, storedExt: 1, runningExt: 0, supportedExt: 1, extended: true,
    });
  });

  it('reads the three-byte answer of an older head as a head without a second byte', () => {
    const answer = parseFeaturesAnswer([0x0A, 0x02, 0xFF]);
    expect(answer).toMatchObject({ stored: 0x0A, running: 0x02, supported: 0xFF, storedExt: 0, supportedExt: 0, extended: false });
  });

  it('refuses any other length', () => {
    for (const length of [0, 1, 2, 4, 5, 7, 8]) expect(parseFeaturesAnswer(new Array(length).fill(0))).toBeNull();
    expect(parseFeaturesAnswer(undefined)).toBeNull();
    expect(parseFeaturesAnswer(null)).toBeNull();
  });

  it('writes the five-byte form to a head without a second byte, so an older head keeps working', () => {
    expect(featuresWriteFor(0x20, FEATURE_EXT_WATCHDOG_HOST_ONLY, 0)).toEqual(featuresWrite(0x20));
    expect(featuresWriteFor(0x20, 1, 0)).toEqual([...FEATURES_MAGIC, 0x20]);
  });

  it('writes the six-byte form to a head that has one', () => {
    expect(featuresWriteFor(0x20, 1, 1)).toEqual([0x46, 0x45, 0x41, 0x54, 0x20, 0x01]);
    expect(featuresWriteFor(0x00, 0, 1)).toEqual([0x46, 0x45, 0x41, 0x54, 0x00, 0x00]);
  });

  it('keeps the host-only switch off unless the communication watchdog is on', () => {
    expect(featuresWriteFor(0x00, 1, 1)[5]).toBe(0);
    expect(featuresWriteFor(0x10, 1, 1)[5]).toBe(0);
    expect(featuresWriteFor(FEATURE_COMMS_WATCHDOG, 1, 1)[5]).toBe(1);
  });

  it('never sends a switch the head did not say it has', () => {
    expect(featuresWriteFor(FEATURE_COMMS_WATCHDOG, 0xFF, 1)[5]).toBe(1);
  });
});

describe('the switch for the end of a slave update while a tool is active', () => {
  it('is the bit 0x02 of the second byte and is off in a frame that does not ask for it', () => {
    expect(FEATURE_EXT_ALLOW_UPDATE_ACTIVE_ACTUATOR).toBe(0x02);
    expect(featuresWriteFor(0x00, 0, 3)[5]).toBe(0);
    expect(featuresWriteFor(FEATURE_COMMS_WATCHDOG, 0, 3)[5]).toBe(0);
  });

  it('does not depend on the communication watchdog, unlike the host-only switch', () => {
    expect(featuresWriteFor(0x00, 0x02, 3)[5]).toBe(0x02);
    expect(featuresWriteFor(0x00, 0x03, 3)[5]).toBe(0x02);
    expect(featuresWriteFor(FEATURE_COMMS_WATCHDOG, 0x03, 3)[5]).toBe(0x03);
  });

  it('is never sent to a head that did not say it has it', () => {
    expect(featuresWriteFor(0x00, 0x02, 1)[5]).toBe(0);
    expect(featuresWriteFor(0x00, 0x02, 0)).toEqual([...FEATURES_MAGIC, 0x00]);
  });
});
