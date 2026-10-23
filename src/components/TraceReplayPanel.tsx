import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FileUp, Pause, Play, Square } from 'lucide-react';
import { REPLAY_SPEEDS } from '../lib/traceReplay';
import type { TraceReplay } from '../hooks/useTraceReplay';

interface TraceReplayPanelProps {
  replay: TraceReplay;
}

/** Loads a .trc / .asc recording and plays its received frames into the log, with no board connected. */
export const TraceReplayPanel: React.FC<TraceReplayPanelProps> = ({ replay }) => {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const loaded = replay.total > 0;
  const button = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 font-mono text-xs border border-slate-700 transition';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm" data-testid="trace-replay">
      <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">{t('canbus.replay_title', 'Replay a Recorded Trace')}</h3>
      <p className="text-[11px] text-slate-400 mb-3">
        {t('canbus.replay_notice', 'Plays the received frames of a .trc or .asc trace into the log, marked REPLAY, with no board. Nothing is transmitted, and a recording never answers a request.')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".trc,.asc,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void replay.load(file);
            e.target.value = '';
          }}
        />
        <button type="button" className={button} onClick={() => fileInput.current?.click()}>
          <FileUp className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('canbus.replay_load', 'Open Trace')}</span>
        </button>
        {replay.state === 'playing' ? (
          <button type="button" className={button} onClick={replay.pause}>
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('canbus.replay_pause', 'Pause')}</span>
          </button>
        ) : (
          <button type="button" className={button} onClick={replay.play} disabled={!loaded || replay.blocked}>
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('canbus.replay_play', 'Play')}</span>
          </button>
        )}
        <button type="button" className={button} onClick={replay.stop} disabled={!loaded || replay.state === 'idle'}>
          <Square className="w-3.5 h-3.5 text-red-400" />
          <span>{t('canbus.replay_stop', 'Stop')}</span>
        </button>
        <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
          {t('canbus.replay_speed', 'Speed')}
          <select
            value={replay.speed}
            onChange={(e) => replay.setSpeed(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-xs text-slate-200"
          >
            {REPLAY_SPEEDS.map((s) => <option key={s} value={s}>{`${s}x`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
          <input type="checkbox" checked={replay.loop} onChange={(e) => replay.setLoop(e.target.checked)} />
          {t('canbus.replay_loop', 'Repeat')}
        </label>
      </div>

      {loaded && (
        <div className="mt-3 text-xs font-mono text-slate-300">
          <span className="text-cyan-300">{replay.fileName}</span>
          {' - '}
          {t('canbus.replay_progress', '{{played}} / {{total}} frames', { played: replay.played, total: replay.total })}
          {replay.rejected > 0 && <span className="ml-2 text-slate-500">{t('canbus.replay_rejected', '{{count}} lines were not valid frames and were skipped', { count: replay.rejected })}</span>}
        </div>
      )}
      {replay.blocked && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-800/70 text-[11px]">
          {t('canbus.replay_blocked', 'A board is connected: the replay is paused so that a recording is never mixed with what the board says. Disconnect to play it.')}
        </div>
      )}
      {replay.error && (
        <div role="alert" className="mt-3 px-3 py-2 rounded-lg bg-red-950/60 text-red-300 border border-red-800/70 text-[11px]">
          {replay.error === 'too_big' && t('canbus.replay_error_too_big', 'The file is too big for the browser to replay (more than 20 MB).')}
          {replay.error === 'empty' && t('canbus.replay_error_empty', 'The file holds no frames that can be replayed: a .trc or .asc trace with received (Rx) frames is needed.')}
          {replay.error === 'unreadable' && t('canbus.replay_error_unreadable', 'The file could not be read.')}
        </div>
      )}
    </div>
  );
};
