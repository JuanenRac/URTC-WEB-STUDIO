import React, { useState } from 'react';
import { ShieldCheck, Download, Usb, CheckCircle2, AlertTriangle } from 'lucide-react';
import { HardwareState, CanFrame } from '../types';
import { CAN_ID_QUERY_ACTIVE_TOOL, CAN_ID_ACTIVE_TOOL_RESP, TOOL_NAMES, MOTION_TOOL_IDS, NO_HANDLER_TOOL_IDS, CAN_ID_CRIMPING_CMD, CAN_ID_MOTION_CMD } from '../lib/canIds';
import { THIS_HARDWARE_ID, CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE } from '../lib/flasher';
import { GlobalControlsPanel, ExpansionBoardPanel, FramPanel, SelfTestPanel, BusMonitorPanel, CustomFramePanel } from './tester/GlobalPanels';
import {
  ToolCtx, SolderingIronPanel, MotionPanel, VacuumPanel, DrillPanel, AoiPanel, LaserPanel, Printer3DPanel,
  ScanProbePanel, ElectromagnetPanel, WeldPanel, FlyingProbePanel, UvCuringPanel, HotAirReworkPanel,
  PasteJettingPanel, ThermalInspectionPanel, NoHandlerPanel
} from './tester/ToolPanels';
import { CAN_ID_WELD_SPOT_CMD, CAN_ID_WELD_ULTRASONIC_CMD } from '../lib/canIds';

interface TesterStudioProps {
  hardwareState: HardwareState;
  activeToolId: number;
  activeToolName: string;
  canFrames: CanFrame[];
  isConnected: boolean;
  onSendFrame: (id: number, data: number[], description?: string) => Promise<void>;
  onWaitForFrame: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
  subscribe: (id: number, cb: (f: CanFrame) => void) => () => void;
  subscribeAll: (cb: (f: CanFrame) => void) => () => void;
}

type SubTab = 'tool' | 'global' | 'expansion' | 'fram' | 'selftest' | 'bus' | 'custom';

