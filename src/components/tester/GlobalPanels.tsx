import React, { useEffect, useRef, useState } from 'react';
import { CanFrame } from '../../types';
import { useKeepalive } from '../../hooks/useKeepalive';
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
    <Section title="Global Controls (0x100)" subtitle="Firmware-side override auto-reverts after 10s of silence - low stakes if it lapses, so this is a plain one-shot Send.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-2">Status LED (WS2812B)</div>
          <div className="flex gap-2">
            {(['r', 'g', 'b'] as const).map(ch => (
              <Field key={ch} label={ch.toUpperCase()}>
                <input type="number" min={0} max={255} value={statusColor[ch]} onChange={(e) => setStatusColor(p => ({ ...p, [ch]: safeInt(e.target.value, 0, 0, 255) }))} className={inputCls} />
              </Field>
            ))}
          </div>
          <Field label="OLED mode">
            <select value={oledMode} onChange={(e) => setOledMode(e.target.value as any)} className={inputCls}>
              <option value="standard">Standard</option>
              <option value="night">Night</option>
              <option value="standby">Standby</option>
            </select>
          </Field>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-2">Camera Ring LED</div>
          <div className="flex gap-2">
            {(['r', 'g', 'b'] as const).map(ch => (
              <Field key={ch} label={ch.toUpperCase()}>
                <input type="number" min={0} max={255} value={ringColor[ch]} onChange={(e) => setRingColor(p => ({ ...p, [ch]: safeInt(e.target.value, 0, 0, 255) }))} className={inputCls} />
              </Field>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 mt-2 cursor-pointer">
            <input type="checkbox" checked={ringOn} onChange={(e) => setRingOn(e.target.checked)} className="accent-purple-500" /> Ring on
          </label>
        </div>
      </div>
      <div className="mt-3">
        <button className={btnPrimaryCls} onClick={send} disabled={!ctx.isConnected}>Send</button>
      </div>
    </Section>
  );
};

// ---- Expansion Board (SPI + DIAG0) ----
export const ExpansionBoardPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [txHex, setTxHex] = useState('01 02 03');
  const [spiResult, setSpiResult] = useState<string | null>(null);
  const [diag0, setDiag0] = useState<boolean | null>(null);
  const [expansionType, setExpansionType] = useState<number | null>(null);
  const [mlxVariant, setMlxVariant] = useState<number | null>(null);

  const sendSpi = async () => {
    const bytes = txHex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16)).slice(0, 7);
    await ctx.sendFrame(CAN_ID_EXPANSION_SPI_REQ, [bytes.length, ...bytes], 'Expansion SPI passthrough');
    const resp = await ctx.waitForFrame(CAN_ID_EXPANSION_SPI_RESP, 1000);
    if (resp) {
      const n = resp.data[0];
      setSpiResult(resp.data.slice(1, 1 + n).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
    }
  };

  const queryDiag0 = async () => {
    await ctx.sendFrame(CAN_ID_EXPANSION_DIAG0_REQ, [], 'Query TMC DIAG0');
    const resp = await ctx.waitForFrame(CAN_ID_EXPANSION_DIAG0_RESP, 1000);
    if (resp) setDiag0(resp.data[0] !== 0);
  };

  const queryExpansionType = async () => {
    await ctx.sendFrame(CAN_ID_EXPANSION_TYPE_RESP, [], 'Query expansion board type');
    const resp = await ctx.waitForFrame(CAN_ID_EXPANSION_TYPE_RESP, 1500);
    if (resp) setExpansionType(resp.data[0]);
  };
  const queryMlxVariant = async () => {
    await ctx.sendFrame(CAN_ID_MLX_VARIANT_RESP, [], 'Query MLX sensor variant');
    const resp = await ctx.waitForFrame(CAN_ID_MLX_VARIANT_RESP, 1500);
    if (resp) setMlxVariant(resp.data[0]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="SPI Passthrough (0x180/0x181) + TMC DIAG0 (0x182/0x183)">
        <div className="flex items-end gap-2 mb-2">
          <Field label="TX bytes (hex, up to 7)"><input value={txHex} onChange={(e) => setTxHex(e.target.value)} className={inputCls} /></Field>
          <button className={btnCls} onClick={sendSpi}>Send</button>
        </div>
        <div className="text-xs text-slate-400 mb-3">Reply: <span className="font-mono text-slate-200">{spiResult ?? '--'}</span></div>
        <div className="flex items-center gap-3">
          <button className={btnCls} onClick={queryDiag0}>Query DIAG0</button>
          <span className={`text-xs font-mono ${diag0 === null ? 'text-slate-500' : diag0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {diag0 === null ? '--' : diag0 ? 'HIGH - stall/error asserted' : 'LOW'}
          </span>
        </div>
      </Section>
      <Section title="Board Identity (read-only)" subtitle="Written from URTC Flasher - read here for diagnostics.">
        <div className="flex items-center gap-3 mb-2">
          <button className={btnCls} onClick={queryExpansionType}>Query Expansion Type</button>
          <span className="text-xs font-mono text-slate-200">{expansionType !== null ? EXPANSION_BOARD_TYPES[expansionType] ?? expansionType : '--'}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className={btnCls} onClick={queryMlxVariant}>Query MLX Variant</button>
          <span className="text-xs font-mono text-slate-200">{mlxVariant !== null ? MLX_SENSOR_VARIANTS[mlxVariant] ?? mlxVariant : '--'}</span>
        </div>
      </Section>
    </div>
  );
};

// ---- F-RAM ----
export const FramPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [state, setState] = useState<{ valid: number; toolId: number; hadError: number; temp: number; speed: number; dirOrInterlock: number; fan: number } | null>(null);

  const query = async () => {
    await ctx.sendFrame(CAN_ID_FRAM_QUERY, [], 'Query F-RAM state');
    const resp = await ctx.waitForFrame(CAN_ID_FRAM_STATE_RESP, 1500);
    if (resp && resp.data.length >= 8) {
      const d = resp.data;
      setState({ valid: d[0], toolId: d[1], hadError: d[2], temp: (d[3] << 8) | d[4], speed: d[5], dirOrInterlock: d[6], fan: d[7] });
    }
  };

  const erase = async () => {
    if (!window.confirm('Erase F-RAM saved state? This wipes the board\'s persisted tool setpoints.')) return;
    await ctx.sendFrame(CAN_ID_ERASE_FRAM, ERASE_FRAM_MAGIC, 'Erase F-RAM');
    await query();
  };

  useEffect(() => { if (ctx.isConnected) query(); }, [ctx.isConnected]);

  return (
    <Section title="F-RAM Saved State (0x190/0x191, erase 0x192)">
      <div className="flex items-center gap-3 mb-3">
        <button className={btnCls} onClick={query}>Query</button>
        <button className={btnCls} onClick={erase}>Erase F-RAM</button>
      </div>
      {state && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Valid</div><div className="text-slate-200">{state.valid}</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Tool ID</div><div className="text-slate-200">{state.toolId} ({TOOL_NAMES[state.toolId] ?? '?'})</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Had error</div><div className={state.hadError ? 'text-red-400' : 'text-slate-200'}>{state.hadError ? 'yes' : 'no'}</div></div>
          <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Temp</div><div className="text-slate-200">{state.temp}</div></div>
        </div>
      )}
    </Section>
  );
};

// ---- Self test ----
const SELF_TEST_STEPS: Record<number, { run: (ctx: ToolCtx, log: (s: string) => void) => Promise<void> }> = {
  0: { run: async (ctx, log) => { await ctx.sendFrame(CAN_ID_SOLDER_SETPOINT, [0, 0], 'Self-test: soldering iron 0C'); const r = await ctx.waitForFrame(CAN_ID_SOLDER_TELEMETRY, 1500); log(r ? 'PASS: 0x135 telemetry received' : 'FAIL: no 0x135 telemetry'); } },
  5: { run: async (ctx, log) => { await ctx.sendFrame(CAN_ID_DRILL_CMD, [0, 0], 'Self-test: drill 0'); const r = await ctx.waitForFrame(CAN_ID_DRILL_TELEMETRY, 1500); log(r ? 'PASS: 0x147 telemetry received' : 'FAIL: no 0x147 telemetry'); } },
  9: { run: async (ctx, log) => { await ctx.sendFrame(CAN_ID_LASER_CMD, [0, 0], 'Self-test: laser 0'); const r = await ctx.waitForFrame(CAN_ID_LASER_TELEMETRY, 1500); log(r ? 'PASS: 0x165 telemetry received' : 'FAIL: no 0x165 telemetry'); } },
  10: { run: async (ctx, log) => { await ctx.sendFrame(CAN_ID_3DP_THERMAL_MOTION, [0, 0, 0, 0, 0, 0], 'Self-test: 3D printer 0'); const r = await ctx.waitForFrame(CAN_ID_3DP_HOTEND_TELEMETRY, 1500); log(r ? 'PASS: 0x175 telemetry received' : 'FAIL: no 0x175 telemetry'); } },
  8: { run: async (ctx, log) => { const r = await ctx.waitForFrame(CAN_ID_AOI_TELEMETRY, 1500); log(r ? 'PASS: 0x155 seen passively' : 'INFO: no 0x155 seen (info-only, cannot force it)'); } },
  4: { run: async (ctx, log) => { const r = await ctx.waitForFrame(CAN_ID_VACUUM_TELEMETRY, 1500); log(r ? 'PASS: 0x145 seen passively' : 'INFO: no 0x145 seen (info-only, cannot force it)'); } },
};

export const SelfTestPanel: React.FC<{ ctx: ToolCtx; activeToolId: number }> = ({ ctx, activeToolId }) => {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const append = (s: string) => setLog(prev => [...prev, s]);

  const run = async () => {
    setLog([]);
    setRunning(true);
    append(`Self-test starting for tool #${activeToolId} (${TOOL_NAMES[activeToolId] ?? 'unknown'})...`);
    try {
      await ctx.sendFrame(CAN_ID_QUERY_ACTIVE_TOOL, [], 'Self-test: query active tool');
      const toolResp = await ctx.waitForFrame(CAN_ID_ACTIVE_TOOL_RESP, 1500);
      append(toolResp && (toolResp.data[0] & 0x1F) === activeToolId ? 'PASS: 0x111 confirms active tool ID' : 'FAIL: 0x111 tool ID mismatch or no response');

      await ctx.sendFrame(CAN_ID_QUERY_VERSION, [0x00], 'Self-test: query version');
      const verResp = await ctx.waitForFrame(CAN_ID_VERSION_RESPONSE, 1500);
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
    <Section title="Self-Test" subtitle="Safe, at-rest values only (0-power/0-temp) - never actuates anything beyond a stopped state.">
      <button className={btnPrimaryCls} onClick={run} disabled={running || !ctx.isConnected}>{running ? 'Running...' : 'Run Self-Test'}</button>
      <div className="mt-3 bg-slate-950 border border-slate-800 rounded p-3 font-mono text-[11px] text-slate-300 space-y-1 max-h-48 overflow-y-auto">
        {log.length === 0 ? <div className="text-slate-600 italic">No results yet.</div> : log.map((l, i) => <div key={i} className={l.startsWith('FAIL') ? 'text-red-400' : l.startsWith('PASS') ? 'text-emerald-400' : 'text-slate-400'}>{l}</div>)}
      </div>
    </Section>
  );
};

// ---- Raw Bus Monitor ----
export const BusMonitorPanel: React.FC<{ ctx: ToolCtx; subscribeAll: (cb: (f: CanFrame) => void) => () => void }> = ({ ctx, subscribeAll }) => {
  const [frames, setFrames] = useState<CanFrame[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [rate, setRate] = useState(0);
  const countRef = useRef(0);

  useEffect(() => subscribeAll((f) => {
    countRef.current++;
    if (pausedRef.current) return;
    setFrames(prev => {
      const next = [f, ...prev];
      return next.length > 500 ? next.slice(0, 500) : next;
    });
  }), [subscribeAll]);

  useEffect(() => {
    const id = setInterval(() => { setRate(countRef.current); countRef.current = 0; }, 1000);
    return () => clearInterval(id);
  }, []);

  const busLoadPct = Math.min(100, (rate * (47 + 8 * 4) / 500000) * 100);

  const exportTrace = (format: 'trc' | 'asc') => {
    const lines = frames.slice().reverse().map((f, i) => {
      if (format === 'trc') return `${i + 1})  ${f.timestamp}  Rx  ${f.idHex}  ${f.dlc}  ${f.dataHex}`;
      return `${f.timestamp} 1  ${f.idHex.replace('0x', '')}x  Rx  d ${f.dlc} ${f.dataHex}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urtc_bus_trace.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section title="Raw Bus Monitor" subtitle="Every frame seen on the bus, Tx and Rx.">
      <div className="flex items-center gap-3 mb-3 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="accent-purple-500" /> Pause</label>
        <button className={btnCls} onClick={() => setFrames([])}>Clear</button>
        <button className={btnCls} onClick={() => exportTrace('trc')}>Export .trc</button>
        <button className={btnCls} onClick={() => exportTrace('asc')}>Export .asc</button>
        <span className="text-slate-500">~{rate} fps &bull; ~{busLoadPct.toFixed(1)}% bus load (approx.)</span>
      </div>
      <div className="max-h-80 overflow-y-auto font-mono text-[10px] border border-slate-800 rounded">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-900 text-slate-500">
            <tr><th className="text-left px-2 py-1">Time</th><th className="text-left px-2 py-1">Dir</th><th className="text-left px-2 py-1">ID</th><th className="text-left px-2 py-1">DLC</th><th className="text-left px-2 py-1">Data</th></tr>
          </thead>
          <tbody>
            {frames.map((f, i) => (
              <tr key={i} className="odd:bg-slate-950 even:bg-slate-900/50">
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
  const [idHex, setIdHex] = useState('100');
  const [dataHex, setDataHex] = useState('00 00 00 00 00 00 00 00');
  const [repeat, setRepeat] = useState(false);
  const [intervalMs, setIntervalMs] = useState(100);

  const send = () => {
    const id = parseInt(idHex, 16) & 0x7FF;
    const data = dataHex.trim().split(/\s+/).filter(Boolean).slice(0, 8).map(h => parseInt(h, 16));
    return ctx.sendFrame(id, data, 'Custom frame');
  };

  useKeepalive(repeat, Math.max(10, intervalMs), send);

  return (
    <Section title="Custom Frame">
      <div className="flex items-end gap-2 flex-wrap">
        <Field label="ID (hex, 0-7FF)"><input value={idHex} onChange={(e) => setIdHex(e.target.value)} className={`${inputCls} w-24`} /></Field>
        <Field label="Data (hex bytes)"><input value={dataHex} onChange={(e) => setDataHex(e.target.value)} className={`${inputCls} w-64`} /></Field>
        <button className={btnPrimaryCls} onClick={send} disabled={!ctx.isConnected}>Send Once</button>
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="accent-purple-500" /> Repeat every
        </label>
        <input type="number" min={10} max={10000} value={intervalMs} onChange={(e) => setIntervalMs(safeInt(e.target.value, 100, 10, 10000))} className={`${inputCls} w-20`} />
        <span className="text-xs text-slate-500">ms</span>
      </div>
    </Section>
  );
};
