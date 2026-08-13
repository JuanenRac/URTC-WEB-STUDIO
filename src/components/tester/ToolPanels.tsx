import React, { useEffect, useState } from 'react';
import { CanFrame } from '../../types';
import { useKeepalive } from '../../hooks/useKeepalive';
import { Section, Field, inputCls, btnCls, btnPrimaryCls, KeepaliveCheckbox, LiveGraph, safeInt } from './shared';
import {
  CAN_ID_MOTION_CMD,
  CAN_ID_SOLDER_SETPOINT, CAN_ID_SOLDER_TELEMETRY, CAN_ID_SOLDER_FEEDER_RESET, CAN_ID_SOLDER_FEEDER_QUERY, SOLDER_FEEDER_RESET_MAGIC,
  CAN_ID_VACUUM_TELEMETRY,
  CAN_ID_DRILL_CMD, CAN_ID_DRILL_TELEMETRY,
  CAN_ID_AOI_CMD, CAN_ID_AOI_TELEMETRY,
  CAN_ID_LASER_CMD, CAN_ID_LASER_TELEMETRY,
  CAN_ID_3DP_THERMAL_MOTION, CAN_ID_3DP_HOTEND_TELEMETRY, CAN_ID_3DP_LAYERFAN_CMD, CAN_ID_3DP_LAYERFAN_TELEMETRY,
  CAN_ID_3DP_HOTENDFAN_CMD, CAN_ID_3DP_HOTENDFAN_TELEMETRY,
  CAN_ID_IMPACT_EVENT,
  CAN_ID_ELECTROMAGNET_CMD,
  CAN_ID_WELD_SPOT_CMD, CAN_ID_WELD_ULTRASONIC_CMD, WELD_PULSE_MAX_MS,
  CAN_ID_UV_CURING_CMD,
  CAN_ID_HOTAIR_CMD,
  CAN_ID_CRIMPING_CMD,
  CAN_ID_PASTE_JETTING_CONFIG, CAN_ID_PASTE_JETTING_PULSE,
  CAN_ID_FLYING_PROBE_BASIC, CAN_ID_FLYING_PROBE_ADS_CONFIG, CAN_ID_FLYING_PROBE_ADS_TRIGGER, CAN_ID_FLYING_PROBE_ADS_RESULT,
  CAN_ID_THERMAL_TRIGGER, CAN_ID_THERMAL_STATUS, CAN_ID_THERMAL_CAL_CHUNK_REQ, CAN_ID_THERMAL_CAL_CHUNK_RESP, THERMAL_CHUNK_COUNT,
  KEEPALIVE_INTERVAL_MS, LAYERFAN_KEEPALIVE_INTERVAL_MS
} from '../../lib/canIds';

export interface ToolCtx {
  sendFrame: (id: number, data: number[], description?: string) => Promise<void>;
  waitForFrame: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
  subscribe: (id: number, cb: (f: CanFrame) => void) => () => void;
  isConnected: boolean;
}

function useTelemetry(ctx: ToolCtx, id: number, decode: (d: number[]) => number | null): number | null {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => ctx.subscribe(id, (f) => {
    const v = decode(f.data);
    if (v !== null) setValue(v);
  }), [ctx, id]);
  return value;
}

