import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { confirmController } from '../lib/confirmController';

// The one confirmation shown before a dangerous command (see
// lib/dangerousActions.ts). Mounted once in App. Cancel has the focus, so
// pressing Enter by reflex does not fire the command; Escape cancels.
export const ConfirmDialog: React.FC = () => {
  const request = useSyncExternalStore(confirmController.subscribe, confirmController.getSnapshot);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') confirmController.answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request]);

  if (!request) return null;
  const danger = request.risk === 'danger';
  const Icon = danger ? ShieldAlert : AlertTriangle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) confirmController.answer(false); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"
        className={`w-full max-w-md rounded-2xl border bg-slate-900 p-5 shadow-2xl ${danger ? 'border-red-700/70' : 'border-amber-600/60'}`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 ${danger ? 'text-red-400' : 'text-amber-400'}`}><Icon className="w-6 h-6" /></div>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-sm font-bold text-slate-100">{request.title}</h2>
            <p id="confirm-message" className="mt-1.5 text-xs leading-relaxed text-slate-300">{request.message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={() => confirmController.answer(false)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition">
            {request.cancelLabel}
          </button>
          <button onClick={() => confirmController.answer(true)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition ${danger ? 'bg-red-700 hover:bg-red-600' : 'bg-amber-600 hover:bg-amber-500'}`}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
