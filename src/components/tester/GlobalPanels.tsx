import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../../types';
import { useKeepalive } from '../../hooks/useKeepalive';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { rawSendPolicy } from '../../lib/dangerousActions';
import { traceBitCount, traceFileName, toAscTrace, toTrcTrace } from '../../lib/traceExport';
import { downloadBlob } from '../../lib/download';
import { checkSession, manifestJson, sessionFileNames, sessionLogText, sessionManifest } from '../../lib/sessionRecord';
import { parseCustomFrame, customFrameErrorText } from '../../lib/customFrame';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, safeInt } from './shared';
import { ToolCtx } from './ToolPanels';
import {
  CAN_ID_STATUS_LED_CMD, CAN_ID_QUERY_ACTIVE_TOOL, CAN_ID_ACTIVE_TOOL_RESP,
  CAN_ID_FRAM_QUERY, CAN_ID_FRAM_STATE_RESP, CAN_ID_ERASE_FRAM, ERASE_FRAM_MAGIC,
  CAN_ID_EXPANSION_SPI_REQ, CAN_ID_EXPANSION_SPI_RESP, CAN_ID_EXPANSION_DIAG0_REQ, CAN_ID_EXPANSION_DIAG0_RESP,
  CAN_ID_EXPANSION_TYPE_RESP, CAN_ID_MLX_VARIANT_RESP, CAN_ID_FREE_TOOL_CONFIG_RESP, CAN_ID_PERIPHERAL_INFO_RESP,
  EXPANSION_BOARD_TYPES, MLX_SENSOR_VARIANTS, TOOL_NAMES,
  CAN_ID_SOLDER_SETPOINT, CAN_ID_SOLDER_TELEMETRY, CAN_ID_DRILL_CMD, CAN_ID_DRILL_TELEMETRY,
  CAN_ID_LASER_CMD, CAN_ID_LASER_TELEMETRY, CAN_ID_3DP_THERMAL_MOTION, CAN_ID_3DP_HOTEND_TELEMETRY,
  CAN_ID_AOI_TELEMETRY, CAN_ID_VACUUM_TELEMETRY
} from '../../lib/canIds';
import { THIS_HARDWARE_ID, CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE } from '../../lib/flasher';

