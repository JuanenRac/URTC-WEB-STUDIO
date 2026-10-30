import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, safeInt } from './shared';
import { ToolCtx } from './ToolPanels';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { downloadBlob } from '../../lib/download';
import { featuresWrite } from '../../lib/toolFrames';
import { EVIDENCE_KINDS, EVIDENCE_OUTCOMES, EvidenceEntry, evidenceCsv, evidenceRow, parseEvidenceFile, selectEvidence, summarizeEvidence } from '../../lib/evidenceHistory';
import { CAN_ID_SET_FEATURES, CAN_ID_FEATURES_RESP, CAN_ID_PID_CONFIG, CAN_ID_PID_STATE_RESP } from '../../lib/canIds';
import { PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_AUTOTUNE_START, PID_ACTION_QUERY, PID_ACTION_SET_GAINS, PID_STATE_KEYS, decodePidState, encodePidConfig } from '../../lib/pid';
import {
  BLACK_BOX_CHUNK_COUNT, BLACK_BOX_CHUNK_ID, BLACK_BOX_FRAMES_PER_CHUNK, BLACK_BOX_QUERY_ID, BlackBoxRecord,
  blackBoxChart, blackBoxCsv, blackBoxFromText, blackBoxJson, chunkRequest, joinFrames, parseBlackBox, triggerIndex,
} from '../../lib/blackBox';
import { CAN_ID_THERMAL_STATS_QUERY, CAN_ID_THERMAL_STATS_RESP } from '../../lib/generated/urtcCanIds';
import { parseThermalStats, thermalFaultTextKey } from '../../lib/thermalStats';
import { ThermalSample, addSample, faultsAdded, loadHistory, sampleOf, saveHistory, thermalHistoryChart, thermalHistoryCsv } from '../../lib/thermalHistory';
import { SimulatedRack, RACK_COMMAND_MIN_INTERVAL_MS, encodeSetPreheat, parseRackReply, unitKey } from '../../lib/rackSim';
import {
  THERMAL_CALIBRATED_CHUNK_ID, THERMAL_CALIBRATED_REQUEST_ID, THERMAL_FRAMES_PER_CHUNK, THERMAL_STATUS_ID, THERMAL_TRIGGER_ID,
  ThermalFrame, assembleThermal, syntheticThermalFrame, thermalChunkCount, thermalRegionStats, thermalRgb,
} from '../../lib/thermalView';

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
const HISTORY_CHART_WIDTH = 480;
const HISTORY_CHART_HEIGHT = 150;
const POLL_SECONDS = [10, 30, 60, 300];