export const TesterStudio: React.FC<TesterStudioProps> = ({
  hardwareState, activeToolId, activeToolName, canFrames, isConnected,
  onSendFrame, onWaitForFrame, subscribe, subscribeAll
}) => {
  const [subTab, setSubTab] = useState<SubTab>('tool');
  const [detected, setDetected] = useState<{ hardwareId: number; toolId: number } | null>(null);

  const ctx: ToolCtx = { sendFrame: onSendFrame, waitForFrame: onWaitForFrame, subscribe, isConnected };

  const handleDetectHardware = async () => {
    if (!isConnected) return;
    await onSendFrame(CAN_ID_QUERY_ACTIVE_TOOL, [], 'Detect: query active tool');
    const toolResp = await onWaitForFrame(CAN_ID_ACTIVE_TOOL_RESP, 1500);
    await onSendFrame(CAN_ID_QUERY_VERSION, [0x00], 'Detect: query version');
    const verResp = await onWaitForFrame(CAN_ID_VERSION_RESPONSE, 1500);
    if (toolResp && verResp) {
      const hardwareId = ((verResp.data[1] << 24) | (verResp.data[2] << 16) | (verResp.data[3] << 8) | verResp.data[4]) >>> 0;
      setDetected({ hardwareId, toolId: toolResp.data[0] & 0x1F });
    }
  };

  const exportDebugBundle = () => {
    const data = JSON.stringify({ hardwareState, canFrames: canFrames.slice(0, 200), detected }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `URTC_Debug_Bundle_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderToolPanel = () => {
    if (MOTION_TOOL_IDS.has(activeToolId)) {
      return <MotionPanel ctx={ctx} cmdId={CAN_ID_MOTION_CMD} label={TOOL_NAMES[activeToolId]} />;
    }
    if (NO_HANDLER_TOOL_IDS.has(activeToolId)) {
      return <NoHandlerPanel name={TOOL_NAMES[activeToolId]} />;
    }
    switch (activeToolId) {
      case 0: return <SolderingIronPanel ctx={ctx} />;
      case 4: return <VacuumPanel ctx={ctx} />;
      case 5: return <DrillPanel ctx={ctx} />;
      case 8: return <AoiPanel ctx={ctx} />;
      case 9: return <LaserPanel ctx={ctx} />;
      case 10: return <Printer3DPanel ctx={ctx} />;
      case 11: return <ScanProbePanel ctx={ctx} />;
      case 13: return <ElectromagnetPanel ctx={ctx} />;
      case 14: return <WeldPanel ctx={ctx} cmdId={CAN_ID_WELD_SPOT_CMD} label="Spot Welder" gated={true} />;
      case 17: return <FlyingProbePanel ctx={ctx} />;
      case 18: return <UvCuringPanel ctx={ctx} />;
      case 19: return <HotAirReworkPanel ctx={ctx} />;
      case 21: return <MotionPanel ctx={ctx} cmdId={CAN_ID_CRIMPING_CMD} label="Crimping Actuator (expansion driver)" />;
      case 22: return <ThermalInspectionPanel ctx={ctx} />;
      case 23: return <PasteJettingPanel ctx={ctx} />;
      case 24: return <WeldPanel ctx={ctx} cmdId={CAN_ID_WELD_ULTRASONIC_CMD} label="Ultrasonic Welder" gated={false} />;
      default: return <div className="text-xs text-slate-500 p-4">No panel implemented for tool #{activeToolId}.</div>;
    }
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'tool', label: `Active Tool (${activeToolName})` },
    { id: 'global', label: 'Global Controls' },
    { id: 'expansion', label: 'Expansion Board' },
    { id: 'fram', label: 'F-RAM' },
    { id: 'selftest', label: 'Self-Test' },
    { id: 'bus', label: 'Bus Monitor' },
    { id: 'custom', label: 'Custom Frame' },
  ];

  return (
    <div className="space-y-4">
      {/* Connection + Detection */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">URTC Tester Studio</h2>
              <p className="text-xs text-slate-400">Serial SLCAN Interface &bull; {isConnected ? 'connected' : 'not connected (use the header button)'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hardwareState.systemError && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 font-semibold text-xs animate-pulse">
                <AlertTriangle className="w-4 h-4" /> CRITICAL ERROR DECLARED
              </div>
            )}
            <button onClick={handleDetectHardware} disabled={!isConnected} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs rounded-lg transition border border-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Detect Hardware
            </button>
            <button onClick={exportDebugBundle} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition border border-slate-700 flex items-center gap-2">
              <Download className="w-4 h-4" /> Export Debug Bundle
            </button>
          </div>
        </div>

        {detected && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">HardwareID</div><div className={detected.hardwareId === THIS_HARDWARE_ID ? 'text-emerald-400' : 'text-red-400'}>0x{detected.hardwareId.toString(16).toUpperCase().padStart(8, '0')}</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Active Tool</div><div className="text-slate-200">#{detected.toolId} ({TOOL_NAMES[detected.toolId] ?? '?'})</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">Board State</div><div className={hardwareState.systemError ? 'text-red-400' : 'text-emerald-400'}>{hardwareState.systemError ? 'FAULT' : 'OK'}</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">ID Jumpers</div><div className="text-slate-200 flex gap-1">{hardwareState.jumpers.slice().reverse().map((v, i) => <span key={i} className={v ? 'text-emerald-400' : 'text-slate-600'}>{v ? '1' : '0'}</span>)}</div></div>
          </div>
        )}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1.5 flex-wrap border-b border-slate-800 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${subTab === t.id ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'tool' && renderToolPanel()}
      {subTab === 'global' && <GlobalControlsPanel ctx={ctx} />}
      {subTab === 'expansion' && <ExpansionBoardPanel ctx={ctx} />}
      {subTab === 'fram' && <FramPanel ctx={ctx} />}
      {subTab === 'selftest' && <SelfTestPanel ctx={ctx} activeToolId={activeToolId} />}
      {subTab === 'bus' && <BusMonitorPanel ctx={ctx} subscribeAll={subscribeAll} />}
      {subTab === 'custom' && <CustomFramePanel ctx={ctx} />}
    </div>
  );
};
