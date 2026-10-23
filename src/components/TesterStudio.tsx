import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Download, Usb, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CanFrame } from '../types';
import { BoardStatus } from '../lib/boardTelemetry';
import { downloadBlob } from '../lib/download';
import { CAN_ID_QUERY_ACTIVE_TOOL, CAN_ID_ACTIVE_TOOL_RESP, TOOL_NAMES, MOTION_TOOL_IDS, NO_HANDLER_TOOL_IDS, CAN_ID_CRIMPING_CMD, CAN_ID_MOTION_CMD } from '../lib/canIds';
import { THIS_HARDWARE_ID, CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE } from '../lib/flasher';
import { GlobalControlsPanel, ExpansionBoardPanel, FramPanel, SelfTestPanel, BusMonitorPanel, CustomFramePanel } from './tester/GlobalPanels';
import {
  ToolCtx, SolderingIronPanel, MotionPanel, VacuumPanel, DrillPanel, AoiPanel, LaserPanel, Printer3DPanel,
  ScanProbePanel, ElectromagnetPanel, WeldPanel, FlyingProbePanel, UvCuringPanel, HotAirReworkPanel,
  PasteJettingPanel, ThermalInspectionPanel, NoHandlerPanel
} from './tester/ToolPanels';
import { CAN_ID_WELD_SPOT_CMD, CAN_ID_WELD_ULTRASONIC_CMD } from '../lib/canIds';
import { BlackBoxPanel, FeaturesPanel, PidPanel, RackBenchPanel, ThermalViewPanel } from './tester/ExtrasPanels';

interface TesterStudioProps {
  /** What the real board reported (0x111). The tool panels follow this, never the sandbox. */
  boardStatus: BoardStatus;
  canFrames: CanFrame[];
  isConnected: boolean;
  onSendFrame: (id: number, data: number[], description?: string) => Promise<void>;
  onWaitForFrame: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
  onRequest: ToolCtx['request'];
  onFlushFrames: ToolCtx['flushFrames'];
  subscribe: (id: number, cb: (f: CanFrame) => void) => () => void;
  subscribeAll: (cb: (f: CanFrame) => void) => () => void;
}

type SubTab = 'tool' | 'global' | 'expansion' | 'fram' | 'blackbox' | 'features' | 'rack' | 'thermal' | 'selftest' | 'bus' | 'custom';

