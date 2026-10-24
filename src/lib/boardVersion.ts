import { CanFrame } from '../types';
import { CAN_ID_SLAVE_REG_READ, CAN_ID_SLAVE_APP_PATCH, decodeSlaveAppPatch, encodeSlaveRegReadRequest } from './generated/urtcCanIds';
import {
  CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE, CAN_ID_BOOTLOADER_VERSION_RESPONSE, CAN_ID_VERSION_PATCH_RESPONSE,
  CAN_ID_SLAVE_VERSION_RESP_1, CAN_ID_SLAVE_VERSION_RESP_2, PATCH_GRACE_MS, PATCH_UNKNOWN,
  FirmwareVersion, parsePatchFrame,
} from './flasher';

// What the board says about itself, read the way CANBUS.TXT describes
// ("FIRMWARE PATCH NUMBER"): 0x7F9 / 0x7FA as always, plus the optional 0x7E9
// companion for the patch. A board that predates the patch never sends 0x7E9: it
// is then reported with no patch (patchAware false) and everything keeps working
// with the two-component version. No React and no serial port here, so the rules
// are tested with a fake bus.

/** The part of the CAN bus the version queries need. */
export interface VersionBus {
  request(id: number, data: number[], respId: number, timeoutMs?: number, description?: string): Promise<CanFrame | null>;
  waitForFrame(id: number, timeoutMs?: number): Promise<CanFrame | null>;
  flushFrames(id?: number): void;
}

export interface BoardVersionInfo {
  responder: 'application' | 'bootloader';
  hardwareId: number;
  appMajor: number;
  appMinor: number;
  /** Patch of the installed application; undefined when the board did not report one (old board, or 0xFF). */
  appPatch?: number;
  /** True when the board sent 0x7E9, i.e. it knows the patch extension. */
  patchAware: boolean;
  /** The bootloader that answered reads the patch from the minor field of END_UPDATE. */
  acceptsPatchInEndUpdate: boolean;
  bootMajor?: number;
  bootMinor?: number;
  bootPatch?: number;
}

export interface SlaveVersionInfo {
  hardwareId: number;
  appMajor: number;
  appMinor: number;
  appPatch?: number;
  bootMajor?: number;
  bootMinor?: number;
  bootPatch?: number;
  /** The slave answered with the extended DLC 5 form of 0x218. */
  patchAware: boolean;
  acceptsPatchInEndUpdate: boolean;
}

export function installedVersion(info: { appMajor: number; appMinor: number; appPatch?: number }): FirmwareVersion {
  return info.appPatch === undefined
    ? { major: info.appMajor, minor: info.appMinor }
    : { major: info.appMajor, minor: info.appMinor, patch: info.appPatch };
}

/** 0x7F8 -> 0x7F9, then 0x7FA (bootloader) and 0x7E9 (patch) within a short grace window. Null when nothing answered. */
export async function queryMainVersion(bus: VersionBus): Promise<BoardVersionInfo | null> {
  bus.flushFrames(CAN_ID_BOOTLOADER_VERSION_RESPONSE);
  bus.flushFrames(CAN_ID_VERSION_PATCH_RESPONSE);
  const resp = await bus.request(CAN_ID_QUERY_VERSION, [0x00], CAN_ID_VERSION_RESPONSE, 1500, 'Query board version');
  if (!resp || resp.data.length < 8) return null;
  const responder: BoardVersionInfo['responder'] = resp.data[0] === 0x00 ? 'application' : 'bootloader';
  const info: BoardVersionInfo = {
    responder,
    hardwareId: ((resp.data[1] << 24) | (resp.data[2] << 16) | (resp.data[3] << 8) | resp.data[4]) >>> 0,
    appMajor: (resp.data[5] << 8) | resp.data[6],
    appMinor: resp.data[7],
    patchAware: false,
    acceptsPatchInEndUpdate: false,
  };

  // The order of the companion frames is not guaranteed and a board without the extension never sends 0x7E9: wait for both together, for at most the grace window.
  const [bootResp, patchResp] = await Promise.all([
    responder === 'bootloader' ? bus.waitForFrame(CAN_ID_BOOTLOADER_VERSION_RESPONSE, PATCH_GRACE_MS) : Promise.resolve(null),
    bus.waitForFrame(CAN_ID_VERSION_PATCH_RESPONSE, PATCH_GRACE_MS),
  ]);
  if (bootResp && bootResp.data.length >= 3) {
    info.bootMajor = bootResp.data[0];
    info.bootMinor = bootResp.data[1];
    info.bootPatch = bootResp.data[2];
  }
  const patch = patchResp ? parsePatchFrame(patchResp.data) : null;
  if (patch) {
    info.patchAware = true;
    info.appPatch = patch.patch;
    info.acceptsPatchInEndUpdate = patch.acceptsPatchInEndUpdate;
  }
  return info;
}

