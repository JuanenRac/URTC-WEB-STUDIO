import type { Page } from '@playwright/test';
import {
  CAN_ID_ACTIVE_TOOL_RESP, CAN_ID_DATA, CAN_ID_END_UPDATE, CAN_ID_ENTER_BOOTLOADER, CAN_ID_HMAC_CHUNK, CAN_ID_PAGE_ACK, CAN_ID_QUERY_ACTIVE_TOOL,
  CAN_ID_QUERY_VERSION, CAN_ID_START_UPDATE, CAN_ID_STATUS, CAN_ID_THERMAL_STATS_QUERY, CAN_ID_THERMAL_STATS_RESP, CAN_ID_VERSION_RESPONSE,
  FLASH_PAGE_SIZE, encodeThermalStatsResp,
} from '../../src/lib/generated/urtcCanIds';

// A USB-CAN adapter with a board behind it, as far as the Studio can tell: the page asks `navigator.serial` for a port, opens it, speaks
// SLCAN lines to it and reads lines back. The model answers the version query (so the bitrate probe succeeds), the active tool query and
// the thermal counters query, with the readings the test hands it one after the other, and it can play the bootloader of the main board
// for a CAN-OTA update (listening, erasing, receiving, a page acknowledged each time a page is full, done at END_UPDATE). Nothing here
// touches a real device.

export interface ThermalReading {
  faults: number;
  heaterOnSeconds: number;
  lastFault: number;
  persisted: boolean;
}

export interface FakeBoardOptions {
  readings?: ThermalReading[];
  /** Play the bootloader of the main board: the flasher can run an update against it. */
  bootloader?: boolean;
  /** Final status of an update: 0x04 done (default) or 0x05 verification failed. */
  finalStatus?: number;
}

interface BoardScript {
  versionQuery: number;
  versionResponse: number;
  toolQuery: number;
  toolResponse: number;
  thermalQuery: number;
  thermalResponse: number;
  /** 8-byte payloads of 0x1AB, one per question, the last one repeated. */
  thermalPayloads: number[][];
  /** Hardware id the version answer carries (bytes 1 to 4). */
  hardwareId: number;
  bootloader: boolean;
  finalStatus: number;
  enterBootloader: number;
  startUpdate: number;
  hmacChunk: number;
  data: number;
  endUpdate: number;
  status: number;
  pageAck: number;
  pageSize: number;
}

export async function installFakeBoard(page: Page, options: FakeBoardOptions | ThermalReading[] = {}): Promise<void> {
  const settings: FakeBoardOptions = Array.isArray(options) ? { readings: options } : options;
  const script: BoardScript = {
    versionQuery: CAN_ID_QUERY_VERSION,
    versionResponse: CAN_ID_VERSION_RESPONSE,
    toolQuery: CAN_ID_QUERY_ACTIVE_TOOL,
    toolResponse: CAN_ID_ACTIVE_TOOL_RESP,
    thermalQuery: CAN_ID_THERMAL_STATS_QUERY,
    thermalResponse: CAN_ID_THERMAL_STATS_RESP,
    thermalPayloads: (settings.readings ?? []).map((r) => encodeThermalStatsResp(r.faults, r.heaterOnSeconds, r.lastFault, r.persisted ? 1 : 0).data),
    hardwareId: 0x55525443, // "URTC"
    bootloader: settings.bootloader ?? false,
    finalStatus: settings.finalStatus ?? 0x04,
    enterBootloader: CAN_ID_ENTER_BOOTLOADER,
    startUpdate: CAN_ID_START_UPDATE,
    hmacChunk: CAN_ID_HMAC_CHUNK,
    data: CAN_ID_DATA,
    endUpdate: CAN_ID_END_UPDATE,
    status: CAN_ID_STATUS,
    pageAck: CAN_ID_PAGE_ACK,
    pageSize: FLASH_PAGE_SIZE,
  };
  await page.addInitScript((board: BoardScript) => {
    const hex = (n: number, width: number) => n.toString(16).toUpperCase().padStart(width, '0');
    const line = (id: number, data: number[]) => `t${hex(id, 3)}${data.length}${data.map((b) => hex(b, 2)).join('')}\r`;
    let answered = 0;
    let push: (text: string) => void = () => {};
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({ start(controller) { push = (text) => { try { controller.enqueue(encoder.encode(text)); } catch { /* the reader is gone */ } }; } });
    // what the bootloader has been told in the update that is running
    const update = { announced: 0, received: 0, pages: 0, hmacChunks: 0 };
    const answer = (command: string) => {
      const match = /^t([0-9A-F]{3})([0-8])([0-9A-F]*)$/i.exec(command);
      if (!match) return;
      const id = parseInt(match[1], 16);
      const bytes = (match[3].match(/../g) ?? []).map((h) => parseInt(h, 16));
      if (id === board.versionQuery) {
        const h = board.hardwareId;
        push(line(board.versionResponse, [0, (h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff, 0, 0, 0]));
      } else if (id === board.toolQuery) {
        push(line(board.toolResponse, [1, 0, 0, 0]));
      } else if (id === board.thermalQuery && board.thermalPayloads.length > 0) {
        push(line(board.thermalResponse, board.thermalPayloads[Math.min(answered, board.thermalPayloads.length - 1)]));
        answered++;
      } else if (board.bootloader && id === board.enterBootloader) {
        update.announced = 0; update.received = 0; update.pages = 0; update.hmacChunks = 0;
        push(line(board.status, [0x01])); // LISTENING
      } else if (board.bootloader && id === board.startUpdate) {
        update.announced = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
        update.received = 0; update.pages = 0; update.hmacChunks = 0;
        push(line(board.status, [0x02])); // ERASING
        setTimeout(() => push(line(board.status, [0x03])), 50); // RECEIVING
      } else if (board.bootloader && id === board.hmacChunk) {
        update.hmacChunks++;
      } else if (board.bootloader && id === board.data) {
        update.received += bytes.length;
        // a page is written and acknowledged when its buffer is full; the last, partial page waits for END_UPDATE
        while (update.received >= (update.pages + 1) * board.pageSize) {
          push(line(board.pageAck, [(update.pages >>> 24) & 0xff, (update.pages >>> 16) & 0xff, (update.pages >>> 8) & 0xff, update.pages & 0xff]));
          update.pages++;
        }
      } else if (board.bootloader && id === board.endUpdate) {
        const complete = update.received === update.announced && update.hmacChunks === 4;
        push(line(board.status, complete ? [board.finalStatus] : [0x05, 0x01]));
      }
    };
    let pending = '';
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        pending += new TextDecoder().decode(chunk);
        const parts = pending.split('\r');
        pending = parts.pop() ?? '';
        for (const command of parts) answer(command);
      },
    });
    const port = { readable, writable, open: async () => {}, close: async () => {}, getInfo: () => ({}) };
    const serial = { requestPort: async () => port, addEventListener: () => {}, removeEventListener: () => {} };
    Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
  }, script);
}
