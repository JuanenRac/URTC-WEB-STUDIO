import type { Page } from '@playwright/test';
import {
  CAN_ID_ACTIVE_TOOL_RESP, CAN_ID_QUERY_ACTIVE_TOOL, CAN_ID_QUERY_VERSION, CAN_ID_THERMAL_STATS_QUERY, CAN_ID_THERMAL_STATS_RESP, CAN_ID_VERSION_RESPONSE,
  encodeThermalStatsResp,
} from '../../src/lib/generated/urtcCanIds';

// A USB-CAN adapter with a board behind it, as far as the Studio can tell: the page asks `navigator.serial` for a port, opens it, speaks
// SLCAN lines to it and reads lines back. The model answers the version query (so the bitrate probe succeeds), the active tool query and
// the thermal counters query, with the readings the test hands it one after the other. Nothing here touches a real device.

export interface ThermalReading {
  faults: number;
  heaterOnSeconds: number;
  lastFault: number;
  persisted: boolean;
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
}

export async function installFakeBoard(page: Page, readings: ThermalReading[] = []): Promise<void> {
  const script: BoardScript = {
    versionQuery: CAN_ID_QUERY_VERSION,
    versionResponse: CAN_ID_VERSION_RESPONSE,
    toolQuery: CAN_ID_QUERY_ACTIVE_TOOL,
    toolResponse: CAN_ID_ACTIVE_TOOL_RESP,
    thermalQuery: CAN_ID_THERMAL_STATS_QUERY,
    thermalResponse: CAN_ID_THERMAL_STATS_RESP,
    thermalPayloads: readings.map((r) => encodeThermalStatsResp(r.faults, r.heaterOnSeconds, r.lastFault, r.persisted ? 1 : 0).data),
    hardwareId: 0x55525443, // "URTC"
  };
  await page.addInitScript((board: BoardScript) => {
    const hex = (n: number, width: number) => n.toString(16).toUpperCase().padStart(width, '0');
    const line = (id: number, data: number[]) => `t${hex(id, 3)}${data.length}${data.map((b) => hex(b, 2)).join('')}\r`;
    let answered = 0;
    let push: (text: string) => void = () => {};
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({ start(controller) { push = (text) => controller.enqueue(encoder.encode(text)); } });
    const answer = (command: string) => {
      const match = /^t([0-9A-F]{3})([0-8])([0-9A-F]*)$/i.exec(command);
      if (!match) return;
      const id = parseInt(match[1], 16);
      if (id === board.versionQuery) {
        const h = board.hardwareId;
        push(line(board.versionResponse, [0, (h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff, 0, 0, 0]));
      } else if (id === board.toolQuery) {
        push(line(board.toolResponse, [1, 0, 0, 0]));
      } else if (id === board.thermalQuery && board.thermalPayloads.length > 0) {
        push(line(board.thermalResponse, board.thermalPayloads[Math.min(answered, board.thermalPayloads.length - 1)]));
        answered++;
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
