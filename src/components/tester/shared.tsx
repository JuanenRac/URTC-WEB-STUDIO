import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm ${className || ''}`}>
    <div className="mb-3">
      <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="block text-[11px] font-semibold text-slate-400">{label}</label>
    {children}
  </div>
);

export const inputCls = "w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500";
export const btnCls = "px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition whitespace-nowrap";
export const btnPrimaryCls = "px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-xs font-semibold text-white transition whitespace-nowrap";

export const KeepaliveCheckbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  watchdogMs: number;
  disabled?: boolean;
}> = ({ checked, onChange, watchdogMs, disabled }) => {
  const { t } = useTranslation();
  return (
    <label className={`flex items-center gap-2 text-xs cursor-pointer ${disabled ? 'opacity-40 pointer-events-none' : 'text-slate-300'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="accent-purple-500 rounded" />
      <span className="font-semibold">{t('testerglobal.keepalive_active', 'Active')} <span className="text-slate-500 font-normal">{t('testerglobal.keepalive_watchdog', '({{ms}}ms watchdog)', { ms: watchdogMs })}</span></span>
    </label>
  );
};

// Fixed-scale (0..yMax) 60-point rolling scrolling line, no chart library.
export const LiveGraph: React.FC<{ value: number | null; yMax: number; color?: string; height?: number }> = ({ value, yMax, color = '#a855f7', height = 60 }) => {
  const [points, setPoints] = useState<number[]>([]);
  const lastValue = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || value === lastValue.current) return;
    lastValue.current = value;
    setPoints(prev => {
      const next = [...prev, value];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, [value]);

  const width = 240;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const polyPoints = points.map((v, i) => {
    const x = i * step;
    const y = height - Math.max(0, Math.min(1, v / yMax)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="bg-slate-950 rounded border border-slate-800" style={{ height }}>
      {points.length > 1 && <polyline points={polyPoints} fill="none" stroke={color} strokeWidth={1.5} />}
    </svg>
  );
};

export function safeInt(v: string, fallback: number, min?: number, max?: number): number {
  let n = parseInt(v, 10);
  if (isNaN(n)) n = fallback;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}
