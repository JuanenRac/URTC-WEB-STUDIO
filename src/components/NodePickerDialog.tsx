import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, X } from 'lucide-react';
import { NodePickerState, HeadMessage } from '../hooks/useNodePicker';
import { NodeStatus } from '../lib/nodePicker';

const STATUS_COLOR: Record<NodeStatus, string> = {
  selected: 'text-emerald-400', ready: 'text-cyan-400', lost: 'text-slate-400', conflict: 'text-red-400', fault: 'text-red-400', bootloader: 'text-red-400',
};
const LEVEL_COLOR = { info: 'text-slate-400', warning: 'text-amber-300', error: 'text-red-300' } as const;

// The window that finds the tool heads of a bus and selects one. Every state a head can be in is written out in words, never only coloured.
export const NodePickerDialog: React.FC<{ open: boolean; onClose: () => void; picker: NodePickerState }> = ({ open, onClose, picker }) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  const { snapshot, messages, lapse, busy } = picker;
  const say = (message: HeadMessage): string => {
    const params: Record<string, string | number> = { ...message.params };
    if (typeof params.whyKey === 'string') params.why = t(`nodes.${params.whyKey}`);
    return t(`nodes.${message.key}`, params);
  };
  const last = messages.length > 0 ? messages[messages.length - 1] : null;
  const summary = snapshot.selected !== null
    ? t('nodes.bus_selected', { node: snapshot.selected })
    : snapshot.count > 0 ? t('nodes.bus_found', { count: snapshot.count }) : t('nodes.bus_none');
  const switchLevel = snapshot.switch === 'pending_on' || snapshot.switch === 'pending_off' ? 'warning' : 'info';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="heads-title" className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="heads-title" className="flex items-center gap-2 text-sm font-bold text-slate-100"><Cpu className="w-4 h-4 text-cyan-400" />{t('nodes.title', 'Tool heads on the bus')}</h2>
          <button onClick={onClose} disabled={busy} aria-label={t('nodes.btn_close', 'Close')} className="text-slate-400 hover:text-slate-200 disabled:opacity-40"><X className="w-4 h-4" /></button>
        </div>

        <div className="mt-3 text-sm font-semibold text-cyan-300">{summary}</div>
        {snapshot.searched && <div className={`mt-1 text-[11px] ${LEVEL_COLOR[switchLevel]}`}>{t(`nodes.sw_${snapshot.switch}`)}</div>}

        {lapse && (
          <div role="alert" className="mt-3 rounded-lg border border-amber-600/70 bg-amber-950/40 p-2.5 text-xs text-slate-100">{say(lapse)}</div>
        )}

        {snapshot.mode === 'multi' && (
          <table className="mt-3 w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] text-slate-400">
                <th className="py-1 pr-2">{t('nodes.col_address', 'Address')}</th>
                <th className="py-1 pr-2">{t('nodes.col_tool', 'Tool')}</th>
                <th className="py-1 pr-2">{t('nodes.col_serial', 'Serial')}</th>
                <th className="py-1 pr-2">{t('nodes.col_state', 'State')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map(row => (
                <tr key={row.address} className={`border-t border-slate-800 ${row.mine ? 'bg-emerald-950/40' : ''}`}>
                  <td className="py-1.5 pr-2 font-mono font-bold text-slate-100">{row.address}</td>
                  <td className="py-1.5 pr-2 text-slate-200">{row.tool}</td>
                  <td className="py-1.5 pr-2 font-mono text-slate-400">{row.serial}</td>
                  <td className={`py-1.5 pr-2 font-semibold ${STATUS_COLOR[row.status]}`}>{t(`nodes.st_${row.status}`)}</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => { void picker.select(row.address); }}
                      disabled={!row.selectable || busy}
                      className="px-3 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition"
                    >{t('nodes.btn_select', 'Select')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={`mt-3 text-xs ${last ? LEVEL_COLOR[last.level] : 'text-slate-400'}`} aria-live="polite">
          {last ? say(last) : t('nodes.msg_not_searched', 'Press Find heads to look for the tool heads on the bus. Nothing is sent to a head until you select it.')}
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={snapshot.releaseOnLapse} disabled={busy} onChange={(e) => { void picker.setReleaseOnLapse(e.target.checked); }} className="mt-0.5 accent-cyan-500" />
          <span>{t('nodes.opt_release', 'If the selected head is lost, put every head in its safe state (recommended)')}</span>
        </label>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={picker.find} disabled={busy} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-40 transition">{t('nodes.btn_find', 'Find heads')}</button>
          {snapshot.selected !== null && (
            <button onClick={picker.release} disabled={busy} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-40 transition">{t('nodes.btn_release', 'Release')}</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 disabled:opacity-40 transition">{t('nodes.btn_close', 'Close')}</button>
        </div>
      </div>
    </div>
  );
};