/** The hours of the heater and the faults of the board over the time the counters were read. */
const ThermalHistoryView: React.FC<{ history: ThermalSample[] }> = ({ history }) => {
  const { t } = useTranslation();
  const chart = thermalHistoryChart(history, HISTORY_CHART_WIDTH, HISTORY_CHART_HEIGHT);
  const title = t('testerextras.counters_chart_title', 'Thermal counters over time');
  return (
    <div className="mb-3" data-testid="thermal-history-chart">
      <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-300 mb-1">
        <span className="text-slate-400">{title}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />{t('testerextras.counters_chart_heater', 'Heater on (hours)')}</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />{t('testerextras.counters_chart_faults', 'Faults (0 to {{max}})', { max: chart.maxFaults })}</span>
        <span className="text-slate-500">{t('testerextras.counters_chart_span', '{{minutes}} min, {{count}} readings', { minutes: (chart.spanMs / 60000).toFixed(1), count: history.length })}</span>
        <span className="text-slate-500">{t('testerextras.counters_chart_added', '{{count}} faults added', { count: faultsAdded(history) })}</span>
      </div>
      <svg viewBox={`0 0 ${HISTORY_CHART_WIDTH} ${HISTORY_CHART_HEIGHT}`} className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded" role="img" aria-label={title}>
        {chart.grid.map((g) => (
          <g key={g.y}>
            <line x1="8" x2={HISTORY_CHART_WIDTH - 8} y1={g.y} y2={g.y} stroke="#334155" strokeWidth="0.5" />
            <text x="10" y={g.y - 2} fontSize="8" fill="#64748b">{g.hours} h</text>
          </g>
        ))}
        {chart.faultMarks.map((x) => <line key={x} x1={x} x2={x} y1="8" y2={HISTORY_CHART_HEIGHT - 8} stroke="#ef4444" strokeWidth="0.6" strokeDasharray="2 2" />)}
        <polyline points={chart.faults} fill="none" stroke="#ef4444" strokeWidth="1.2" />
        <polyline points={chart.heater} fill="none" stroke="#fbbf24" strokeWidth="1.6" />
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
  const [history, setHistory] = useState<ThermalSample[]>(() => loadHistory(typeof localStorage === 'undefined' ? undefined : localStorage));
  const [pollEvery, setPollEvery] = useState<number | null>(null);
  const wasError = useRef(false);
  const readingCounters = useRef(false);

  // The lifetime thermal counters (0x1AA / 0x1AB): one question, one answer of 8 bytes.
  const readCounters = async () => {
    if (!ctx.isConnected || readingCounters.current) return;
    readingCounters.current = true;
    try {
      await readCountersOnce();
    } finally {
      readingCounters.current = false;
    }
  };
  const readCountersOnce = async () => {
    const answer = await ctx.request(CAN_ID_THERMAL_STATS_QUERY, [], CAN_ID_THERMAL_STATS_RESP, 1000, 'Thermal counters');
    const stats = answer ? parseThermalStats(answer.data) : null;
    if (!stats) { setCounters(t('testerextras.counters_no_answer', 'No answer to 0x1AA: the lifetime thermal counters need URTC firmware 0.3.3 or newer.')); return; }
    setHistory((before) => {
      const after = addSample(before, sampleOf(stats, Date.now()));
      saveHistory(typeof localStorage === 'undefined' ? undefined : localStorage, after);
      return after;
    });
    const last = stats.lastFault === 0
      ? t('testerextras.counters_none', 'none')
      : t(thermalFaultTextKey(stats), 'fault {{n}}', { n: stats.lastFault });
    const line = t('testerextras.counters_text', 'Thermal runaway faults ever: {{faults}} | Heater on: {{hours}} h | Last fault: {{last}}', { faults: stats.faultCount, hours: stats.heaterOnHours.toFixed(2), last });
    setCounters(stats.persisted ? line : `${line}\n${t('testerextras.counters_not_persisted', 'F-RAM not answering: the counters are RAM-only since the last boot.')}`);
  };

  // Read the counters again every so often while the board is connected, for the history; off until the person asks.
  const readCountersLatest = useRef(readCounters);
  readCountersLatest.current = readCounters;
  useEffect(() => {
    if (pollEvery === null || !ctx.isConnected) return;
    const timer = setInterval(() => { void readCountersLatest.current(); }, pollEvery * 1000);
    return () => clearInterval(timer);
  }, [pollEvery, ctx.isConnected]);
  const clearHistory = () => { setHistory([]); saveHistory(typeof localStorage === 'undefined' ? undefined : localStorage, []); };

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
        <label className="flex items-center gap-2 text-xs text-slate-300">
          {t('testerextras.counters_poll', 'Read them again every')}
          <select className={inputCls} data-testid="thermal-poll" value={pollEvery ?? ''} onChange={(e) => setPollEvery(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">{t('testerextras.counters_poll_off', 'never')}</option>
            {POLL_SECONDS.map((s) => <option key={s} value={s}>{t('testerextras.counters_poll_seconds', '{{n}} s', { n: s })}</option>)}
          </select>
        </label>
        <button className={btnCls} disabled={history.length === 0} onClick={() => downloadBlob(new Blob([thermalHistoryCsv(history)], { type: 'text/csv' }), `urtc_thermal_counters_${stamp()}.csv`)}>{t('testerextras.black_csv', 'Download CSV')}</button>
        <button className={btnCls} disabled={history.length === 0} onClick={clearHistory}>{t('testerextras.counters_clear', 'Clear the history')}</button>
      </div>
      {counters && <div className="text-xs text-slate-300 font-mono mb-3 whitespace-pre-line" data-testid="thermal-counters">{counters}</div>}
      {history.length >= 2
        ? <ThermalHistoryView history={history} />
        : history.length === 1 && <div className="text-xs text-slate-500 font-mono mb-3">{t('testerextras.counters_chart_need_two', 'The chart appears from the second reading.')}</div>}
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
    const r = await ctx.request(CAN_ID_SET_FEATURES, featuresWrite(mask), CAN_ID_FEATURES_RESP, 1000, 'Write optional functions');
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
    // the reason is read back from the reply frame, as a program that listens to the rack would read it
    const parsed = parseRackReply(reply.frame);
    const words: Record<string, string> = {
      applied: t('testerextras.rack_reply_applied', 'applied'), repeat: t('testerextras.rack_reply_repeat', 'already applied (repeat)'),
      wrong_length: t('testerextras.rack_reply_wrong_length', 'refused: wrong data length'), tool_absent: t('testerextras.rack_reply_tool_absent', 'refused: the slot holds no tool'),
      temp_out_of_range: t('testerextras.rack_reply_temp_out_of_range', 'refused: temperature above the limit'), tool_invalid: t('testerextras.rack_reply_tool_invalid', 'refused: not a valid tool number'),
      not_heatable: t('testerextras.rack_reply_not_heatable', 'refused: this tool has no heater'), held_rate: t('testerextras.rack_reply_held_rate', 'held: too soon after the previous command, send it again later'),
      unknown_command: t('testerextras.rack_reply_unknown_command', 'refused: the rack does not know this command'),
    };
    const said = parsed ? ` - ${words[parsed.reason]}` : '';
    return `${reply.kind.toUpperCase()}${reply.action !== 'none' ? ` ${reply.action}` : ''}${reply.detail ? ` (${reply.detail})` : ''}${said}`;
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


// ---- History of the evidence (the records the flasher, the tester and the updater write) ----
const EVIDENCE_FILE_LIMIT = 500;
const EVIDENCE_SIZE_LIMIT = 8_000_000;

export const EvidenceHistoryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [kind, setKind] = useState('');
  const [outcome, setOutcome] = useState('');
  const [text, setText] = useState('');
  const [onlyInvalid, setOnlyInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    const all: EvidenceEntry[] = [];
    for (const file of Array.from(files).slice(0, EVIDENCE_FILE_LIMIT)) {
      if (file.size > EVIDENCE_SIZE_LIMIT) { all.push({ file: file.name, line: 0, record: {}, problems: [`the file is bigger than ${EVIDENCE_SIZE_LIMIT} bytes and was not read`], valid: false, time: '' }); continue; }
      all.push(...await parseEvidenceFile(file.name, await file.text()));
    }
    setEntries(all);
    setBusy(false);
  };

  const shown = selectEvidence(entries, { kind: kind || undefined, outcome: outcome || undefined, text: text || undefined, onlyInvalid });
  const summary = summarizeEvidence(entries);
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);

  return (
    <Section title={t('testerextras.evidence_title', 'History of the evidence')} subtitle={t('testerextras.evidence_subtitle', 'The records (urtc-evidence/1) that the flasher, the tester and the updater write: each one is checked and the list shows the newest first. Nothing is uploaded: the files are read in this page.')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Field label={t('testerextras.evidence_choose', 'Choose the evidence files (.json, .jsonl)')}><input type="file" multiple accept=".json,.jsonl,application/json" disabled={busy} onChange={(e) => { void load(e.target.files); }} className={inputCls} /></Field>
        <Field label={t('testerextras.evidence_kind', 'Kind')}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            <option value="">{t('testerextras.evidence_all', 'all')}</option>
            {EVIDENCE_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label={t('testerextras.evidence_outcome', 'Outcome')}>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputCls}>
            <option value="">{t('testerextras.evidence_all', 'all')}</option>
            {EVIDENCE_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label={t('testerextras.evidence_search', 'Search')}><input type="text" value={text} onChange={(e) => setText(e.target.value)} className={inputCls} /></Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mb-3">
        <input type="checkbox" checked={onlyInvalid} onChange={(e) => setOnlyInvalid(e.target.checked)} className="accent-purple-500" /> {t('testerextras.evidence_only_invalid', 'Only the records that are not valid')}
      </label>
      <div className="text-xs text-slate-300 font-mono mb-2">{t('testerextras.evidence_summary', '{{records}} records, {{valid}} valid, {{invalid}} not valid', { records: summary.records, valid: summary.valid, invalid: summary.invalid })}</div>
      <div className="flex gap-3 mb-3">
        <button className={btnCls} disabled={shown.length === 0} onClick={() => downloadBlob(new Blob([evidenceCsv(shown)], { type: 'text/csv' }), `urtc_evidence_history_${stamp()}.csv`)}>{t('testerextras.evidence_csv', 'Download the list (CSV)')}</button>
      </div>
      {shown.length === 0
        ? <div className="text-xs text-slate-500">{t('testerextras.evidence_empty', 'No records')}</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono text-slate-300">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pr-3">{t('testerextras.evidence_col_time', 'Time (UTC)')}</th><th className="pr-3">{t('testerextras.evidence_kind', 'Kind')}</th><th className="pr-3">{t('testerextras.evidence_outcome', 'Outcome')}</th>
                  <th className="pr-3">{t('testerextras.evidence_col_tool', 'Tool')}</th><th className="pr-3">{t('testerextras.evidence_col_subject', 'Board')}</th><th className="pr-3">{t('testerextras.evidence_col_versions', 'Versions')}</th>
                  <th>{t('testerextras.evidence_col_file', 'File')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, index) => {
                  const row = evidenceRow(entry);
                  return (
                    <React.Fragment key={`${entry.file}:${entry.line}:${index}`}>
                      <tr className={entry.valid ? '' : 'text-red-400'}>
                        <td className="pr-3">{row.time || '-'}</td><td className="pr-3">{row.kind || '-'}</td><td className="pr-3">{row.outcome || '-'}</td><td className="pr-3">{row.tool || '-'}</td>
                        <td className="pr-3">{row.subject}</td><td className="pr-3">{row.versionAfter ? `${row.versionBefore || '?'} -> ${row.versionAfter}` : row.versionBefore}</td>
                        <td>{row.file}{entry.valid ? '' : ` [${t('testerextras.evidence_not_valid', 'NOT VALID')}]`}</td>
                      </tr>
                      {entry.problems.map(problem => <tr key={problem} className="text-red-400"><td colSpan={7} className="pl-4">{problem}</td></tr>)}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </Section>
  );
};