/**
 * Expansion slave: 0x217 (8 bytes) answered together with 0x218. The minor is the low byte carried by 0x218; with the
 * extended form (DLC 5) 0x218 also carries the application patch and the slave bootloader's minor and patch.
 */
export async function querySlaveVersion(bus: VersionBus): Promise<SlaveVersionInfo | null> {
  bus.flushFrames(CAN_ID_SLAVE_VERSION_RESP_2);
  const first = await bus.request(CAN_ID_SLAVE_VERSION_RESP_1, [], CAN_ID_SLAVE_VERSION_RESP_1, 1500, 'Slave: query version');
  if (!first || first.data.length < 8) return null;
  const second = await bus.waitForFrame(CAN_ID_SLAVE_VERSION_RESP_2, PATCH_GRACE_MS * 2);
  const info: SlaveVersionInfo = {
    hardwareId: ((first.data[1] << 24) | (first.data[2] << 16) | (first.data[3] << 8) | first.data[4]) >>> 0,
    appMajor: (first.data[5] << 8) | first.data[6],
    // without 0x218 only the high byte of the minor is known
    appMinor: second && second.data.length >= 1 ? second.data[0] : first.data[7],
    patchAware: false,
    acceptsPatchInEndUpdate: false,
  };
  if (second && second.data.length >= 2) info.bootMajor = second.data[1];
  if (second && second.data.length >= 5) {
    info.patchAware = true;
    info.acceptsPatchInEndUpdate = true;
    info.appPatch = second.data[2] === PATCH_UNKNOWN ? undefined : second.data[2];
    info.bootMinor = second.data[3];
    info.bootPatch = second.data[4];
  }
  return info;
}

/** The application of the expansion slave as the master relays it: 0x221 for register 0x01, then the 0x222 companion with the patch. */
export interface SlaveAppVersionInfo {
  responder: 'application' | 'bootloader';
  hardwareId: string;
  major: number;
  /** null: the answer of 8 bytes stops at the high byte of the minor field, so the minor number is not in it; a longer answer carries it. */
  minor: number | null;
  minorHigh: number;
  /** undefined when the slave sends none: a slave application from before the field sends no 0x222. */
  patch?: number;
  patchAware: boolean;
}

const SLAVE_APP_VERSION_REGISTER = 0x01;
const SLAVE_APP_PATCH_MAX = 127;

/** Joins the frames that answer one read of the version register of the slave application into one description; null when there is no answer. */
export function parseSlaveAppVersion(frames: Array<{ id: number; data: number[] }>): SlaveAppVersionInfo | null {
  let answer: number[] | null = null;
  let patch: number | undefined;
  for (const frame of frames) {
    if (frame.id === CAN_ID_SLAVE_REG_READ && frame.data.length >= 8 && answer === null) {
      answer = frame.data;
    } else if (frame.id === CAN_ID_SLAVE_APP_PATCH && patch === undefined) {
      const fields = decodeSlaveAppPatch(frame.data);
      if (fields && fields.register === SLAVE_APP_VERSION_REGISTER && Number(fields.patch) >= 1 && Number(fields.patch) <= SLAVE_APP_PATCH_MAX) patch = Number(fields.patch);
    }
  }
  if (answer === null) return null;
  const hardwareId = ((answer[1] << 24) | (answer[2] << 16) | (answer[3] << 8) | answer[4]) >>> 0;
  return {
    responder: answer[0] === 0x01 ? 'bootloader' : 'application',
    hardwareId: `0x${hardwareId.toString(16).toUpperCase().padStart(8, '0')}`,
    major: (answer[5] << 8) | answer[6],
    minor: answer.length >= 9 ? (answer[7] << 8) | answer[8] : null,
    minorHigh: answer[7],
    patch,
    patchAware: patch !== undefined,
  };
}

/** major.minor.patch with a ? for what the frames did not carry (the minor of a slave seen through the master). */
export function slaveAppVersionText(info: SlaveAppVersionInfo | null): string {
  if (info === null) return '?';
  return `${info.major}.${info.minor === null ? '?' : info.minor}${info.patch !== undefined ? `.${info.patch}` : ''}`;
}

/** Asks the master for the version register of the slave application (0x221, 8 of its 10 bytes) and waits a moment for the 0x222 companion. */
export async function querySlaveApplicationVersion(bus: VersionBus): Promise<SlaveAppVersionInfo | null> {
  bus.flushFrames(CAN_ID_SLAVE_APP_PATCH);
  const request = encodeSlaveRegReadRequest(SLAVE_APP_VERSION_REGISTER, 8);
  const answer = await bus.request(request.id, request.data, CAN_ID_SLAVE_REG_READ, 1500, 'Slave application: query version');
  if (!answer || answer.data.length < 8) return null;
  const companion = await bus.waitForFrame(CAN_ID_SLAVE_APP_PATCH, PATCH_GRACE_MS * 2);
  return parseSlaveAppVersion([{ id: answer.id, data: answer.data }, ...(companion ? [{ id: companion.id, data: companion.data }] : [])]);
}