// ---- Tool 0: Soldering Iron ----
export const SolderingIronPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [active, setActive] = useState(false);
  const [temp, setTemp] = useState(220);
  const [dir, setDir] = useState<'fwd' | 'rev'>('fwd');
  const [steps, setSteps] = useState(200);
  const [position, setPosition] = useState<number | null>(null);
  const liveTemp = useTelemetry(ctx, CAN_ID_SOLDER_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);

  useKeepalive(active, KEEPALIVE_INTERVAL_MS, () => ctx.sendFrame(CAN_ID_SOLDER_SETPOINT, [(temp >> 8) & 0xFF, temp & 0xFF], `Soldering iron setpoint ${temp}C`), () => setActive(false));

  const stopHeater = () => { setActive(false); ctx.sendFrame(CAN_ID_SOLDER_SETPOINT, [0, 0], 'Soldering iron off'); };
  const queryPosition = async () => {
    await ctx.sendFrame(CAN_ID_SOLDER_FEEDER_QUERY, [], 'Query feeder position');
    const resp = await ctx.waitForFrame(CAN_ID_SOLDER_FEEDER_QUERY, 1500);
    if (resp && resp.data.length >= 4) {
      const raw = (resp.data[0] << 24) | (resp.data[1] << 16) | (resp.data[2] << 8) | resp.data[3];
      setPosition(raw | 0);
    }
  };
  useEffect(() => { if (ctx.isConnected) queryPosition(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Heater (0x130 / telemetry 0x135)">
        <div className="flex items-end gap-3">
          <Field label="Setpoint (0-450 C)">
            <input type="number" min={0} max={450} value={temp} onChange={(e) => setTemp(safeInt(e.target.value, 0, 0, 450))} className={inputCls} />
          </Field>
          <KeepaliveCheckbox checked={active} onChange={(v) => { setActive(v); if (!v) stopHeater(); }} watchdogMs={250} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">Live: <span className="text-purple-300 font-mono">{liveTemp ?? '--'} C</span></span>
        </div>
        <LiveGraph value={liveTemp} yMax={450} />
      </Section>

      <Section title="Wire Feeder (0x120 motion, 0x131/0x132 position)">
        <div className="flex items-end gap-3 mb-3">
          <Field label="Direction">
            <select value={dir} onChange={(e) => setDir(e.target.value as any)} className={inputCls}>
              <option value="fwd">Forward</option>
              <option value="rev">Reverse</option>
            </select>
          </Field>
          <Field label="Steps">
            <input type="number" min={1} value={steps} onChange={(e) => setSteps(safeInt(e.target.value, 1, 1))} className={inputCls} />
          </Field>
          <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_MOTION_CMD, [dir === 'fwd' ? 1 : 0, (steps >>> 24) & 0xFF, (steps >>> 16) & 0xFF, (steps >>> 8) & 0xFF, steps & 0xFF], 'Move feeder')}>Move</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Position: <span className="font-mono text-slate-200">{position ?? '--'}</span></span>
          <button className={btnCls} onClick={queryPosition}>Query</button>
          <button className={btnCls} onClick={() => { if (window.confirm('Reset feeder position to 0?')) ctx.sendFrame(CAN_ID_SOLDER_FEEDER_RESET, SOLDER_FEEDER_RESET_MAGIC, 'Reset feeder position'); }}>Reset</button>
        </div>
      </Section>
    </div>
  );
};

// ---- Motion tools (1,2,3,6,7,12,16) + Crimping (21, different ID) ----
export const MotionPanel: React.FC<{ ctx: ToolCtx; cmdId: number; label: string }> = ({ ctx, cmdId, label }) => {
  const [dir, setDir] = useState<'fwd' | 'rev'>('fwd');
  const [steps, setSteps] = useState(200);
  return (
    <Section title={`${label} (0x${cmdId.toString(16)})`} subtitle="One-shot move, no telemetry, no comms watchdog.">
      <div className="flex items-end gap-3">
        <Field label="Direction">
          <select value={dir} onChange={(e) => setDir(e.target.value as any)} className={inputCls}>
            <option value="fwd">Forward</option>
            <option value="rev">Reverse</option>
          </select>
        </Field>
        <Field label="Steps">
          <input type="number" min={1} value={steps} onChange={(e) => setSteps(safeInt(e.target.value, 1, 1))} className={inputCls} />
        </Field>
        <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(cmdId, [dir === 'fwd' ? 1 : 0, (steps >>> 24) & 0xFF, (steps >>> 16) & 0xFF, (steps >>> 8) & 0xFF, steps & 0xFF], `Move (${label})`)}>Move</button>
      </div>
    </Section>
  );
};

// ---- Tool 4: Vacuum Pickup (telemetry only) ----
export const VacuumPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [adc, setAdc] = useState<number | null>(null);
  const [detected, setDetected] = useState<boolean>(false);
  useEffect(() => ctx.subscribe(CAN_ID_VACUUM_TELEMETRY, (f) => {
    if (f.data.length >= 3) { setAdc((f.data[0] << 8) | f.data[1]); setDetected(f.data[2] !== 0); }
  }), [ctx]);
  return (
    <Section title="Vacuum Pickup (0x145, telemetry only)" subtitle="Passively pushed by the firmware - no command to send.">
      <div className="flex gap-6 text-xs">
        <div>ADC: <span className="font-mono text-slate-200">{adc ?? '--'}</span></div>
        <div>Part detected: <span className={`font-mono ${detected ? 'text-emerald-400' : 'text-slate-500'}`}>{detected ? 'YES' : 'no'}</span></div>
      </div>
    </Section>
  );
};

