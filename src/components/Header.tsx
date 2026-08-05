import React from 'react';
import { Zap, AlertTriangle, Usb } from 'lucide-react';
import { HardwareState } from '../types';
import urtcLogoTester from '../../images/urtc_custom_icon.svg';

interface HeaderProps {
  hardwareState: HardwareState;
  activeToolName: string;
  firmwareVersion: string;
  onSetFirmwareVersion: (ver: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  portName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  hardwareState,
  activeToolName,
  firmwareVersion,
  onSetFirmwareVersion,
  isConnected,
  onConnect,
  onDisconnect,
  portName
}) => {
  // Determine Status LED visual color
  let ledColorBg = 'bg-emerald-500 shadow-emerald-500/50';
  let ledText = 'IDLE (GREEN)';
  
  if (hardwareState.systemError) {
    ledColorBg = 'bg-red-500 shadow-red-500/50 animate-pulse';
    ledText = 'FAULT (RED)';
  } else if (hardwareState.ledMode === 'override') {
    const { r, g, b } = hardwareState.ledOverrideColor;
    ledColorBg = 'shadow-lg';
    ledText = `CUSTOM RGB (${r},${g},${b})`;
  } else if (hardwareState.canActive) {
    ledColorBg = 'bg-blue-500 shadow-blue-500/50 animate-pulse';
    ledText = 'CAN BUS ACTIVE (BLUE)';
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 md:px-4 py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src={urtcLogoTester} alt="URTC Tester Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">URTC Web Studio</h1>
                <button
                  onClick={() => onSetFirmwareVersion(firmwareVersion.startsWith('1.0') ? '1.1.0' : '1.0.0')}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-all flex items-center gap-1 ${
                    firmwareVersion.startsWith('1.0')
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  title="Click to toggle simulated firmware version (v1.0.0 vs v1.1.0)"
                >
                  <span>FW v{firmwareVersion}</span>
                  <span className="text-[10px] opacity-75">
                    ({firmwareVersion.startsWith('1.0') ? '12 Tools' : '25 Tools'})
                  </span>
                </button>
              </div>
              <p className="text-xs text-slate-400">Universal Robot Tool Controller • Open Hardware Studio</p>
            </div>
          </div>

          {/* Real-time Hardware Indicators */}
          <div className="flex items-center gap-2 md:gap-4 text-xs font-mono flex-wrap justify-end">
            {/* Active Tool Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Tool:</span>
              <span className="text-amber-300 font-semibold">{activeToolName}</span>
            </div>

            {/* Status LED Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <span
                className={`w-2.5 h-2.5 rounded-full shadow-sm ${ledColorBg}`}
                style={
                  hardwareState.ledMode === 'override'
                    ? {
                        backgroundColor: `rgb(${hardwareState.ledOverrideColor.r},${hardwareState.ledOverrideColor.g},${hardwareState.ledOverrideColor.b})`,
                        boxShadow: `0 0 8px rgb(${hardwareState.ledOverrideColor.r},${hardwareState.ledOverrideColor.g},${hardwareState.ledOverrideColor.b})`
                      }
                    : undefined
                }
              />
              <span className="text-slate-300 font-medium">{ledText}</span>
            </div>

            {/* Connect Button */}
            {isConnected ? (
              <button 
                onClick={onDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900/50 transition-colors"
                title="Disconnect from USB CAN"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{portName || 'Connected'}</span>
              </button>
            ) : (
              <button 
                onClick={onConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                title="Connect USB CAN adapter via Web Serial"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Connect Hardware</span>
              </button>
            )}

            {/* System Error Indicator */}
            {hardwareState.systemError && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 font-medium animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>FAULT</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
