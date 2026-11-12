import React from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../../types';
import { Section } from './shared';

// What a tool panel receives to talk to the board. The panels themselves are drawn from the `panel` of each tool profile (GeneratedToolPanel).
export interface ToolCtx {
  sendFrame: (id: number, data: number[], description?: string) => Promise<void>;
  waitForFrame: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
  /** Sends `id`/`data` and resolves with the first frame `respId` that arrives after the send (null on timeout). Never an old frame. */
  request: (id: number, data: number[], respId: number, timeoutMs?: number, description?: string) => Promise<CanFrame | null>;
  /** Forgets the frames kept for an id, so none of them is taken for the answer to what is sent next. */
  flushFrames: (id?: number) => void;
  subscribe: (id: number, cb: (f: CanFrame) => void) => () => void;
  isConnected: boolean;
}

const NoHandlerPanelBody: React.FC<{ name: string }> = ({ name }) => {
  const { t } = useTranslation();
  return (
    <Section title={name}>
      <div className="text-xs text-slate-500">{t('testertool.no_handler_notice', 'No CAN handler for this tool - its actuator/sensor lives on the robot mainboard, not this board.')}</div>
    </Section>
  );
};

// Memoized: the page draws again on every frame that reaches it, and the context it hands down is one stable object, so a panel is drawn again only when its own state or props change.
export const NoHandlerPanel = React.memo(NoHandlerPanelBody);
