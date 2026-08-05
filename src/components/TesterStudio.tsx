import React, { useState } from 'react';
import { ShieldCheck, Activity, Download, Settings, Sliders, HardDrive, MonitorPlay, Usb, CheckCircle2, AlertTriangle, Fingerprint } from 'lucide-react';
import { HardwareState, CanFrame } from '../types';

interface TesterStudioProps {
  hardwareState: HardwareState;
  activeToolName: string;
  canFrames: CanFrame[];
  onSendFrame?: (id: number, data: number[]) => Promise<void>;
}

export const TesterStudio: React.FC<TesterStudioProps> = ({ hardwareState, activeToolName, canFrames, onSendFrame }) => {
  const handleDetectHardware = () => {
    if (onSendFrame) {
      onSendFrame(0x110, []); // CAN_ID_QUERY_ACTIVE_TOOL
      onSendFrame(0x7F8, [0]); // CAN_ID_QUERY_VERSION
    }
  };

  const exportDebugBundle = () => {
    const data = JSON.stringify({ hardwareState, canFrames }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `URTC_Debug_Bundle_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8 space-y-4">
        
        {/* Connection Panel */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Hardware Connection
              </h2>
              <p className="text-xs text-slate-400">Serial SLCAN Interface</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interface Status</label>
              <div className="text-sm text-slate-300 py-2">
                Hardware connection is managed globally via the top Header (Web Serial API).
              </div>
            </div>
            <button 
              className="px-6 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Diagnostic Mode Ready</span>
            </button>
          </div>
          
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
            Status: <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Ready</span>
          </div>
        </div>

        {/* Diagnostics & Tool Ident */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Diagnostics & Hardware State
              </h2>
              <p className="text-xs text-slate-400">Tool Identification and Pin States</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 mb-3">Hardware ID Pins (ID4...ID0)</h3>
              <div className="flex justify-between gap-2">
                {hardwareState.jumpers.map((val, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">ID{4 - i}</span>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg font-mono ${
                      val 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}>
                      {val ? '1' : '0'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-slate-400 mb-2">Active Tool & Board State</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded bg-slate-900">
                  <span className="text-xs text-slate-400">Active Tool:</span>
                  <span className="text-sm font-semibold text-amber-400">{activeToolName}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-900">
                  <span className="text-xs text-slate-400">Board State:</span>
                  <span className="text-sm font-semibold text-emerald-400">{hardwareState.systemError ? 'FAULT' : 'OK'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-5 flex gap-3">
            <button 
              onClick={handleDetectHardware}
              className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition border border-slate-700"
            >
              Detect Hardware
            </button>
          </div>
        </div>
      </div>
      
      <div className="lg:col-span-4 space-y-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Logging & Telemetry</h2>
          </div>
          
          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-3 font-mono text-[10px] text-slate-400 overflow-y-auto mb-4 min-h-[150px]">
            <div className="text-emerald-400">URTC Tester ready.</div>
            <div className="mt-1">Expected HardwareID: 0x0303CC01</div>
            <div className="mt-1 opacity-75">Expecting the adapter in SLCAN mode - see the README if your CANable shows up as anything other than a serial port.</div>
            {canFrames.slice(-5).map((f, i) => (
              <div key={i} className="mt-1">{`[${f.timestamp}] ${f.direction} ${f.id} ${f.data}`}</div>
            ))}
          </div>
          
          <button 
            onClick={exportDebugBundle}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition border border-slate-700 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Debug Bundle...
          </button>
        </div>
      </div>
    </div>
  );
};
