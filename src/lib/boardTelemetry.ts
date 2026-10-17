import { CanFrame } from '../types';
import { decodeQuickState } from './quickState';
import { CAN_ID_ACTIVE_TOOL_RESP, CAN_ID_SOLDER_TELEMETRY } from './canIds';

// What the real board has said, taken from frames that really arrived. Only
// frames received from the bus count: a frame this app sent itself, or one the
// simulator made up, says nothing about the board.

export interface BoardStatus {
  /** Tool the board itself reports (0x111), or null until it has answered. */
  toolId: number | null;
  systemError: boolean;
  errorMessage: string;
}

export const NO_BOARD_STATUS: BoardStatus = { toolId: null, systemError: false, errorMessage: '' };

export interface BoardFacts {
  status?: BoardStatus;
  /** Heater temperature from 0x135, in degrees C. */
  heaterTemp?: number;
}

const isFromBoard = (f: Pick<CanFrame, 'direction' | 'simulated'>) => f.direction === 'Rx' && !f.simulated;

/** The latest facts in a batch of frames (oldest first). */
export function summarizeBoardFrames(frames: Array<Pick<CanFrame, 'id' | 'data' | 'direction' | 'simulated'>>): BoardFacts {
  const facts: BoardFacts = {};
  for (const f of frames) {
    if (!isFromBoard(f)) continue;
    if (f.id === CAN_ID_ACTIVE_TOOL_RESP && f.data.length >= 4) {
      const quick = decodeQuickState(f.data);
      facts.status = { toolId: f.data[0] & 0x1f, systemError: quick.systemError, errorMessage: quick.errorMessage };
    } else if (f.id === CAN_ID_SOLDER_TELEMETRY && f.data.length >= 2) {
      facts.heaterTemp = (f.data[0] << 8) | f.data[1];
    }
  }
  return facts;
}

/** The sandbox tool whose live reading a heater temperature belongs to: the hot air station if that is the tool, the soldering iron otherwise. */
export function heaterToolId(boardToolId: number | null): number {
  return boardToolId === 19 ? 19 : 0;
}