// ---- Tool 5: Drill ----
export const DrillPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [speed, setSpeed] = useState(0);
  const [dir, setDir] = useState<'cw' | 'ccw'>('cw');
  const telemetry = useTelemetry(ctx, CAN_ID_DRILL_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);
  const [endstop, setEndstop] = useState<number | null>(null);
  useEffect(() => ctx.subscribe(CAN_ID_DRILL_TELEMETRY, (f) => { if (f.data.length >= 3) setEndstop(f.data[2]); }), [ctx]);
  return (
    <Section title="Drill (0x140 / telemetry 0x147)" subtitle="One-shot send, no watchdog - the board holds the last value.">
      <div className="flex items-end gap-3 mb-3">
        <Field label={`Speed (${speed})`}>
          <input type="range" min={0} max={255} value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="w-40" />
        </Field>
        <Field label="Direction">
          <select value={dir} onChange={(e) => setDir(e.target.value as any)} className={inputCls}>
            <option value="cw">Clockwise</option>
            <option value="ccw">Counter-clockwise</option>
          </select>
        </Field>
        <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_DRILL_CMD, [speed, dir === 'ccw' ? 1 : 0], 'Drill command')}>Send</button>
        <button className={btnCls} onClick={() => { setSpeed(0); ctx.sendFrame(CAN_ID_DRILL_CMD, [0, 0], 'Drill stop'); }}>Stop</button>
      </div>
      <div className="text-xs text-slate-400">RPM: <span className="font-mono text-slate-200">{telemetry ?? '--'}</span> &bull; Endstop: <span className="font-mono text-slate-200">{endstop ?? '--'}</span></div>
    </Section>
  );
};

// ---- Tool 8: AOI Inspection ----
export const AoiPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [mode, setMode] = useState<'off' | 'sync' | 'fixed'>('off');
  const [period, setPeriod] = useState(1000);
  const endstop = useTelemetry(ctx, CAN_ID_AOI_TELEMETRY, (d) => d.length >= 1 ? d[0] : null);
  const modeByte = mode === 'off' ? 0 : mode === 'sync' ? 1 : 2;
  return (
    <Section title="AOI Inspection (0x150 / telemetry 0x155)" subtitle="Ring color comes from the global 0x100 command - this only sets mode/strobe.">
      <div className="flex items-end gap-3">
        <Field label="Ring Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} className={inputCls}>
            <option value="off">Off</option>
            <option value="sync">Synchronous strobe</option>
            <option value="fixed">Fixed continuous</option>
          </select>
        </Field>
        <Field label="Strobe period (us)">
          <input type="number" min={1} max={65535} value={period} onChange={(e) => setPeriod(safeInt(e.target.value, 1, 1, 65535))} className={inputCls} />
        </Field>
        <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_AOI_CMD, [modeByte, (period >> 8) & 0xFF, period & 0xFF], 'AOI ring command')}>Send</button>
      </div>
      <div className="mt-2 text-xs text-slate-400">Endstop: <span className="font-mono text-slate-200">{endstop ?? '--'}</span></div>
    </Section>
  );
};

// ---- Tool 9: Laser Engraver ----
export const LaserPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [active, setActive] = useState(false);
  const [power, setPower] = useState(0);
  const [interlock, setInterlock] = useState(false);
  const endstop = useTelemetry(ctx, CAN_ID_LASER_TELEMETRY, (d) => d.length >= 1 ? d[0] : null);

  useKeepalive(active, KEEPALIVE_INTERVAL_MS, () => ctx.sendFrame(CAN_ID_LASER_CMD, [power, interlock ? 1 : 0], 'Laser power command'), () => setActive(false));

  return (
    <Section title="Laser Engraver (0x160 / telemetry 0x165)">
      <div className="p-2 mb-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">Interlock must be armed for power to actually do anything (firmware-side gate).</div>
      <div className="flex items-end gap-3">
        <Field label={`Power (${power})`}>
          <input type="range" min={0} max={255} value={power} onChange={(e) => setPower(parseInt(e.target.value))} className="w-40" />
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input type="checkbox" checked={interlock} onChange={(e) => setInterlock(e.target.checked)} className="accent-purple-500" /> Interlock Armed
        </label>
        <KeepaliveCheckbox checked={active} onChange={(v) => { setActive(v); if (!v) ctx.sendFrame(CAN_ID_LASER_CMD, [0, 0], 'Laser off'); }} watchdogMs={250} />
      </div>
      <div className="mt-2 text-xs text-slate-400">Endstop: <span className="font-mono text-slate-200">{endstop ?? '--'}</span></div>
    </Section>
  );
};

