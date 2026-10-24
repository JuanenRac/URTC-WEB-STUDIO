import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, safeInt } from './shared';
import { ToolCtx } from './ToolPanels';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { downloadBlob } from '../../lib/download';
import { CAN_ID_SET_FEATURES, CAN_ID_FEATURES_RESP, CAN_ID_PID_CONFIG, CAN_ID_PID_STATE_RESP } from '../../lib/canIds';
import { PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_AUTOTUNE_START, PID_ACTION_QUERY, PID_ACTION_SET_GAINS, PID_STATE_KEYS, decodePidState, encodePidConfig } from '../../lib/pid';
import {
  BLACK_BOX_CHUNK_COUNT, BLACK_BOX_CHUNK_ID, BLACK_BOX_FRAMES_PER_CHUNK, BLACK_BOX_QUERY_ID, BlackBoxRecord,
  blackBoxChart, blackBoxCsv, blackBoxFromText, blackBoxJson, chunkRequest, joinFrames, parseBlackBox, triggerIndex,
} from '../../lib/blackBox';
import { CAN_ID_THERMAL_STATS_QUERY, CAN_ID_THERMAL_STATS_RESP } from '../../lib/generated/urtcCanIds';
import { parseThermalStats, thermalFaultTextKey } from '../../lib/thermalStats';
import { SimulatedRack, RACK_COMMAND_MIN_INTERVAL_MS, encodeSetPreheat, unitKey } from '../../lib/rackSim';
import {
  THERMAL_CALIBRATED_CHUNK_ID, THERMAL_CALIBRATED_REQUEST_ID, THERMAL_FRAMES_PER_CHUNK, THERMAL_STATUS_ID, THERMAL_TRIGGER_ID,
  ThermalFrame, assembleThermal, syntheticThermalFrame, thermalChunkCount, thermalRegionStats, thermalRgb,
} from '../../lib/thermalView';

const FEATURES_MAGIC = [0x46, 0x45, 0x41, 0x54];
const FEATURE_BITS: Array<[number, string]> = [[1, 'feature_motion_ramps'], [2, 'feature_health_profile'], [4, 'feature_hsi_autotrim'], [8, 'feature_thermal_pid']];