export const TesterStudio: React.FC<TesterStudioProps> = ({
  boardStatus, canFrames, isConnected,
  onSendFrame, onWaitForFrame, onRequest, onFlushFrames, subscribe, subscribeAll
}) => {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('tool');
  const [detected, setDetected] = useState<{ hardwareId: number | null; toolId: number | null } | null>(null);
  const [detectFailed, setDetectFailed] = useState(false);

  // One stable context: panels list it as an effect dependency, so a new object on every render would unsubscribe and resubscribe them all each time a frame arrives.
  const ctx: ToolCtx = useMemo(() => ({
    sendFrame: onSendFrame, waitForFrame: onWaitForFrame, request: onRequest, flushFrames: onFlushFrames, subscribe, isConnected
  }), [onSendFrame, onWaitForFrame, onRequest, onFlushFrames, subscribe, isConnected]);

  // The tool whose panel is shown is the one the board itself reported.
  const toolId = isConnected ? boardStatus.toolId : null;
  const toolKnown = toolId !== null && TOOL_NAMES[toolId] !== undefined;
  const toolName = toolId === null ? '-' : (TOOL_NAMES[toolId] ?? '?');

  const handleDetectHardware = async () => {
    if (!isConnected) return;
    setDetectFailed(false);
    const toolResp = await onRequest(CAN_ID_QUERY_ACTIVE_TOOL, [], CAN_ID_ACTIVE_TOOL_RESP, 1500, 'Detect: query active tool');
    const verResp = await onRequest(CAN_ID_QUERY_VERSION, [0x00], CAN_ID_VERSION_RESPONSE, 1500, 'Detect: query version');
    if (!toolResp && !verResp) { setDetected(null); setDetectFailed(true); return; }
    setDetected({
      hardwareId: verResp && verResp.data.length >= 5 ? (((verResp.data[1] << 24) | (verResp.data[2] << 16) | (verResp.data[3] << 8) | verResp.data[4]) >>> 0) : null,
      toolId: toolResp ? toolResp.data[0] & 0x1F : null,
    });
  };

  // Only what really crossed the bus is exported; frames from the sandbox and its state are not a diagnosis.
  const exportDebugBundle = () => {
    const data = JSON.stringify({ board: boardStatus, detected, frames: canFrames.filter(f => !f.simulated).slice(0, 200) }, null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), `URTC_Debug_Bundle_${new Date().getTime()}.json`);
  };

  const renderToolPanel = () => {
    if (!isConnected) {
      return <div className="text-xs text-slate-500 p-4">{t('tester.tool_needs_connection', 'Connect the USB-CAN adapter (top header) to control a tool.')}</div>;
    }
    if (toolId === null) {
      return <div className="text-xs text-amber-300 p-4">{t('tester.tool_waiting_for_board', 'Waiting for the board to say which tool it has. Use the Detect button; no tool panel is shown until the board has answered.')}</div>;
    }
    if (!toolKnown) {
      return <div className="text-xs text-red-300 p-4">{t('tester.tool_invalid', 'The board reports tool number {{id}}, which is not a valid tool. Check the ID jumpers and the free tool configuration.', { id: toolId })}</div>;
    }
    const activeToolId = toolId;
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
      default: return <div className="text-xs text-slate-500 p-4">{t('tester.no_panel', 'No panel implemented for tool #{{id}}.', { id: activeToolId })}</div>;
    }
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'tool', label: t('tester.tab_tool', 'Active Tool ({{name}})', { name: toolName }) },
    { id: 'global', label: t('tester.tab_global', 'Global Controls') },
    { id: 'expansion', label: t('tester.tab_expansion', 'Expansion Board') },
    { id: 'fram', label: t('tester.tab_fram', 'F-RAM') },
    { id: 'blackbox', label: t('tester.tab_blackbox', 'Black Box') },
    { id: 'features', label: t('tester.tab_features', 'Optional Functions') },
    { id: 'rack', label: t('tester.tab_rack', 'Rack Bench') },
    { id: 'thermal', label: t('tester.tab_thermal', 'Thermal View') },
    { id: 'selftest', label: t('tester.tab_selftest', 'Self-Test') },
    { id: 'bus', label: t('tester.tab_bus', 'Bus Monitor') },
    { id: 'custom', label: t('tester.tab_custom', 'Custom Frame') },
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
              <h2 className="text-base font-bold text-slate-100">{t('tester.title', 'URTC Tester Studio')}</h2>
              <p className="text-xs text-slate-400">{t('tester.subtitle_prefix', 'Serial SLCAN Interface •')} {isConnected ? t('tester.status_connected', 'connected') : t('tester.status_disconnected', 'not connected (use the header button)')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {boardStatus.systemError && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 font-semibold text-xs animate-pulse" title={t('tester.critical_error_hint', 'The error stays until the board is reset. There is no reset command over CAN: switch the board off and on.')}>
                <AlertTriangle className="w-4 h-4" /> {t('tester.critical_error', 'CRITICAL ERROR DECLARED')}
                {boardStatus.thermalFault !== null && (
                  <span className="font-normal">
                    - {t('tester.thermal_runaway', 'THERMAL RUNAWAY')}: {[1, 2, 3].includes(boardStatus.thermalFault)
                      ? t(`tester.thermal_fault_${boardStatus.thermalFault}`)
                      : t('tester.thermal_fault_unknown', 'code {{code}}', { code: boardStatus.thermalFault })}
                  </span>
                )}
              </div>
            )}
            <button onClick={handleDetectHardware} disabled={!isConnected} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs rounded-lg transition border border-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> {t('tester.detect_button', 'Detect Hardware')}
            </button>
            <button onClick={exportDebugBundle} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition border border-slate-700 flex items-center gap-2">
              <Download className="w-4 h-4" /> {t('tester.export_button', 'Export Debug Bundle')}
            </button>
          </div>
        </div>

        {detectFailed && (
          <div className="mt-3 text-xs text-red-300">{t('tester.detect_no_answer', 'No board answered. Check the wiring, the power and that the adapter is connected.')}</div>
        )}
        {detected && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('tester.hw_id_label', 'HardwareID')}</div><div className={detected.hardwareId === THIS_HARDWARE_ID ? 'text-emerald-400' : 'text-red-400'}>{detected.hardwareId === null ? '--' : `0x${detected.hardwareId.toString(16).toUpperCase().padStart(8, '0')}`}</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('tester.active_tool_label', 'Active Tool')}</div><div className="text-slate-200">{detected.toolId === null ? '--' : `#${detected.toolId} (${TOOL_NAMES[detected.toolId] ?? '?'})`}</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('tester.board_state_label', 'Board State')}</div><div className={boardStatus.systemError ? 'text-red-400' : 'text-emerald-400'}>{boardStatus.systemError ? t('tester.state_fault', 'FAULT') : t('tester.state_ok', 'OK')}</div></div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800"><div className="text-slate-500">{t('tester.id_jumpers_label', 'ID Jumpers')}</div><div className="text-slate-200 flex gap-1">{[4, 3, 2, 1, 0].map((bit) => { const on = toolId !== null && ((toolId >> bit) & 1) === 1; return <span key={bit} className={on ? 'text-emerald-400' : 'text-slate-600'}>{on ? '1' : '0'}</span>; })}</div></div>
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
      {subTab === 'blackbox' && <BlackBoxPanel ctx={ctx} systemError={isConnected && boardStatus.systemError} />}
      {subTab === 'features' && <><FeaturesPanel ctx={ctx} /><PidPanel ctx={ctx} /></>}
      {subTab === 'rack' && <RackBenchPanel />}
      {subTab === 'thermal' && <ThermalViewPanel ctx={ctx} />}
      {subTab === 'selftest' && (toolId !== null ? <SelfTestPanel ctx={ctx} activeToolId={toolId} /> : <div className="text-xs text-amber-300 p-4">{t('tester.selftest_needs_tool', 'The self-test needs the board to report its tool first. Use the Detect button.')}</div>)}
      {subTab === 'bus' && <BusMonitorPanel ctx={ctx} subscribeAll={subscribeAll} />}
      {subTab === 'custom' && <CustomFramePanel ctx={ctx} />}
    </div>
  );
};