// ---- Tool 10: 3D Printer ----
export const Printer3DPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [nozzleActive, setNozzleActive] = useState(false);
  const [nozzleTemp, setNozzleTemp] = useState(200);
  const [extDir, setExtDir] = useState<'fwd' | 'retract'>('fwd');
  const [extSteps, setExtSteps] = useState(0);
  const hotendTemp = useTelemetry(ctx, CAN_ID_3DP_HOTEND_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);

  const sendThermalMotion = (steps: number) => ctx.sendFrame(
    CAN_ID_3DP_THERMAL_MOTION,
    [(nozzleTemp >> 8) & 0xFF, nozzleTemp & 0xFF, extDir === 'fwd' ? 1 : 0, (steps >> 16) & 0xFF, (steps >> 8) & 0xFF, steps & 0xFF],
    '3D printer nozzle+extruder command'
  );
  useKeepalive(nozzleActive, KEEPALIVE_INTERVAL_MS, () => sendThermalMotion(0), () => setNozzleActive(false));

  const [layerFanActive, setLayerFanActive] = useState(false);
  const [layerFanPower, setLayerFanPower] = useState(0);
  const layerFanRpm = useTelemetry(ctx, CAN_ID_3DP_LAYERFAN_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);
  useKeepalive(layerFanActive, LAYERFAN_KEEPALIVE_INTERVAL_MS, () => ctx.sendFrame(CAN_ID_3DP_LAYERFAN_CMD, [layerFanPower], 'Layer fan power'), () => setLayerFanActive(false));

  const [hotendFanPower, setHotendFanPower] = useState(0);
  const hotendFanRpm = useTelemetry(ctx, CAN_ID_3DP_HOTENDFAN_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Nozzle Heater + Extruder (0x170, combined)">
        <div className="flex items-end gap-3 mb-2">
          <Field label="Setpoint (0-300 C)">
            <input type="number" min={0} max={300} value={nozzleTemp} onChange={(e) => setNozzleTemp(safeInt(e.target.value, 0, 0, 300))} className={inputCls} />
          </Field>
          <KeepaliveCheckbox checked={nozzleActive} onChange={(v) => { setNozzleActive(v); if (!v) { setExtSteps(0); sendThermalMotion(0); } }} watchdogMs={250} />
        </div>
        <div className="flex items-end gap-3">
          <Field label="Extruder Direction">
            <select value={extDir} onChange={(e) => setExtDir(e.target.value as any)} className={inputCls}>
              <option value="fwd">Forward</option>
              <option value="retract">Retract</option>
            </select>
          </Field>
          <Field label="Steps (24-bit)">
            <input type="number" min={0} max={16777215} value={extSteps} onChange={(e) => setExtSteps(safeInt(e.target.value, 0, 0, 16777215))} className={inputCls} />
          </Field>
          <button className={btnPrimaryCls} onClick={() => sendThermalMotion(extSteps)}>Move Extruder Once</button>
        </div>
        <div className="mt-2 text-xs text-slate-400">Hotend: <span className="font-mono text-slate-200">{hotendTemp ?? '--'} C</span></div>
        <LiveGraph value={hotendTemp} yMax={300} color="#f59e0b" />
      </Section>

      <Section title="Fans (0x173 layer / 0x178 hotend)">
        <div className="flex items-end gap-3 mb-3">
          <Field label={`Layer fan (${layerFanPower})`}>
            <input type="range" min={0} max={255} value={layerFanPower} onChange={(e) => setLayerFanPower(parseInt(e.target.value))} className="w-32" />
          </Field>
          <KeepaliveCheckbox checked={layerFanActive} onChange={(v) => { setLayerFanActive(v); if (!v) ctx.sendFrame(CAN_ID_3DP_LAYERFAN_CMD, [0], 'Layer fan off'); }} watchdogMs={1000} />
        </div>
        <div className="text-xs text-slate-400 mb-3">RPM: <span className="font-mono text-slate-200">{layerFanRpm ?? '--'}</span></div>

        <div className="flex items-end gap-3 mb-2">
          <Field label={`Hotend fan (${hotendFanPower})`}>
            <input type="range" min={0} max={255} value={hotendFanPower} onChange={(e) => setHotendFanPower(parseInt(e.target.value))} className="w-32" />
          </Field>
          <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_3DP_HOTENDFAN_CMD, [hotendFanPower], 'Hotend fan power')}>Send</button>
        </div>
        <div className="text-[10px] text-slate-500 mb-1">One-shot, no watchdog (stall detector).</div>
        <div className="text-xs text-slate-400">RPM: <span className="font-mono text-slate-200">{hotendFanRpm ?? '--'}</span></div>
      </Section>
    </div>
  );
};