async function collectFrames(ctx: ToolCtx, requestId: number, data: number[], answerId: number, wanted: number, timeoutMs: number, description: string): Promise<number[][] | null> {
  const frames: number[][] = [];
  const unsubscribe = ctx.subscribe(answerId, f => { if (f.data.length === 8) frames.push(f.data); });
  try {
    await ctx.sendFrame(requestId, data, description);
    const deadline = Date.now() + timeoutMs;
    while (frames.length < wanted && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
  } finally { unsubscribe(); }
  return frames.length >= wanted ? frames.slice(0, wanted) : null;
}

// ---- Fault recorder (0x1A8 / 0x1A9) ----
const CHART_WIDTH = 480;
const CHART_HEIGHT = 170;

/** The temperature before the error: measured and setpoint, with a line where the error flag first shows. */
const BlackBoxChartView: React.FC<{ record: BlackBoxRecord }> = ({ record }) => {
  const { t } = useTranslation();
  const chart = blackBoxChart(record, CHART_WIDTH, CHART_HEIGHT);
  return (
    <div className="mt-3" data-testid="black-box-chart">
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-300 mb-1">
        <span className="text-slate-400">{t('testerextras.black_chart_title', 'Temperature before the error')}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />{t('testerextras.black_chart_current', 'Measured')}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-cyan-400" />{t('testerextras.black_chart_target', 'Setpoint')}</span>
        {chart.triggerX !== null && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />{t('testerextras.black_chart_trigger', 'Error flag')}</span>}
        <span className="text-slate-500">{t('testerextras.black_chart_span', '{{seconds}} s recorded', { seconds: (chart.spanMs / 1000).toFixed(1) })}</span>
      </div>
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded" role="img" aria-label={t('testerextras.black_chart_title', 'Temperature before the error')}>
        {chart.grid.map((g) => (
          <g key={g.y}>
            <line x1="8" x2={CHART_WIDTH - 8} y1={g.y} y2={g.y} stroke="#334155" strokeWidth="0.5" />
            <text x="10" y={g.y - 2} fontSize="8" fill="#64748b">{g.temperature}</text>
          </g>
        ))}
        <polyline points={chart.target} fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="4 2" />
        <polyline points={chart.current} fill="none" stroke="#fbbf24" strokeWidth="1.6" />
        {chart.triggerX !== null && <line x1={chart.triggerX} x2={chart.triggerX} y1="8" y2={CHART_HEIGHT - 8} stroke="#ef4444" strokeWidth="1" />}
      </svg>
    </div>
  );
};
export const BlackBoxPanel: React.FC<{ ctx: ToolCtx; systemError: boolean }> = ({ ctx, systemError }) => {
  const { t } = useTranslation();
  const [record, setRecord] = useState<BlackBoxRecord | null>(null);
  const [message, setMessage] = useState('');
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counters, setCounters] = useState('');
  const wasError = useRef(false);

  // The lifetime thermal counters (0x1AA / 0x1AB): one question, one answer of 8 bytes.
  const readCounters = async () => {
    if (!ctx.isConnected) return;
    const answer = await ctx.request(CAN_ID_THERMAL_STATS_QUERY, [], CAN_ID_THERMAL_STATS_RESP, 1000, 'Thermal counters');
    const stats = answer ? parseThermalStats(answer.data) : null;
    if (!stats) { setCounters(t('testerextras.counters_no_answer', 'No answer to 0x1AA: the lifetime thermal counters need URTC firmware 0.3.3 or newer.')); return; }
    const last = stats.lastFault === 0
      ? t('testerextras.counters_none', 'none')
      : t(thermalFaultTextKey(stats), 'fault {{n}}', { n: stats.lastFault });
    const line = t('testerextras.counters_text', 'Thermal runaway faults ever: {{faults}} | Heater on: {{hours}} h | Last fault: {{last}}', { faults: stats.faultCount, hours: stats.heaterOnHours.toFixed(2), last });
    setCounters(stats.persisted ? line : `${line}\n${t('testerextras.counters_not_persisted', 'F-RAM not answering: the counters are RAM-only since the last boot.')}`);
  };

  const read = async () => {
    if (!ctx.isConnected || busy) return;
    setBusy(true);
    setRecord(null);
    try {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < BLACK_BOX_CHUNK_COUNT; i++) {
        setMessage(t('testerextras.black_reading', 'Reading chunk {{n}} of {{total}}...', { n: i + 1, total: BLACK_BOX_CHUNK_COUNT }));
        const frames = await collectFrames(ctx, BLACK_BOX_QUERY_ID, chunkRequest(i), BLACK_BOX_CHUNK_ID, BLACK_BOX_FRAMES_PER_CHUNK, 600, 'Black box chunk');
        if (!frames) throw new Error(`chunk ${i} is missing or incomplete`);
        chunks.push(joinFrames(frames));
      }
      const raw = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let pos = 0;
      for (const c of chunks) { raw.set(c, pos); pos += c.length; }
      const parsed = parseBlackBox(raw);
      setRecord(parsed);
      const trigger = triggerIndex(parsed);
      setMessage(trigger === null
        ? t('testerextras.black_no_error', '{{count}} samples; no error flag in the record', { count: parsed.samples.length })
        : t('testerextras.black_summary', '{{count}} samples; the error flag is set at sample {{trigger}}', { count: parsed.samples.length, trigger }));
    } catch (e) {
      setMessage(t('testerextras.black_failed', 'The black box could not be read: {{reason}}', { reason: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(false); }
  };

  // Once for each rising edge of the error flag the board reports (0x111), when the option is on.
  useEffect(() => {
    if (systemError && !wasError.current && auto && ctx.isConnected) { void read(); }
    wasError.current = systemError;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemError]);

  const openSaved = async (file: File) => {
    try {
      if (file.size > 1024 * 1024) throw new Error(t('testerextras.black_open_big', 'the file is too big for a record'));
      const parsed = blackBoxFromText(await file.text());
      setRecord(parsed);
      setMessage(t('testerextras.black_open_ok', '{{name}}: {{count}} samples', { name: file.name, count: parsed.samples.length }));
    } catch (e) {
      setMessage(t('testerextras.black_open_failed', '{{name}} is not a record that can be read: {{reason}}', { name: file.name, reason: e instanceof Error ? e.message : String(e) }));
    }
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  return (
    <Section title={t('testerextras.black_title', 'Fault recorder (black box, 0x1A8/0x1A9)')} subtitle={t('testerextras.black_subtitle', 'Reads the last ten seconds the board recorded before an error and saves them as CSV or JSON.')}>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button className={btnPrimaryCls} onClick={read} disabled={!ctx.isConnected || busy}>{t('testerextras.black_read', 'Read the black box')}</button>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-purple-500" /> {t('testerextras.black_auto', 'Read it automatically when the board reports an error')}
        </label>
        <button className={btnCls} disabled={!record} onClick={() => record && downloadBlob(new Blob([blackBoxCsv(record)], { type: 'text/csv' }), `urtc_blackbox_${stamp()}.csv`)}>{t('testerextras.black_csv', 'Download CSV')}</button>
        <button className={btnCls} disabled={!record} onClick={() => record && downloadBlob(new Blob([blackBoxJson(record, new Date().toISOString())], { type: 'application/json' }), `urtc_blackbox_${stamp()}.json`)}>{t('testerextras.black_json', 'Download JSON')}</button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className={btnCls + ' cursor-pointer'}>
          {t('testerextras.black_open', 'Open a saved record (JSON or CSV)')}
          <input type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openSaved(f); e.target.value = ''; }} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button className={btnCls} onClick={readCounters} disabled={!ctx.isConnected}>{t('testerextras.counters_read', 'Read the thermal counters')}</button>
      </div>
      {counters && <div className="text-xs text-slate-300 font-mono mb-3 whitespace-pre-line" data-testid="thermal-counters">{counters}</div>}
      {message && <div className="text-xs text-slate-300 font-mono">{message}</div>}
      {record && <BlackBoxChartView record={record} />}
    </Section>
  );
};

// ---- Optional functions (0x1AE / 0x1AF) ----
export const FeaturesPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const confirm = useConfirmAction();
  const [mask, setMask] = useState(0);
  const [status, setStatus] = useState('');
  const names = (m: number) => FEATURE_BITS.filter(([bit]) => m & bit).map(([, key]) => t(`testerextras.${key}`)).join(', ') || t('testerextras.features_none', 'none');

  const show = (data: number[] | undefined) => {
    if (!data || data.length !== 3) { setStatus(t('testerextras.features_no_answer', 'No answer (firmware without these functions)')); return; }
    setMask(data[0] & 0x0F);
    setStatus(t('testerextras.features_status', 'Stored: {{stored}} | In force: {{running}} | Supported: {{supported}}', { stored: names(data[0]), running: names(data[1]), supported: names(data[2]) }));
  };
  const query = async () => { const r = await ctx.request(CAN_ID_FEATURES_RESP, [], CAN_ID_FEATURES_RESP, 1000, 'Query optional functions'); show(r?.data); };
  const write = async () => {
    if (!(await confirm('program_config'))) return;
    const r = await ctx.request(CAN_ID_SET_FEATURES, [...FEATURES_MAGIC, mask & 0x0F], CAN_ID_FEATURES_RESP, 1000, 'Write optional functions');
    show(r?.data);
  };

  return (
    <Section title={t('testerextras.features_title', 'Optional functions (0x1AE/0x1AF)')} subtitle={t('testerextras.features_subtitle', 'All off by default. A change is stored in the board and acts after the next power-up.')}>
      <div className="flex flex-wrap gap-4 mb-3">
        {FEATURE_BITS.map(([bit, key]) => (
          <label key={bit} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={(mask & bit) !== 0} onChange={(e) => setMask(m => (e.target.checked ? m | bit : m & ~bit))} className="accent-purple-500" /> {t(`testerextras.${key}`)}
          </label>
        ))}
      </div>
      <div className="flex gap-3 mb-3">
        <button className={btnCls} onClick={query} disabled={!ctx.isConnected}>{t('testerextras.features_query', 'Query')}</button>
        <button className={btnPrimaryCls} onClick={write} disabled={!ctx.isConnected}>{t('testerextras.features_write', 'Write')}</button>
      </div>
      {status && <div className="text-xs text-slate-300 font-mono">{status}</div>}
    </Section>
  );
};

