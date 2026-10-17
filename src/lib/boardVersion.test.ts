import { describe, expect, it } from "vitest";
import { CanFrame } from "../types";
import { VersionBus, installedVersion, queryMainVersion, querySlaveVersion } from "./boardVersion";

// A bus that answers from a script: the frames the board "sends" after each query.
function frame(id: number, data: number[]): CanFrame {
  return { id, idHex: "0x" + id.toString(16), dlc: data.length, data, dataHex: "", timestamp: "", direction: "Rx", description: "", seq: 0 };
}

function fakeBus(script: Record<number, number[]>, requestAnswers: Record<number, number[] | null>): VersionBus {
  return {
    async request(_id, _data, respId) {
      const answer = requestAnswers[respId];
      return answer ? frame(respId, answer) : null;
    },
    async waitForFrame(id) {
      return script[id] ? frame(id, script[id]) : null;
    },
    flushFrames() {},
  };
}

const APP_7F9 = [0x00, 0x03, 0x03, 0xcc, 0x01, 0x00, 0x00, 0x03]; // application 0.3, HardwareID 0x0303CC01
const BOOT_7F9 = [0x01, 0x03, 0x03, 0xcc, 0x01, 0x00, 0x00, 0x03];

describe("main board version", () => {
  it("reads major.minor.patch from 0x7F9 and 0x7E9", async () => {
    const info = await queryMainVersion(fakeBus({ 0x7e9: [0x00, 5, 0x00] }, { 0x7f9: APP_7F9 }));
    expect(info).toMatchObject({ responder: "application", hardwareId: 0x0303cc01, appMajor: 0, appMinor: 3, appPatch: 5, patchAware: true, acceptsPatchInEndUpdate: false });
    expect(installedVersion(info!)).toEqual({ major: 0, minor: 3, patch: 5 });
  });

  it("keeps working with a board that predates the patch (no 0x7E9)", async () => {
    const info = await queryMainVersion(fakeBus({}, { 0x7f9: APP_7F9 }));
    expect(info).toMatchObject({ appMajor: 0, appMinor: 3, patchAware: false, acceptsPatchInEndUpdate: false });
    expect(info?.appPatch).toBeUndefined();
    expect(installedVersion(info!)).toEqual({ major: 0, minor: 3 });
  });

  it("reports an unknown patch (0xFF) as no patch, but the board as patch-aware", async () => {
    const info = await queryMainVersion(fakeBus({ 0x7e9: [0x00, 0xff, 0x00] }, { 0x7f9: APP_7F9 }));
    expect(info?.patchAware).toBe(true);
    expect(info?.appPatch).toBeUndefined();
  });

  it("reads the bootloader version and the flag that lets the patch go into END_UPDATE", async () => {
    const info = await queryMainVersion(fakeBus({ 0x7fa: [0, 3, 8], 0x7e9: [0x01, 5, 0x01] }, { 0x7f9: BOOT_7F9 }));
    expect(info).toMatchObject({ responder: "bootloader", bootMajor: 0, bootMinor: 3, bootPatch: 8, appPatch: 5, acceptsPatchInEndUpdate: true });
  });

  it("ignores extra bytes of 0x7E9 and a 0x7E9 that is too short", async () => {
    const long = await queryMainVersion(fakeBus({ 0x7e9: [0x00, 4, 0x01, 9, 9] }, { 0x7f9: BOOT_7F9 }));
    expect(long).toMatchObject({ appPatch: 4, acceptsPatchInEndUpdate: true });
    const short = await queryMainVersion(fakeBus({ 0x7e9: [0x00, 4] }, { 0x7f9: APP_7F9 }));
    expect(short?.patchAware).toBe(false);
  });

  it("does not take 0x7FA into account when the application answers", async () => {
    const info = await queryMainVersion(fakeBus({ 0x7fa: [0, 3, 8] }, { 0x7f9: APP_7F9 }));
    expect(info?.bootMajor).toBeUndefined();
  });

  it("is null when nothing, or a short frame, answers", async () => {
    expect(await queryMainVersion(fakeBus({}, { 0x7f9: null }))).toBeNull();
    expect(await queryMainVersion(fakeBus({}, { 0x7f9: [0, 1, 2] }))).toBeNull();
  });
});

describe("expansion slave version", () => {
  const FIRST = [0x01, 0x03, 0x03, 0xcb, 0x01, 0x00, 0x00, 0x00]; // HardwareID 0x0303CB01, major 0

  it("reads the legacy two-byte 0x218 with no patch", async () => {
    const info = await querySlaveVersion(fakeBus({ 0x218: [1, 2] }, { 0x217: FIRST }));
    expect(info).toMatchObject({ hardwareId: 0x0303cb01, appMajor: 0, appMinor: 1, bootMajor: 2, patchAware: false, acceptsPatchInEndUpdate: false });
    expect(info?.appPatch).toBeUndefined();
    expect(info?.bootMinor).toBeUndefined();
  });

  it("reads the five-byte 0x218: application patch, bootloader minor and patch", async () => {
    const info = await querySlaveVersion(fakeBus({ 0x218: [1, 0, 9, 3, 4] }, { 0x217: FIRST }));
    expect(info).toMatchObject({ appMinor: 1, appPatch: 9, bootMajor: 0, bootMinor: 3, bootPatch: 4, patchAware: true, acceptsPatchInEndUpdate: true });
    expect(installedVersion(info!)).toEqual({ major: 0, minor: 1, patch: 9 });
  });

  it("takes an unknown application patch (0xFF) as none", async () => {
    const info = await querySlaveVersion(fakeBus({ 0x218: [1, 0, 0xff, 3, 4] }, { 0x217: FIRST }));
    expect(info?.appPatch).toBeUndefined();
    expect(info?.patchAware).toBe(true);
  });

  it("answers with what it has when 0x218 does not come, and is null without 0x217", async () => {
    expect((await querySlaveVersion(fakeBus({}, { 0x217: FIRST })))?.appMajor).toBe(0);
    expect(await querySlaveVersion(fakeBus({}, { 0x217: null }))).toBeNull();
  });
});
