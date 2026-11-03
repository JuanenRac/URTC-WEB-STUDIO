import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeepalive } from '../../hooks/useKeepalive';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import type { ActionKind } from '../../lib/dangerousActions';
import { KEEPALIVE_INTERVAL_MS } from '../../lib/canIds';
import type { UrtcPanelAction, UrtcPanelControl, UrtcPanelReading, UrtcPanelSection, UrtcToolPanel } from '../../lib/generated/urtcTools';
import {
  PANEL_ENCODERS, clampControl, initialValues, labelParams, panelText, readingOf, type PanelValue, type PanelValues,
} from '../../lib/toolPanelView';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, KeepaliveCheckbox, LiveGraph } from './shared';
import type { ToolCtx } from './ToolPanels';

type TFn = (key: string, fallback: string, params?: Record<string, unknown>) => string;

function encode(name: string, values: PanelValues, args: string[] | undefined, extra: PanelValue[] = []): number[] {
  return PANEL_ENCODERS[name](...(args ?? []).map((id) => values[id]), ...extra);
}

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
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => ctx.subscribe(reading.canId, (f) => {
    const v = readingOf(reading, f.data);
    if (v !== null) setValue(v);
  }), [ctx, reading.canId, reading.offset, reading.width]);
  const shown = reading.format === 'yes_no'
    ? <span className={`font-mono ${value ? 'text-emerald-400' : 'text-slate-500'}`}>{value ? t('testertool.yes', 'YES') : t('testertool.no', 'no')}</span>
    : <span className="font-mono text-slate-200">{value ?? '--'}{reading.unit ? ` ${reading.unit}` : ''}</span>;
  return (
    <div data-testid={`reading-${reading.id}`}>
      {panelText(t, reading.label)} {shown}
      {reading.graph_max ? <LiveGraph value={value} yMax={reading.graph_max} /> : null}
    </div>
  );
};

// The command that is repeated while "Active" is checked. It is a component of its own so that the hook of each one is called in a fixed place.
const KeepaliveAction: React.FC<{
  ctx: ToolCtx; action: UrtcPanelAction; values: PanelValues; active: boolean; setActive: (v: boolean) => void;
}> = ({ ctx, action, values, active, setActive }) => {
  const confirm = useConfirmAction();
  useKeepalive(
    active, KEEPALIVE_INTERVAL_MS,
    () => ctx.sendFrame(action.canId, encode(action.encoder, values, action.args), action.description),
    () => setActive(false),
    () => ctx.sendFrame(action.canId, PANEL_ENCODERS[action.off_encoder as string](), action.off_description),
  );
  return (
    <KeepaliveCheckbox
      checked={active} watchdogMs={action.watchdog_ms as number}
      onChange={async (v) => {
        if (v && action.confirm && !(await confirm(action.confirm as ActionKind, action.confirm_value ? { value: Number(values[action.confirm_value]) } : {}))) return;
        setActive(v);
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
        onChange={(e) => { setOn(e.target.checked); ctx.sendFrame(action.canId, PANEL_ENCODERS[action.encoder](e.target.checked), e.target.checked ? action.description_on : action.description_off); }}
      />
      {panelText(t, action.label ?? { text: '' })}
    </label>
  );
};

const SectionView: React.FC<{
  ctx: ToolCtx; section: UrtcPanelSection; toolName: string; values: PanelValues; set: (id: string, v: PanelValue) => void; reset: (ids: string[]) => void; t: TFn;
}> = ({ ctx, section, toolName, values, set, reset, t }) => {
  const [active, setActive] = useState(false);
  const confirm = useConfirmAction();
  const params = { tool: toolName };
  const keepalive = (section.actions ?? []).filter((a) => a.type === 'keepalive');
  return (
    <Section title={panelText(t, section.title, params)} subtitle={section.subtitle ? panelText(t, section.subtitle, params) : undefined}>
      {section.notice && <div className="p-2 mb-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">{panelText(t, section.notice)}</div>}
      <div className="flex flex-wrap items-end gap-3">
        {(section.controls ?? []).map((c) => <ControlView key={c.id} control={c} value={values[c.id]} onChange={(v) => set(c.id, v)} t={t} />)}
        {(section.actions ?? []).map((a, i) => {
          if (a.type === 'keepalive') return <KeepaliveAction key={i} ctx={ctx} action={a} values={values} active={active} setActive={setActive} />;
          if (a.type === 'latched') return <LatchedAction key={i} ctx={ctx} action={a} t={t} />;
          const stop = a.type === 'stop';
          return (
            <button
              key={i} className={stop ? btnCls : btnPrimaryCls}
              onClick={async () => {
                if (stop) { setActive(false); if (a.reset) reset(a.reset); }
                else if (a.confirm && !(await confirm(a.confirm as ActionKind, a.confirm_value ? { value: Number(values[a.confirm_value]) } : {}))) return;
                ctx.sendFrame(a.canId, encode(a.encoder, values, a.args), a.description);
              }}
            >{panelText(t, a.label ?? { text: '' })}</button>
          );
        })}
      </div>
      {(section.telemetry ?? []).length > 0 && (
        <div className={`${keepalive.length || section.controls ? 'mt-3 ' : ''}flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400`}>
          {(section.telemetry ?? []).map((r) => <ReadingView key={r.id} ctx={ctx} reading={r} t={t} />)}
        </div>
      )}
    </Section>
  );
};

// A tool panel drawn from the `panel` of its profile: its controls, readings and commands are data, not a screen written for the tool.
export const GeneratedToolPanel: React.FC<{ ctx: ToolCtx; panel: UrtcToolPanel; toolName: string }> = ({ ctx, panel, toolName }) => {
  const { t } = useTranslation();
  const tf = t as unknown as TFn;
  const [values, setValues] = useState<PanelValues>(() => initialValues(panel));
  const set = (id: string, v: PanelValue) => setValues((prev) => ({ ...prev, [id]: v }));
  const reset = (ids: string[]) => setValues((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, initialValues(panel)[id]])) }));
  const grid = panel.sections.length > 1;
  return (
    <div className={grid ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : undefined} data-testid="generated-tool-panel">
      {panel.sections.map((s, i) => <SectionView key={i} ctx={ctx} section={s} toolName={toolName} values={values} set={set} reset={reset} t={tf} />)}
    </div>
  );
};
