// What the Control tab may say after it switched something off: it never claims that an off frame went out when it did not.
import type { CutReason } from './controlHeartbeat';

export interface CutMessage { key: string; fallback: string }

const NOT_SENT: CutMessage = {
  key: 'toolcatalog.real_off_not_sent',
  fallback: 'The off frame could not be sent. Nothing confirms that the tool is off: the firmware cuts it by its own timeout, and the physical stop is the safe way.',
};

/** After something that was on ended for `reason`; null when there is nothing to tell. */
export function cutMessage(reason: CutReason, offSent: boolean): CutMessage | null {
  if (reason === 'unmount') return null;
  // The message of a lost connection already says that the frame could not be sent.
  if (!offSent && reason !== 'connection') return NOT_SENT;
  if (reason === 'switch') return null;
  return { key: `toolcatalog.real_cut_${reason}`, fallback: 'Switched off: {{reason}}. The off frame was sent.' };
}

/**
 * After the STOP button. `sessionOff` is the result of the off frame of what the tab kept on (null: nothing was on) and `ownOff` the one of the off
 * frame of the active tool (null: the tool has none, or no board is connected).
 */
export function stopMessage(sessionOff: boolean | null, ownOff: boolean | null): CutMessage {
  if (sessionOff === false || ownOff === false) return NOT_SENT;
  if (sessionOff === null && ownOff === null) {
    return { key: 'toolcatalog.real_stop_nothing_sent', fallback: 'STOP was pressed. No off frame was sent: there is no board connected or this tool has no off frame in this tab.' };
  }
  return { key: 'toolcatalog.real_cut_stop', fallback: 'Switched off: {{reason}}. The off frame was sent.' };
}
