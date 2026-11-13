import { CanFrame } from '../types';
import { decodeQuickState } from './quickState';
import { CAN_ID_ACTIVE_TOOL_RESP, CAN_ID_SOLDER_TELEMETRY } from './canIds';
import { CAN_ID_HEALTH_PROFILE } from './busHealth';
import { CAN_ID_HEALTH_INFO } from './healthInfo';

// What the real board has said, taken from frames that really arrived. Only
// frames received from the bus count: a frame this app sent itself, or one the
// simulator made up, says nothing about the board.

export interface BoardStatus {
  /** Tool the board itself reports (0x111), or null until it has answered. */
  toolId: number | null;
  systemError: boolean;
  errorMessage: string;
  /** Why the thermal runaway guard cut the heater (1 to 3), or null when the board does not say. */
  thermalFault: number | null;
}

export const NO_BOARD_STATUS: BoardStatus = { toolId: null, systemError: false, errorMessage: '', thermalFault: null };

export interface BoardFacts {
  status?: BoardStatus;
  /** Heater temperature from 0x135, in degrees C. */
  heaterTemp?: number;
  /** The payloads of the health frames (0x1B8) of the heads that were heard in the batch; the judgement of the bus (lib/busHealth.ts) is made from them. */
  healthFrames?: number[][];
  /** The payloads of the identity frames (0x1BB) in the batch: the heads of protocol version 2 declare the speed of their bus in them (lib/healthInfo.ts). */
  infoFrames?: number[][];
}

const isFromBoard = (f: Pick<CanFrame, 'direction' | 'simulated'>) => f.direction === 'Rx' && !f.simulated;

/** The latest facts in a batch of frames (oldest first). */
export function summarizeBoardFrames(frames: Array<Pick<CanFrame, 'id' | 'data' | 'direction' | 'simulated'>>): BoardFacts {
  const facts: BoardFacts = {};
  for (const f of frames) {
    if (!isFromBoard(f)) continue;
    if (f.id === CAN_ID_ACTIVE_TOOL_RESP && f.data.length >= 4) {
      const quick = decodeQuickState(f.data);
      facts.status = { toolId: f.data[0] & 0x1f, systemError: quick.systemError, errorMessage: quick.errorMessage, thermalFault: quick.thermalFault || null };
    } else if (f.id === CAN_ID_SOLDER_TELEMETRY && f.data.length >= 2) {
      facts.heaterTemp = (f.data[0] << 8) | f.data[1];
    } else if (f.id === CAN_ID_HEALTH_PROFILE) {
      (facts.healthFrames ??= []).push([...f.data]);
    } else if (f.id === CAN_ID_HEALTH_INFO) {
      (facts.infoFrames ??= []).push([...f.data]);
    }
  }
  return facts;
}

/** The sandbox tool whose live reading a heater temperature belongs to: the hot air station if that is the tool, the soldering iron otherwise. */
export function heaterToolId(boardToolId: number | null): number {
  return boardToolId === 19 ? 19 : 0;
}
