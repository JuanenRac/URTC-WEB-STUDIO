import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeepalive } from '../../hooks/useKeepalive';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import type { ActionKind } from '../../lib/dangerousActions';
import { KEEPALIVE_INTERVAL_MS } from '../../lib/canIds';
import type { UrtcPanelAction, UrtcPanelControl, UrtcPanelReading, UrtcPanelSection, UrtcToolPanel } from '../../lib/generated/urtcTools';
import { isConfigWord } from '../../lib/toolLimits';
import {
  PANEL_ENCODERS, askValue, clampControl, encodeAction, heatColor, initialValues, labelParams, panelControls, panelText, pullImage, readingShown,
  readingStep, resultText, type PanelValue, type PanelValues,
} from '../../lib/toolPanelView';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, KeepaliveCheckbox, LiveGraph } from './shared';
import type { ToolCtx } from './ToolPanels';

type TFn = (key: string, fallback: string, params?: Record<string, unknown>) => string;

const ControlView: React.FC<{ control: UrtcPanelControl; value: PanelValue; onChange: (v: PanelValue) => void; t: TFn }> = ({ control, value, onChange, t }) => {
  const label = panelText(t, control.label, labelParams(control, value));
  if (control.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="accent-purple-500" /> {label}
      </label>
    );
  }
  if (control.type === 'select') {
    return (
      <Field label={label}>
        <select value={String(value)} onChange={(e) => onChange(control.options.find((o) => String(o.value) === e.target.value)?.value ?? control.default)} className={inputCls}>
          {control.options.map((o) => <option key={String(o.value)} value={String(o.value)}>{panelText(t, o.label)}</option>)}
        </select>
      </Field>
    );
  }
  if (control.type === 'hex') {
    const ok = isConfigWord(String(value));
    return (
      <Field label={label}>
        <input value={String(value)} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${ok ? '' : 'border-red-500'}`} aria-invalid={!ok} />
      </Field>
    );
  }
  if (control.type === 'range') {
    return (
      <Field label={label}>
        <input type="range" min={control.min} max={control.max} value={Number(value)} onChange={(e) => onChange(clampControl(control, e.target.value))} className="w-40" />
      </Field>
    );
  }
  return (
    <Field label={label}>
      <input type="number" min={control.min} max={control.max} value={Number(value)} onChange={(e) => onChange(clampControl(control, e.target.value))} className={inputCls} />
    </Field>
  );
};

const ReadingView: React.FC<{ ctx: ToolCtx; reading: UrtcPanelReading; t: TFn }> = ({ ctx, reading, t }) => {
  const [state, setState] = useState<{ value: number | null; seen: string | null }>({ value: null, seen: null });
  useEffect(() => ctx.subscribe(reading.canId, (f) => setState((prev) => readingStep(reading, f, prev))),
    [ctx, reading.canId, reading.offset, reading.width, reading.format, reading.match]);
  const { value } = state;
  const shown = readingShown(reading, value, state.seen, t('testertool.yes', 'YES'), t('testertool.no', 'no'));
  const tone = shown.tone === 'on' ? 'text-emerald-400' : shown.tone === 'off' ? 'text-slate-500' : 'text-slate-200';
  return (
    <div data-testid={`reading-${reading.id}`}>
      {panelText(t, reading.label)} <span className={`font-mono ${tone}`}>{shown.text}</span>
      {reading.graph_max ? <LiveGraph value={value} yMax={reading.graph_max} /> : null}
    </div>
  );
};

// The command that is repeated while "Active" is checked. It is a component of its own so that the hook of each one is called in a fixed place.
const KeepaliveAction: React.FC<{
  ctx: ToolCtx; action: UrtcPanelAction; values: PanelValues; active: boolean; setActive: (v: boolean) => void; reset: (ids: string[]) => void;
}> = ({ ctx, action, values, active, setActive, reset }) => {
  const confirm = useConfirmAction();
  useKeepalive(
    active, action.interval_ms ?? KEEPALIVE_INTERVAL_MS,
    () => ctx.sendFrame(action.canId, encodeAction(action.encoder as string, values, action.args), action.description),
    () => setActive(false),
    () => ctx.sendFrame(action.canId, PANEL_ENCODERS[action.off_encoder as string](), action.off_description),
  );
  return (
    <KeepaliveCheckbox
      checked={active} watchdogMs={action.watchdog_ms as number}
      onChange={async (v) => {
        if (v && action.confirm && !(await confirm(action.confirm as ActionKind, action.confirm_value ? { value: Number(values[action.confirm_value]) } : {}))) return;
        setActive(v);
        if (!v && action.reset) reset(action.reset);
      }}
    />
  );
};

const LatchedAction: React.FC<{ ctx: ToolCtx; action: UrtcPanelAction; t: TFn }> = ({ ctx, action, t }) => {
  const [on, setOn] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
      <input
        type="checkbox" checked={on} className="accent-purple-500 w-4 h-4"
        onChange={(e) => { setOn(e.target.checked); ctx.sendFrame(action.canId, PANEL_ENCODERS[action.encoder as string](e.target.checked), e.target.checked ? action.description_on : action.description_off); }}
      />
      {panelText(t, action.label ?? { text: '' })}
    </label>
  );
};

// Asks the board for one value and shows it (with `auto`, also when the adapter connects).
const QueryAction: React.FC<{ ctx: ToolCtx; action: UrtcPanelAction; index: number; t: TFn }> = ({ ctx, action, index, t }) => {
  const [value, setValue] = useState<number | null>(null);
  const result = action.result as NonNullable<UrtcPanelAction['result']>;
  const ask = async () => {
    const v = await askValue(ctx, action);
    if (v !== null) setValue(v);
  };
  useEffect(() => { if (action.auto && ctx.isConnected) void ask(); }, [ctx.isConnected]);
  return (
    <>
      {result.label && <span className="text-xs text-slate-400">{panelText(t, result.label)}</span>}
      <span className="text-xs font-mono text-slate-200" data-testid={`query-${index}`}>{resultText(t, result, value)}</span>
      <button className={btnCls} onClick={ask}>{panelText(t, action.label ?? { text: '' })}</button>
    </>
  );
};

// Pulls a picture from the board a chunk at a time (one request, then the frames of the chunk) and draws it as coloured squares.
const ImageAction: React.FC<{ ctx: ToolCtx; action: UrtcPanelAction; t: TFn }> = ({ ctx, action, t }) => {
  const [pixels, setPixels] = useState<number[] | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const read = async () => {
    setReading(true);
    setProgress(0);
    setError('');
    try {
      setPixels(await pullImage(ctx, action, setProgress));
    } catch (e) {
      console.error(e);
      setError(panelText(t, action.error as NonNullable<UrtcPanelAction['error']>, { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setReading(false);
    }
  };
  const label = panelText(t, action.label ?? { text: '' });
  return (
    <>
      <button className={btnPrimaryCls} onClick={read} disabled={reading}>
        {reading ? panelText(t, action.progress as NonNullable<UrtcPanelAction['progress']>, { pct: progress }) : label}
      </button>
      <div className="basis-full" data-testid="panel-image">
        {error && <div className="mb-2 text-xs text-red-400">{error}</div>}
        {pixels && (
          <div className="grid gap-px bg-slate-800 border border-slate-800 rounded overflow-hidden" style={{ gridTemplateColumns: `repeat(${action.columns}, 1fr)`, maxWidth: 480 }}>
            {pixels.slice(0, (action.chunks as number) * (action.frames_per_chunk as number) * 4).map((v, i) => (
              <div key={i} style={{ background: heatColor(v, action.max_value as number), aspectRatio: '1/1' }} title={`${v.toFixed(1)} C`} />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

const SectionView: React.FC<{
  ctx: ToolCtx; section: UrtcPanelSection; toolName: string; values: PanelValues; badHex: Set<string>;
  set: (id: string, v: PanelValue) => void; reset: (ids: string[]) => void; t: TFn;
}> = ({ ctx, section, toolName, values, badHex, set, reset, t }) => {
  const [active, setActive] = useState(false);
  const confirm = useConfirmAction();
  const params = { tool: toolName };
  const keepalive = (section.actions ?? []).filter((a) => a.type === 'keepalive');
  const hasRow = (section.controls ?? []).length > 0 || (section.actions ?? []).length > 0;
  return (
    <Section title={panelText(t, section.title, params)} subtitle={section.subtitle ? panelText(t, section.subtitle, params) : undefined}>
      {section.notice && <div className="p-2 mb-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">{panelText(t, section.notice)}</div>}
      {hasRow && (
        <div className="flex flex-wrap items-end gap-3">
          {(section.controls ?? []).map((c) => <ControlView key={c.id} control={c} value={values[c.id]} onChange={(v) => set(c.id, v)} t={t} />)}
          {(section.actions ?? []).map((a, i) => {
            if (a.type === 'keepalive') return <KeepaliveAction key={i} ctx={ctx} action={a} values={values} active={active} setActive={setActive} reset={reset} />;
            if (a.type === 'latched') return <LatchedAction key={i} ctx={ctx} action={a} t={t} />;
            if (a.type === 'query') return <QueryAction key={i} ctx={ctx} action={a} index={i} t={t} />;
            if (a.type === 'image') return <ImageAction key={i} ctx={ctx} action={a} t={t} />;
            const stop = a.type === 'stop';
            return (
              <button
                key={i} className={stop ? btnCls : btnPrimaryCls}
                disabled={(a.args ?? []).some((id) => typeof id === 'string' && badHex.has(id))}
                onClick={async () => {
                  if (stop) { setActive(false); if (a.reset) reset(a.reset); }
                  else if (a.confirm && !(await confirm(a.confirm as ActionKind, a.confirm_value ? { value: Number(values[a.confirm_value]) } : {}))) return;
                  ctx.sendFrame(a.canId, encodeAction(a.encoder as string, values, a.args, a.gate_first, active), a.description);
                }}
              >{panelText(t, a.label ?? { text: '' })}</button>
            );
          })}
        </div>
      )}
      {(section.telemetry ?? []).length > 0 && (
        <div className={`${keepalive.length || hasRow ? 'mt-3 ' : ''}flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400`}>
          {(section.telemetry ?? []).map((r) => <ReadingView key={r.id} ctx={ctx} reading={r} t={t} />)}
        </div>
      )}
    </Section>
  );
};

// A tool panel drawn from the `panel` of its profile: its controls, readings and commands are data, not a screen written for the tool.
const GeneratedToolPanelBody: React.FC<{ ctx: ToolCtx; panel: UrtcToolPanel; toolName: string }> = ({ ctx, panel, toolName }) => {
  const { t } = useTranslation();
  const tf = t as unknown as TFn;
  const [values, setValues] = useState<PanelValues>(() => initialValues(panel));
  const set = (id: string, v: PanelValue) => setValues((prev) => ({ ...prev, [id]: v }));
  const reset = (ids: string[]) => setValues((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, initialValues(panel)[id]])) }));
  const badHex = new Set(panelControls(panel).filter((c) => c.type === 'hex' && !isConfigWord(String(values[c.id]))).map((c) => c.id));
  const grid = panel.sections.length > 1;
  return (
    <div className={grid ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : undefined} data-testid="generated-tool-panel">
      {panel.sections.map((s, i) => <SectionView key={i} ctx={ctx} section={s} toolName={toolName} values={values} badHex={badHex} set={set} reset={reset} t={tf} />)}
    </div>
  );
};

// Memoized: the page draws again on every frame that reaches it, and the context it hands down is one stable object, so a panel is drawn again only when its own state or props change.
export const GeneratedToolPanel = React.memo(GeneratedToolPanelBody);