// ---- Global Controls (0x100) ----
export const GlobalControlsPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const [statusColor, setStatusColor] = useState({ r: 0, g: 200, b: 255 });
  const [oledMode, setOledMode] = useState<'standard' | 'night' | 'standby'>('standard');
  const [ringColor, setRingColor] = useState({ r: 255, g: 255, b: 255 });
  const [ringOn, setRingOn] = useState(false);

  const send = () => {
    const oledByte = oledMode === 'standard' ? 0x00 : oledMode === 'night' ? 0x01 : 0x0F;
    ctx.sendFrame(CAN_ID_STATUS_LED_CMD, [
      statusColor.r, statusColor.g, statusColor.b, oledByte,
      ringColor.r, ringColor.g, ringColor.b, ringOn ? 1 : 0
    ], 'Global status/ring LED + OLED mode');
  };

  return (
    <Section title={t('testerglobal.global_title', 'Global Controls (0x100)')} subtitle={t('testerglobal.global_subtitle', 'Firmware-side override auto-reverts after 10s of silence - low stakes if it lapses, so this is a plain one-shot Send.')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-2">{t('testerglobal.status_led_label', 'Status LED (WS2812B)')}</div>
          <div className="flex gap-2">
            {(['r', 'g', 'b'] as const).map(ch => (
              <Field key={ch} label={ch.toUpperCase()}>
                <input type="number" min={0} max={255} value={statusColor[ch]} onChange={(e) => setStatusColor(p => ({ ...p, [ch]: safeInt(e.target.value, 0, 0, 255) }))} className={inputCls} />
              </Field>
            ))}
          </div>
          <Field label={t('testerglobal.oled_mode_label', 'OLED mode')}>
            <select value={oledMode} onChange={(e) => setOledMode(e.target.value as any)} className={inputCls}>
              <option value="standard">{t('testerglobal.oled_standard', 'Standard')}</option>
              <option value="night">{t('testerglobal.oled_night', 'Night')}</option>
              <option value="standby">{t('testerglobal.oled_standby', 'Standby')}</option>
            </select>
          </Field>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-2">{t('testerglobal.ring_led_label', 'Camera Ring LED')}</div>
          <div className="flex gap-2">
            {(['r', 'g', 'b'] as const).map(ch => (
              <Field key={ch} label={ch.toUpperCase()}>
                <input type="number" min={0} max={255} value={ringColor[ch]} onChange={(e) => setRingColor(p => ({ ...p, [ch]: safeInt(e.target.value, 0, 0, 255) }))} className={inputCls} />
              </Field>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 mt-2 cursor-pointer">
            <input type="checkbox" checked={ringOn} onChange={(e) => setRingOn(e.target.checked)} className="accent-purple-500" /> {t('testerglobal.ring_on', 'Ring on')}
          </label>
        </div>
      </div>
      <div className="mt-3">
        <button className={btnPrimaryCls} onClick={() => { try { Promise.resolve(send()).catch(() => {}); } catch { /* the message is shown below */ } }} disabled={!ctx.isConnected}>{t('testerglobal.send', 'Send')}</button>
      </div>
    </Section>
  );
};

// ---- Expansion Board (SPI + DIAG0) ----
export const ExpansionBoardPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const [txHex, setTxHex] = useState('01 02 03');
  const [spiResult, setSpiResult] = useState<string | null>(null);
  const [diag0, setDiag0] = useState<boolean | null>(null);
  const [expansionType, setExpansionType] = useState<number | null>(null);
  const [mlxVariant, setMlxVariant] = useState<number | null>(null);

  const sendSpi = async () => {
    const bytes = txHex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16)).slice(0, 7);
    const resp = await ctx.request(CAN_ID_EXPANSION_SPI_REQ, [bytes.length, ...bytes], CAN_ID_EXPANSION_SPI_RESP, 1000, 'Expansion SPI passthrough');
    if (resp) {
      const n = resp.data[0];
      setSpiResult(resp.data.slice(1, 1 + n).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
    }
  };

  const queryDiag0 = async () => {
    const resp = await ctx.request(CAN_ID_EXPANSION_DIAG0_REQ, [], CAN_ID_EXPANSION_DIAG0_RESP, 1000, 'Query TMC DIAG0');
    if (resp) setDiag0(resp.data[0] !== 0);
  };

  const queryExpansionType = async () => {
    const resp = await ctx.request(CAN_ID_EXPANSION_TYPE_RESP, [], CAN_ID_EXPANSION_TYPE_RESP, 1500, 'Query expansion board type');
    if (resp) setExpansionType(resp.data[0]);
  };
  const queryMlxVariant = async () => {
    const resp = await ctx.request(CAN_ID_MLX_VARIANT_RESP, [], CAN_ID_MLX_VARIANT_RESP, 1500, 'Query MLX sensor variant');
    if (resp) setMlxVariant(resp.data[0]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title={t('testerglobal.spi_title', 'SPI Passthrough (0x180/0x181) + TMC DIAG0 (0x182/0x183)')}>
        <div className="flex items-end gap-2 mb-2">
          <Field label={t('testerglobal.tx_bytes_label', 'TX bytes (hex, up to 7)')}><input value={txHex} onChange={(e) => setTxHex(e.target.value)} className={inputCls} /></Field>
          <button className={btnCls} onClick={sendSpi}>{t('testerglobal.send', 'Send')}</button>
        </div>
        <div className="text-xs text-slate-400 mb-3">{t('testerglobal.reply_label', 'Reply:')} <span className="font-mono text-slate-200">{spiResult ?? '--'}</span></div>
        <div className="flex items-center gap-3">
          <button className={btnCls} onClick={queryDiag0}>{t('testerglobal.query_diag0', 'Query DIAG0')}</button>
          <span className={`text-xs font-mono ${diag0 === null ? 'text-slate-500' : diag0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {diag0 === null ? '--' : diag0 ? t('testerglobal.diag0_high', 'HIGH - stall/error asserted') : t('testerglobal.diag0_low', 'LOW')}
          </span>
        </div>
      </Section>
      <Section title={t('testerglobal.identity_title', 'Board Identity (read-only)')} subtitle={t('testerglobal.identity_subtitle', 'Written from URTC Flasher - read here for diagnostics.')}>
        <div className="flex items-center gap-3 mb-2">
          <button className={btnCls} onClick={queryExpansionType}>{t('testerglobal.query_expansion_type', 'Query Expansion Type')}</button>
          <span className="text-xs font-mono text-slate-200">{expansionType !== null ? EXPANSION_BOARD_TYPES[expansionType] ?? expansionType : '--'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className={btnCls} onClick={queryMlxVariant}>{t('testerglobal.query_mlx_variant', 'Query MLX Variant')}</button>
          <span className="text-xs font-mono text-slate-200">{mlxVariant !== null ? MLX_SENSOR_VARIANTS[mlxVariant] ?? mlxVariant : '--'}</span>
        </div>
      </Section>
    </div>
  );
};

// ---- F-RAM ----
export const FramPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const confirm = useConfirmAction();
  const [state, setState] = useState<{ valid: number; toolId: number; hadError: number; temp: number; speed: number; dirOrInterlock: number; fan: number } | null>(null);

  const query = async () => {
    const resp = await ctx.request(CAN_ID_FRAM_QUERY, [], CAN_ID_FRAM_STATE_RESP, 1500, 'Query F-RAM state');
    if (resp && resp.data.length >= 8) {
      const d = resp.data;
      setState({ valid: d[0], toolId: d[1], hadError: d[2], temp: (d[3] << 8) | d[4], speed: d[5], dirOrInterlock: d[6], fan: d[7] });
    }
  };

  const erase = async () => {
    if (!(await confirm('erase_fram'))) return;
    await ctx.sendFrame(CAN_ID_ERASE_FRAM, ERASE_FRAM_MAGIC, 'Erase F-RAM');
    await query();
  };

  useEffect(() => { if (ctx.isConnected) query(); }, [ctx.isConnected]);

  return (
    <Section title={t('testerglobal.fram_title', 'F-RAM Saved State (0x190/0x191, erase 0x192)')}>
      <div className="flex items-center gap-3 mb-3">
        <button className={btnCls} onClick={query}>{t('testerglobal.query', 'Query')}</button>
        <button className={btnCls} onClick={erase}>{t('testerglobal.erase_fram', 'Erase F-RAM')}</button>
      </div>
      {state && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('testerglobal.fram_valid', 'Valid')}</div><div className="text-slate-200">{state.valid}</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('testerglobal.fram_tool_id', 'Tool ID')}</div><div className="text-slate-200">{state.toolId} ({TOOL_NAMES[state.toolId] ?? '?'})</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('testerglobal.fram_had_error', 'Had error')}</div><div className={state.hadError ? 'text-red-400' : 'text-slate-200'}>{state.hadError ? t('testerglobal.fram_had_error_yes', 'yes') : t('testerglobal.fram_had_error_no', 'no')}</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('testerglobal.fram_temp', 'Temp')}</div><div className="text-slate-200">{state.temp}</div></div>
        </div>
      )}
    </Section>
  );
};

// ---- Self test ----
const SELF_TEST_STEPS: Record<number, { run: (ctx: ToolCtx, log: (s: string) => void) => Promise<void> }> = {
  0: { run: async (ctx, log) => { const r = await ctx.request(CAN_ID_SOLDER_SETPOINT, [0, 0], CAN_ID_SOLDER_TELEMETRY, 1500, 'Self-test: soldering iron 0C'); log(r ? 'PASS: 0x135 telemetry received' : 'FAIL: no 0x135 telemetry'); } },
  5: { run: async (ctx, log) => { const r = await ctx.request(CAN_ID_DRILL_CMD, [0, 0], CAN_ID_DRILL_TELEMETRY, 1500, 'Self-test: drill 0'); log(r ? 'PASS: 0x147 telemetry received' : 'FAIL: no 0x147 telemetry'); } },
  9: { run: async (ctx, log) => { const r = await ctx.request(CAN_ID_LASER_CMD, [0, 0], CAN_ID_LASER_TELEMETRY, 1500, 'Self-test: laser 0'); log(r ? 'PASS: 0x165 telemetry received' : 'FAIL: no 0x165 telemetry'); } },
  10: { run: async (ctx, log) => { const r = await ctx.request(CAN_ID_3DP_THERMAL_MOTION, [0, 0, 0, 0, 0, 0], CAN_ID_3DP_HOTEND_TELEMETRY, 1500, 'Self-test: 3D printer 0'); log(r ? 'PASS: 0x175 telemetry received' : 'FAIL: no 0x175 telemetry'); } },
  8: { run: async (ctx, log) => { ctx.flushFrames(CAN_ID_AOI_TELEMETRY); const r = await ctx.waitForFrame(CAN_ID_AOI_TELEMETRY, 1500); log(r ? 'PASS: 0x155 seen passively' : 'INFO: no 0x155 seen (info-only, cannot force it)'); } },
  4: { run: async (ctx, log) => { ctx.flushFrames(CAN_ID_VACUUM_TELEMETRY); const r = await ctx.waitForFrame(CAN_ID_VACUUM_TELEMETRY, 1500); log(r ? 'PASS: 0x145 seen passively' : 'INFO: no 0x145 seen (info-only, cannot force it)'); } },
};

export const SelfTestPanel: React.FC<{ ctx: ToolCtx; activeToolId: number }> = ({ ctx, activeToolId }) => {
  const { t } = useTranslation();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const append = (s: string) => setLog(prev => [...prev, s]);

  const run = async () => {
    setLog([]);
    setRunning(true);
    append(`Self-test starting for tool #${activeToolId} (${TOOL_NAMES[activeToolId] ?? 'unknown'})...`);
    try {
      const toolResp = await ctx.request(CAN_ID_QUERY_ACTIVE_TOOL, [], CAN_ID_ACTIVE_TOOL_RESP, 1500, 'Self-test: query active tool');
      append(toolResp && (toolResp.data[0] & 0x1F) === activeToolId ? 'PASS: 0x111 confirms active tool ID' : 'FAIL: 0x111 tool ID mismatch or no response');

      const verResp = await ctx.request(CAN_ID_QUERY_VERSION, [0x00], CAN_ID_VERSION_RESPONSE, 1500, 'Self-test: query version');
      append(verResp ? 'PASS: 0x7F9 version response received' : 'FAIL: no 0x7F9 response');

      const specific = SELF_TEST_STEPS[activeToolId];
      if (specific) {
        await specific.run(ctx, append);
      } else if ([1, 2, 3, 6, 7, 12, 16].includes(activeToolId)) {
        append('INFO: motion tool - no telemetry by design, nothing further to check.');
      } else {
        append('INFO: no self-test steps defined for this tool yet.');
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Section title={t('testerglobal.selftest_title', 'Self-Test')} subtitle={t('testerglobal.selftest_subtitle', 'Safe, at-rest values only (0-power/0-temp) - never actuates anything beyond a stopped state.')}>
      <button className={btnPrimaryCls} onClick={run} disabled={running || !ctx.isConnected}>{running ? t('testerglobal.running', 'Running...') : t('testerglobal.run_selftest', 'Run Self-Test')}</button>
      <div className="mt-3 bg-slate-950 border border-slate-800 rounded p-3 font-mono text-[11px] text-slate-300 space-y-1 max-h-48 overflow-y-auto">
        {log.length === 0 ? <div className="text-slate-600 italic">{t('testerglobal.no_results', 'No results yet.')}</div> : log.map((l, i) => <div key={i} className={l.startsWith('FAIL') ? 'text-red-400' : l.startsWith('PASS') ? 'text-emerald-400' : 'text-slate-400'}>{l}</div>)}
      </div>
    </Section>
  );
};

// ---- Raw Bus Monitor ----
export const BusMonitorPanel: React.FC<{ ctx: ToolCtx; subscribeAll: (cb: (f: CanFrame) => void) => () => void }> = ({ ctx, subscribeAll }) => {
  const { t } = useTranslation();
  const [frames, setFrames] = useState<CanFrame[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [rate, setRate] = useState(0);
  const [bits, setBits] = useState(0);
  const countRef = useRef(0);
  const bitsRef = useRef(0);

  useEffect(() => subscribeAll((f) => {
    countRef.current++;
    bitsRef.current += traceBitCount(f.dlc);
    if (pausedRef.current) return;
    setFrames(prev => {
      const next = [f, ...prev];
      return next.length > 500 ? next.slice(0, 500) : next;
    });
  }), [subscribeAll]);

  useEffect(() => {
    const id = setInterval(() => { setRate(countRef.current); setBits(bitsRef.current); countRef.current = 0; bitsRef.current = 0; }, 1000);
    return () => clearInterval(id);
  }, []);

  // URTC's bus runs at 500 kbit/s; the load counts the real length of each frame seen in the last second.
  const busLoadPct = Math.min(100, (bits / 500000) * 100);

  const exportTrace = (format: 'trc' | 'asc') => {
    const ordered = frames.slice().reverse();
    const text = format === 'trc' ? toTrcTrace(ordered) : toAscTrace(ordered);
    downloadBlob(new Blob([text], { type: 'text/plain' }), traceFileName(format));
  };

  // A session that can be shown to be unedited: the log of the frames and a record that names it by its SHA-256 (the same record the
  // desktop Tester writes). Checking takes the record and its log together.
  const [sessionMessage, setSessionMessage] = useState('');
  const saveSession = async () => {
    if (frames.length === 0) { setSessionMessage(t('testerglobal.session_empty', 'There are no frames to save yet.')); return; }
    const names = sessionFileNames(new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '_'));
    const log = sessionLogText(frames.slice().reverse());
    const record = manifestJson(await sessionManifest(log, names.log, { studio_version: __APP_VERSION__, connected: ctx.isConnected, frames: frames.length }));
    downloadBlob(new Blob([log], { type: 'text/plain' }), names.log);
    downloadBlob(new Blob([record + '\n'], { type: 'application/json' }), names.record);
    setSessionMessage(t('testerglobal.session_saved', 'Saved {{log}} and {{record}}: the record names the log by its SHA-256.', names));
  };
  const checkSavedSession = async (files: FileList | null) => {
    const list = files ? [...files] : [];
    const record = list.find(f => f.name.endsWith('.json'));
    const log = list.find(f => f !== record);
    if (!record || !log) { setSessionMessage(t('testerglobal.session_pick_both', 'Choose the record (.json) and its log together.')); return; }
    if (record.size > 1024 * 1024 || log.size > 64 * 1024 * 1024) { setSessionMessage(t('testerglobal.session_too_big', 'The files are too big for a session.')); return; }
    const result = await checkSession(await record.text(), await log.text());
    setSessionMessage(result.ok
      ? t('testerglobal.session_ok', '{{log}} matches its record (SHA-256 and size).', { log: log.name })
      : result.reason === 'record'
        ? t('testerglobal.session_bad_record', '{{name}} is not a session record that can be read.', { name: record.name })
        : t('testerglobal.session_mismatch', '{{log}} does NOT match its record: the log was edited, or it is another one.', { log: log.name }));
  };

  return (
    <Section title={t('testerglobal.bus_title', 'Raw Bus Monitor')} subtitle={t('testerglobal.bus_subtitle', 'Every frame seen on the bus, Tx and Rx.')}>
      <div className="flex items-center gap-3 mb-3 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="accent-purple-500" /> {t('testerglobal.pause', 'Pause')}</label>
        <button className={btnCls} onClick={() => setFrames([])}>{t('testerglobal.clear', 'Clear')}</button>
        <button className={btnCls} onClick={() => exportTrace('trc')}>{t('testerglobal.export_trc', 'Export .trc')}</button>
        <button className={btnCls} onClick={() => exportTrace('asc')}>{t('testerglobal.export_asc', 'Export .asc')}</button>
        <button className={btnCls} onClick={() => { void saveSession(); }}>{t('testerglobal.session_save', 'Save the session')}</button>
        <label className={`${btnCls} cursor-pointer`}>
          {t('testerglobal.session_check', 'Check a saved session')}
          <input type="file" multiple accept=".json,.log,.txt,application/json,text/plain" className="hidden" data-testid="session-check" onChange={(e) => { void checkSavedSession(e.target.files); e.target.value = ''; }} />
        </label>
        <span className="text-slate-500">{t('testerglobal.bus_rate', '~{{rate}} fps • ~{{load}}% bus load (approx.)', { rate, load: busLoadPct.toFixed(1) })}</span>
      </div>
      {sessionMessage && <div className="text-xs text-slate-300 font-mono mb-3" data-testid="session-message">{sessionMessage}</div>}
      <div className="max-h-80 overflow-y-auto font-mono text-[10px] border border-slate-800 rounded">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-900 text-slate-500">
            <tr><th className="text-left px-2 py-1">{t('testerglobal.th_time', 'Time')}</th><th className="text-left px-2 py-1">{t('testerglobal.th_dir', 'Dir')}</th><th className="text-left px-2 py-1">{t('testerglobal.th_id', 'ID')}</th><th className="text-left px-2 py-1">{t('testerglobal.th_dlc', 'DLC')}</th><th className="text-left px-2 py-1">{t('testerglobal.th_data', 'Data')}</th></tr>
          </thead>
          <tbody>
            {frames.map((f) => (
              <tr key={f.seq} className="odd:bg-slate-950 even:bg-slate-900/50">
                <td className="px-2 py-0.5 text-slate-500">{f.timestamp}</td>
                <td className={`px-2 py-0.5 ${f.direction === 'Tx' ? 'text-amber-400' : 'text-cyan-400'}`}>{f.direction}</td>
                <td className="px-2 py-0.5 text-slate-200">{f.idHex}</td>
                <td className="px-2 py-0.5 text-slate-400">{f.dlc}</td>
                <td className="px-2 py-0.5 text-slate-300">{f.dataHex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
};

// ---- Custom frame injector ----
export const CustomFramePanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const { t } = useTranslation();
  const [idHex, setIdHex] = useState('100');
  const [dataHex, setDataHex] = useState('00 00 00 00 00 00 00 00');
  const [repeat, setRepeat] = useState(false);
  const [intervalMs, setIntervalMs] = useState(100);

  const [frameError, setFrameError] = useState('');

  const confirm = useConfirmAction();

  // Parses what was typed and applies the rules for a frame that goes to a real board: identifiers only the board transmits are refused, and the ones that write to memory, enter the bootloader or move an actuator are confirmed first.
  const prepare = async (): Promise<{ id: number; data: number[] } | null> => {
    const parsed = parseCustomFrame(idHex, dataHex);
    if (parsed.ok === false) {
      setFrameError(customFrameErrorText(t, parsed.error));
      return null;
    }
    const policy = rawSendPolicy(parsed.id);
    if (policy.kind === 'blocked') {
      setFrameError(t('confirm.raw_blocked', 'Identifier 0x{{id}} is only ever sent by the board; sending it from here would collide with the board and feed false data to the other devices on the bus.', { id: parsed.id.toString(16).toUpperCase().padStart(3, '0') }));
      return null;
    }
    setFrameError('');
    if (policy.kind === 'confirm') {
      const rawId = parsed.id.toString(16).toUpperCase().padStart(3, '0');
      const message = policy.reason === 'memory'
        ? t('confirm.raw_memory', 'Identifier 0x{{id}} writes to the non-volatile memory of the board and stays after a restart.', { id: rawId })
        : policy.reason === 'bootloader'
          ? t('confirm.raw_bootloader', 'Identifier 0x{{id}} is a bootloader command; it can leave the board in update mode until it is updated or powered off and on.', { id: rawId })
          : t('confirm.raw_actuator', 'Identifier 0x{{id}} commands an actuator; it can move, heat or fire.', { id: rawId });
      if (!(await confirm('raw_frame', { message }))) return null;
    }
    return parsed;
  };

  const sendOnce = async () => {
    const frame = await prepare();
    if (!frame) return;
    try { await ctx.sendFrame(frame.id, frame.data, 'Custom frame'); } catch { /* the banner above shows the reason */ }
  };

  // The repeated frame is the one that was approved when Repeat was checked.
  const approved = useRef<{ id: number; data: number[] } | null>(null);
  const toggleRepeat = async (on: boolean) => {
    if (!on) { setRepeat(false); return; }
    const frame = await prepare();
    if (!frame) return;
    approved.current = frame;
    setRepeat(true);
  };

  useKeepalive(repeat, Math.max(10, intervalMs), () => {
    const frame = approved.current;
    if (!frame) throw new Error('no frame approved');
    return ctx.sendFrame(frame.id, frame.data, 'Custom frame');
  }, () => setRepeat(false));

  return (
    <Section title={t('testerglobal.custom_frame_title', 'Custom Frame')}>
      <div className="flex items-end gap-2 flex-wrap">
        <Field label={t('testerglobal.id_hex_label', 'ID (hex, 0-7FF)')}><input value={idHex} onChange={(e) => setIdHex(e.target.value)} className={`${inputCls} w-24`} /></Field>
        <Field label={t('testerglobal.data_hex_label', 'Data (hex bytes)')}><input value={dataHex} onChange={(e) => setDataHex(e.target.value)} className={`${inputCls} w-64`} /></Field>
        <button className={btnPrimaryCls} onClick={sendOnce} disabled={!ctx.isConnected}>{t('testerglobal.send_once', 'Send Once')}</button>
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={repeat} onChange={(e) => { void toggleRepeat(e.target.checked); }} className="accent-purple-500" /> {t('testerglobal.repeat_every', 'Repeat every')}
        </label>
        <input type="number" min={10} max={10000} value={intervalMs} onChange={(e) => setIntervalMs(safeInt(e.target.value, 100, 10, 10000))} className={`${inputCls} w-20`} />
        <span className="text-xs text-slate-500">{t('testerglobal.ms', 'ms')}</span>
      </div>
      {frameError && <div className="mt-2 text-xs text-red-400">{frameError}</div>}
    </Section>
  );
};