// ---- Tool 11: Scan Probe ----
export const ScanProbePanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [count, setCount] = useState(0);
  const [lastAt, setLastAt] = useState<string | null>(null);
  useEffect(() => ctx.subscribe(CAN_ID_IMPACT_EVENT, (f) => {
    if (f.data[0] === 0x01) { setCount(c => c + 1); setLastAt(f.timestamp); }
  }), [ctx]);
  return (
    <Section title="Scan Probe (0x095, event-driven)" subtitle="Max-priority ID - purely passive, no command to send.">
      <div className="flex gap-6 text-xs">
        <div>Impacts this session: <span className="font-mono text-slate-200">{count}</span></div>
        <div>Last impact: <span className="font-mono text-slate-200">{lastAt ?? '--'}</span></div>
      </div>
    </Section>
  );
};

// ---- Tool 13: Electromagnet ----
export const ElectromagnetPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [on, setOn] = useState(false);
  return (
    <Section title="Electromagnet (0x1B0)" subtitle="Latched digital command - no comms watchdog by design (see CANBUS.TXT note on 0x1B0).">
      <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); ctx.sendFrame(CAN_ID_ELECTROMAGNET_CMD, [e.target.checked ? 1 : 0], `Electromagnet ${e.target.checked ? 'ON' : 'OFF'}`); }} className="accent-purple-500 w-4 h-4" />
        Energize
      </label>
    </Section>
  );
};

// ---- Tools 14/24: Weld pulse (spot/ultrasonic) ----
export const WeldPanel: React.FC<{ ctx: ToolCtx; cmdId: number; label: string; gated: boolean }> = ({ ctx, cmdId, label, gated }) => {
  const [ms, setMs] = useState(200);
  const fire = () => {
    const clamped = Math.max(1, Math.min(WELD_PULSE_MAX_MS, ms));
    ctx.sendFrame(cmdId, [1, (clamped >> 8) & 0xFF, clamped & 0xFF], `${label} fire ${clamped}ms`);
  };
  return (
    <Section title={`${label} (0x${cmdId.toString(16)})`} subtitle={gated ? 'Requires the contact sensor to be satisfied (firmware-side gate).' : 'No contact-sensor gate.'}>
      <div className="flex items-end gap-3">
        <Field label={`Pulse duration (1-${WELD_PULSE_MAX_MS} ms)`}>
          <input type="number" min={1} max={WELD_PULSE_MAX_MS} value={ms} onChange={(e) => setMs(safeInt(e.target.value, 1, 1, WELD_PULSE_MAX_MS))} className={inputCls} />
        </Field>
        <button className={btnPrimaryCls} onClick={fire}>Fire Pulse</button>
      </div>
    </Section>
  );
};

// ---- Tool 17: Flying Probe ----
export const FlyingProbePanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const basic = useTelemetry(ctx, CAN_ID_FLYING_PROBE_BASIC, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);
  const [configHex, setConfigHex] = useState('8583');
  const [result, setResult] = useState<number | null>(null);

  const readResult = async () => {
    await ctx.sendFrame(CAN_ID_FLYING_PROBE_ADS_RESULT, [], 'Read ADS1115 result');
    const resp = await ctx.waitForFrame(CAN_ID_FLYING_PROBE_ADS_RESULT, 1000);
    if (resp && resp.data.length >= 2) {
      let raw = (resp.data[0] << 8) | resp.data[1];
      if (raw & 0x8000) raw -= 0x10000;
      setResult(raw);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Basic (0x243, onboard ADC)" subtitle="Passive telemetry, no command.">
        <div className="text-xs text-slate-400">Raw: <span className="font-mono text-slate-200">{basic ?? '--'}</span></div>
      </Section>
      <Section title="Advanced (ADS1115, 0x240/0x241/0x242)">
        <div className="flex items-end gap-2 mb-2">
          <Field label="Config register (hex)">
            <input value={configHex} onChange={(e) => setConfigHex(e.target.value)} className={inputCls} />
          </Field>
          <button className={btnCls} onClick={() => ctx.sendFrame(CAN_ID_FLYING_PROBE_ADS_CONFIG, [(parseInt(configHex, 16) >> 8) & 0xFF, parseInt(configHex, 16) & 0xFF], 'ADS1115 config')}>Send</button>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnCls} onClick={() => ctx.sendFrame(CAN_ID_FLYING_PROBE_ADS_TRIGGER, [], 'Trigger conversion')}>Trigger Conversion</button>
          <button className={btnCls} onClick={readResult}>Read Result</button>
          <span className="text-xs font-mono text-slate-200">{result ?? '--'}</span>
        </div>
      </Section>
    </div>
  );
};