// ---- Heater PID (0x1B9 / 0x1BA) ----
export const PidPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const confirm = useConfirmAction();
  const [kp, setKp] = useState('8');
  const [ki, setKi] = useState('0.2');
  const [kd, setKd] = useState('1.5');
  const [status, setStatus] = useState('');

  const show = (data: number[] | undefined) => {
    const state = data ? decodePidState(data) : null;
    if (!state) { setStatus(t('testerextras.pid_no_answer', 'No answer (firmware without the heater PID)')); return; }
    const key = PID_STATE_KEYS[state.state];
    setStatus(t('testerextras.pid_status', 'Kp {{kp}}  Ki {{ki}}  Kd {{kd}}  |  State: {{state}}  |  Heater output: {{duty}} %', {
      kp: state.kp, ki: state.ki, kd: state.kd, state: key ? t(`testerextras.${key}`) : `CODE_${state.state}`, duty: state.dutyPercent,
    }));
  };
  const send = async (action: number, description: string) => {
    const data = encodePidConfig(action, { kp, ki, kd });
    if (!data) { setStatus(t('testerextras.pid_bad_gains', 'The gains must be numbers from 0 to 600.')); return; }
    const r = await ctx.request(CAN_ID_PID_CONFIG, data, CAN_ID_PID_STATE_RESP, 1000, description);
    show(r?.data);
  };
  const store = async () => { if (await confirm('program_config')) await send(PID_ACTION_SET_GAINS, 'Store the PID gains'); };
  const autotune = async () => {
    if (await confirm('heater', { value: 1, message: t('testerextras.pid_autotune_confirm', 'The board will heat the tip around the current set-point of the soldering iron to find the gains, and store them. Set the set-point first (100 to 445 C) and stay beside the board.') })) {
      await send(PID_ACTION_AUTOTUNE_START, 'Start the PID autotune');
    }
  };

  return (
    <Section title={t('testerextras.pid_title', 'Heater PID (0x1B9/0x1BA)')} subtitle={t('testerextras.pid_subtitle', 'Needs the Heater PID function switched on above. The autotune heats the tip around the current set-point of the soldering iron and stores the gains it finds.')}>
      <div className="grid grid-cols-3 gap-3 mb-3 max-w-md">
        <Field label="Kp"><input type="text" inputMode="decimal" value={kp} onChange={(e) => setKp(e.target.value)} className={inputCls} /></Field>
        <Field label="Ki"><input type="text" inputMode="decimal" value={ki} onChange={(e) => setKi(e.target.value)} className={inputCls} /></Field>
        <Field label="Kd"><input type="text" inputMode="decimal" value={kd} onChange={(e) => setKd(e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        <button className={btnCls} onClick={() => send(PID_ACTION_QUERY, 'Query the PID state')} disabled={!ctx.isConnected}>{t('testerextras.pid_query', 'Read the state')}</button>
        <button className={btnPrimaryCls} onClick={store} disabled={!ctx.isConnected}>{t('testerextras.pid_store', 'Store the gains')}</button>
        <button className={btnPrimaryCls} onClick={autotune} disabled={!ctx.isConnected}>{t('testerextras.pid_autotune', 'Start the autotune')}</button>
        <button className={btnCls} onClick={() => send(PID_ACTION_AUTOTUNE_ABORT, 'Abort the PID autotune')} disabled={!ctx.isConnected}>{t('testerextras.pid_abort', 'Abort the autotune')}</button>
      </div>
      {status && <div className="text-xs text-slate-300 font-mono">{status}</div>}
    </Section>
  );
};

// ---- Rack bench (simulated) ----
export const RackBenchPanel: React.FC = () => {
  const { t } = useTranslation();
  const rackRef = useRef(new SimulatedRack());
  const clock = useRef({ now: 0, seq: 0 });
  const [slot, setSlot] = useState(0);
  const [tool, setTool] = useState(0);
  const [serial, setSerial] = useState(0);
  const [target, setTarget] = useState(200);
  const [advance, setAdvance] = useState(1000);
  const [minInterval, setMinInterval] = useState(rackRef.current.commandMinIntervalMs);
  const [headline, setHeadline] = useState('');
  const [, refresh] = useState(0);

  const act = (fn: () => string) => { try { setHeadline(fn()); } catch (e) { setHeadline(e instanceof Error ? e.message : String(e)); } refresh(n => n + 1); };
  const place = () => act(() => { rackRef.current.setSlot(slot, tool, serial); return `slot ${slot}: tool ${tool}${serial ? ` serial ${serial}` : ''}`; });
  const send = () => act(() => {
    clock.current.seq = (clock.current.seq + 1) & 0xFF;
    rackRef.current.commandMinIntervalMs = minInterval;
    const reply = rackRef.current.receive(encodeSetPreheat(clock.current.seq, tool, target), clock.current.now);
    if (reply.detail === 'throttled') return t('testerextras.rack_throttled', 'command held back: the minimum interval has not passed');
    return `${reply.kind.toUpperCase()}${reply.action !== 'none' ? ` ${reply.action}` : ''}${reply.detail ? ` (${reply.detail})` : ''}`;
  });
  const wait = () => act(() => {
    clock.current.now += Math.max(0, advance);
    const cut = rackRef.current.tick(clock.current.now);
    return `time ${clock.current.now} ms${cut ? `; ${cut} slot(s) sent to the safe state` : ''}`;
  });
  const exportStatus = () => {
    const rack = rackRef.current;
    const slots = rack.slots.map((s, i) => ({ slot: i, occupied: s.occupied, tool_id: s.occupied ? s.toolId : null, serial: s.serial || null, unit: unitKey(s), target_c: s.targetC, expired: rack.expired.has(i) }));
    const doc = { schema: 1, name: 'URTC rack bench', source: 'simulation', occupied: slots.filter(s => s.occupied).length, slot_count: slots.length, slots };
    downloadBlob(new Blob([JSON.stringify(doc, null, 2) + '\n'], { type: 'application/json' }), 'rack_status.json');
  };

  return (
    <Section title={t('testerextras.rack_title', 'Rack bench (simulated, no board)')} subtitle={t('testerextras.rack_subtitle', 'The serial protocol and the behaviour of the tool rack, simulated here. The identity of a head is its type plus its serial number.')}>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-3">
        <Field label={t('testerextras.rack_slot', 'Slot')}><input type="number" min={0} max={7} value={slot} onChange={(e) => setSlot(safeInt(e.target.value, 0, 0, 7))} className={inputCls} /></Field>
        <Field label={t('testerextras.rack_tool', 'Tool')}><input type="number" min={0} max={24} value={tool} onChange={(e) => setTool(safeInt(e.target.value, 0, 0, 24))} className={inputCls} /></Field>
        <Field label={t('testerextras.rack_serial', 'Serial')}><input type="number" min={0} max={255} value={serial} onChange={(e) => setSerial(safeInt(e.target.value, 0, 0, 255))} className={inputCls} /></Field>
        <Field label={t('testerextras.rack_target', 'Target C')}><input type="number" min={0} max={400} value={target} onChange={(e) => setTarget(safeInt(e.target.value, 0, 0, 400))} className={inputCls} /></Field>
        <Field label={t('testerextras.rack_advance', 'Advance time (ms)')}><input type="number" min={0} value={advance} onChange={(e) => setAdvance(safeInt(e.target.value, 1000, 0, 3_600_000))} className={inputCls} /></Field>
        <Field label={t('testerextras.rack_min_interval', 'Minimum interval between commands (ms, 0 = off)')}><input type="number" min={0} max={60000} value={minInterval} onChange={(e) => setMinInterval(safeInt(e.target.value, RACK_COMMAND_MIN_INTERVAL_MS, 0, 60_000))} className={inputCls} /></Field>
      </div>
      <div className="flex flex-wrap gap-3 mb-3">
        <button className={btnCls} onClick={place}>{t('testerextras.rack_place', 'Rack the head')}</button>
        <button className={btnPrimaryCls} onClick={send}>{t('testerextras.rack_send', 'Send pre-heat')}</button>
        <button className={btnCls} onClick={wait}>{t('testerextras.rack_advance', 'Advance time (ms)')}</button>
        <button className={btnCls} onClick={exportStatus}>{t('testerextras.rack_export', 'Download the status page')}</button>
      </div>
      {headline && <div className="text-xs text-slate-300 font-mono mb-2">{headline}</div>}
      <pre className="text-[11px] text-slate-400 font-mono">{rackRef.current.slots.map((s, i) => s.occupied
        ? `slot ${i}: tool ${s.toolId} (${unitKey(s) ?? t('testerextras.rack_no_serial', 'no serial')}) -> ${s.targetC} C${rackRef.current.expired.has(i) ? ` ${t('testerextras.rack_limit', 'limit reached')}` : ''}`
        : `slot ${i}: ${t('testerextras.rack_empty', 'empty')}`).join('\n')}</pre>
    </Section>
  );
};

// ---- Thermal view (tool 22, 0x250 to 0x255) ----
export const ThermalViewPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState<ThermalFrame | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const height = frame.length, width = frame[0].length;
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(width, height);
    const rgb = thermalRgb(frame);
    for (let i = 0; i < width * height; i++) { image.data[i * 4] = rgb[i * 3]; image.data[i * 4 + 1] = rgb[i * 3 + 1]; image.data[i * 4 + 2] = rgb[i * 3 + 2]; image.data[i * 4 + 3] = 255; }
    context.putImageData(image, 0, 0);
  }, [frame]);

  const stats = frame ? thermalRegionStats(frame, 0, 0, frame[0].length, frame.length) : null;

  const readBoard = async () => {
    if (!ctx.isConnected) return;
    try {
      await ctx.sendFrame(THERMAL_TRIGGER_ID, [], 'Thermal trigger');
      let ready = false;
      for (let i = 0; i < 50 && !ready; i++) {
        const r = await ctx.request(THERMAL_STATUS_ID, [], THERMAL_STATUS_ID, 200, 'Thermal status');
        if (r && r.data.length === 1) { if (r.data[0] === 0xFF) throw new Error('the head reports a capture error'); ready = r.data[0] === 0x02; }
      }
      if (!ready) throw new Error('the head did not become ready');
      const chunks = new Map<number, number[]>();
      for (let i = 0; i < thermalChunkCount('90640'); i++) {
        const frames = await collectFrames(ctx, THERMAL_CALIBRATED_REQUEST_ID, [i], THERMAL_CALIBRATED_CHUNK_ID, THERMAL_FRAMES_PER_CHUNK, 500, 'Thermal chunk');
        if (!frames) throw new Error(`chunk ${i} was not answered with four frames`);
        chunks.set(i, frames.flat());
      }
      setFrame(assembleThermal(chunks)); setSimulated(false); setMessage('');
    } catch (e) {
      setMessage(t('testerextras.thermal_failed', 'The thermal image could not be read: {{reason}}', { reason: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <Section title={t('testerextras.thermal_title', 'Thermal view (tool 22, 0x250 to 0x255)')} subtitle={t('testerextras.thermal_subtitle', 'The thermal image in false colour, from the board or simulated.')}>
      <div className="flex gap-3 mb-3">
        <button className={btnCls} onClick={() => { setFrame(syntheticThermalFrame()); setSimulated(true); setMessage(''); }}>{t('testerextras.thermal_simulated', 'Show a simulated image')}</button>
        <button className={btnPrimaryCls} onClick={readBoard} disabled={!ctx.isConnected}>{t('testerextras.thermal_read', 'Read from the board')}</button>
      </div>
      {frame && <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', width: 384, maxWidth: '100%' }} className="border border-slate-700 rounded" />}
      {simulated && <div className="text-xs text-amber-300 mt-2">{t('testerextras.thermal_banner_sim', 'SIMULATED image: no board was read')}</div>}
      {stats && <div className="text-xs text-slate-300 font-mono mt-2">{t('testerextras.thermal_stats', 'min {{min}} C, max {{max}} C, mean {{mean}} C', { min: stats.minimum.toFixed(1), max: stats.maximum.toFixed(1), mean: stats.mean.toFixed(1) })}</div>}
      {message && <div className="text-xs text-red-300 mt-2">{message}</div>}
    </Section>
  );
};