// ---- Tool 18: UV Curing ----
export const UvCuringPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [active, setActive] = useState(false);
  const [power, setPower] = useState(0);
  useKeepalive(active, KEEPALIVE_INTERVAL_MS, () => ctx.sendFrame(CAN_ID_UV_CURING_CMD, [power], 'UV curing power'), () => setActive(false));
  return (
    <Section title="UV Curing (0x1D0)" subtitle="Shares TIM1_CH1 with the laser - same 250ms watchdog.">
      <div className="flex items-end gap-3">
        <Field label={`Power (${power})`}>
          <input type="range" min={0} max={255} value={power} onChange={(e) => setPower(parseInt(e.target.value))} className="w-40" />
        </Field>
        <KeepaliveCheckbox checked={active} onChange={(v) => { setActive(v); if (!v) ctx.sendFrame(CAN_ID_UV_CURING_CMD, [0], 'UV curing off'); }} watchdogMs={250} />
      </div>
    </Section>
  );
};

// ---- Tool 19: Hot Air Rework ----
export const HotAirReworkPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [active, setActive] = useState(false);
  const [temp, setTemp] = useState(200);
  const [blower, setBlower] = useState(0);
  const liveTemp = useTelemetry(ctx, CAN_ID_SOLDER_TELEMETRY, (d) => d.length >= 2 ? (d[0] << 8) | d[1] : null);
  useKeepalive(active, KEEPALIVE_INTERVAL_MS, () => ctx.sendFrame(CAN_ID_HOTAIR_CMD, [(temp >> 8) & 0xFF, temp & 0xFF, blower], 'Hot air rework command'), () => setActive(false));
  return (
    <Section title="Hot Air Rework (0x1E0, telemetry shared with 0x135)">
      <div className="flex items-end gap-3">
        <Field label="Setpoint (0-450 C)">
          <input type="number" min={0} max={450} value={temp} onChange={(e) => setTemp(safeInt(e.target.value, 0, 0, 450))} className={inputCls} />
        </Field>
        <Field label={`Blower (${blower})`}>
          <input type="range" min={0} max={255} value={blower} onChange={(e) => setBlower(parseInt(e.target.value))} className="w-32" />
        </Field>
        <KeepaliveCheckbox checked={active} onChange={(v) => { setActive(v); if (!v) ctx.sendFrame(CAN_ID_HOTAIR_CMD, [0, 0, 0], 'Hot air rework off'); }} watchdogMs={250} />
      </div>
      <div className="mt-2 text-xs text-slate-400">Live: <span className="font-mono text-slate-200">{liveTemp ?? '--'} C</span></div>
      <LiveGraph value={liveTemp} yMax={450} />
    </Section>
  );
};

// ---- Tool 23: Paste Jetting ----
export const PasteJettingPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [channel, setChannel] = useState(0);
  const [freq, setFreq] = useState(1000);
  const [duty, setDuty] = useState(50);
  const [pulseMs, setPulseMs] = useState(50);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="PWM Config (0x230)">
        <div className="flex items-end gap-3">
          <Field label="Channel (0-3)"><input type="number" min={0} max={3} value={channel} onChange={(e) => setChannel(safeInt(e.target.value, 0, 0, 3))} className={inputCls} /></Field>
          <Field label="Frequency (Hz)"><input type="number" min={1} max={65535} value={freq} onChange={(e) => setFreq(safeInt(e.target.value, 1, 1, 65535))} className={inputCls} /></Field>
          <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_PASTE_JETTING_CONFIG, [channel, (freq >> 8) & 0xFF, freq & 0xFF], 'Paste jetting config')}>Configure</button>
        </div>
      </Section>
      <Section title="Fire Pulse (0x231)" subtitle="Reuses the last-configured channel.">
        <div className="flex items-end gap-3">
          <Field label="Duty (%)"><input type="number" min={0} max={100} value={duty} onChange={(e) => setDuty(safeInt(e.target.value, 0, 0, 100))} className={inputCls} /></Field>
          <Field label="Duration (ms)"><input type="number" min={0} max={255} value={pulseMs} onChange={(e) => setPulseMs(safeInt(e.target.value, 0, 0, 255))} className={inputCls} /></Field>
          <button className={btnPrimaryCls} onClick={() => ctx.sendFrame(CAN_ID_PASTE_JETTING_PULSE, [channel, duty, pulseMs], 'Paste jetting pulse')}>Fire Pulse</button>
        </div>
      </Section>
    </div>
  );
};

// ---- Tool 22: Thermal Inspection ----
export const ThermalInspectionPanel: React.FC<{ ctx: ToolCtx }> = ({ ctx }) => {
  const [status, setStatus] = useState<number | null>(null);
  const [pixels, setPixels] = useState<number[] | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkStatus = async () => {
    await ctx.sendFrame(CAN_ID_THERMAL_STATUS, [], 'Query thermal status');
    const resp = await ctx.waitForFrame(CAN_ID_THERMAL_STATUS, 1000);
    if (resp) setStatus(resp.data[0]);
  };

  const readImage = async () => {
    setReading(true);
    setProgress(0);
    const out: number[] = [];
    try {
      for (let chunk = 0; chunk < THERMAL_CHUNK_COUNT; chunk++) {
        await ctx.sendFrame(CAN_ID_THERMAL_CAL_CHUNK_REQ, [chunk], `Request thermal chunk ${chunk}`);
        const bytes: number[] = [];
        for (let f = 0; f < 4; f++) {
          const frame = await ctx.waitForFrame(CAN_ID_THERMAL_CAL_CHUNK_RESP, 300);
          if (!frame) throw new Error(`Timeout on chunk ${chunk}, frame ${f}`);
          bytes.push(...frame.data);
        }
        for (let i = 0; i < bytes.length; i += 2) {
          let v = (bytes[i] << 8) | bytes[i + 1];
          if (v & 0x8000) v -= 0x10000;
          out.push(v / 100);
        }
        setProgress(Math.floor(((chunk + 1) / THERMAL_CHUNK_COUNT) * 100));
      }
      setPixels(out);
    } catch (e) {
      console.error(e);
    } finally {
      setReading(false);
    }
  };

  return (
    <Section title="Thermal Inspection (0x250/0x251/0x254/0x255)" subtitle="32x24 calibrated thermal image, pulled 48 chunks x 4 frames sequentially - no streaming mode.">
      <div className="flex items-center gap-3 mb-3">
        <button className={btnCls} onClick={() => ctx.sendFrame(CAN_ID_THERMAL_TRIGGER, [], 'Trigger thermal capture')}>Trigger Capture</button>
        <button className={btnCls} onClick={checkStatus}>Check Status</button>
        <span className="text-xs font-mono text-slate-300">{status === null ? '--' : status === 0x00 ? 'Idle' : status === 0x01 ? 'Busy' : status === 0x02 ? 'Ready' : status === 0xFF ? 'Error' : `0x${status.toString(16)}`}</span>
        <button className={btnPrimaryCls} onClick={readImage} disabled={reading}>{reading ? `Reading... ${progress}%` : 'Read Thermal Image'}</button>
      </div>
      {pixels && (
        <div className="grid gap-px bg-slate-800 border border-slate-800 rounded overflow-hidden" style={{ gridTemplateColumns: 'repeat(32, 1fr)', maxWidth: 480 }}>
          {pixels.slice(0, 768).map((t, i) => {
            const clamped = Math.max(0, Math.min(100, t));
            const hue = 240 - (clamped / 100) * 240;
            return <div key={i} style={{ background: `hsl(${hue}, 90%, 50%)`, aspectRatio: '1/1' }} title={`${t.toFixed(1)} C`} />;
          })}
        </div>
      )}
    </Section>
  );
};

export const NoHandlerPanel: React.FC<{ name: string }> = ({ name }) => (
  <Section title={name}>
    <div className="text-xs text-slate-500">No CAN handler for this tool - its actuator/sensor lives on the robot mainboard, not this board.</div>
  </Section>
);
