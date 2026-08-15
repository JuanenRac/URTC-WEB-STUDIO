import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardwareState, ExpansionBoardType } from '../types';
import { Cpu, Sliders, Sun, ShieldAlert, Zap, Radio, Database, Check } from 'lucide-react';

interface HardwarePanelProps {
  hardwareState: HardwareState;
  onJumperToggle: (index: number) => void;
  onSetFreeConfigId: (id: number) => void;
  onToggleFault: () => void;
  onLedOverride: (r: number, g: number, b: number) => void;
  onResetLedAuto: () => void;
  onSetRingBrightness: (val: number) => void;
  onSetExpansionBoard: (board: ExpansionBoardType) => void;
  activeToolName: string;
  firmwareVersion?: string;
}

export const HardwarePanel: React.FC<HardwarePanelProps> = ({
  hardwareState,
  onJumperToggle,
  onSetFreeConfigId,
  onToggleFault,
  onLedOverride,
  onResetLedAuto,
  onSetRingBrightness,
  onSetExpansionBoard,
  activeToolName,
  firmwareVersion = '1.1.0'
}) => {
  const { t } = useTranslation();
  const [customR, setCustomR] = useState<number>(255);
  const [customG, setCustomG] = useState<number>(128);
  const [customB, setCustomB] = useState<number>(0);

  const isFirmware10 = firmwareVersion.startsWith('1.0');

  // Calculate 5-bit jumper decimal
  const jumperDecimal = hardwareState.jumpers.reduce((acc, bit, idx) => acc + (bit ? (1 << idx) : 0), 0);
  const isFreeConfigMode = jumperDecimal === 31; // 11111
  const effectiveToolId = isFreeConfigMode ? hardwareState.freeConfigFramId : jumperDecimal;
  const isUnsupportedJumperInFW10 = effectiveToolId >= 12 && isFirmware10;

  return (
    <div className="flex flex-col gap-4">
      
      {/* 5-Bit DIP Jumper Matrix & ID Selector */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                {t('hardware.jumpers_title', '5-Bit Tool Identification Jumpers (ID0-ID4)')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('hardware.jumpers_subtitle', 'Hardware Solder-Jumper Matrix • Up to 32 Tool Addresses')}
              </p>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-400 block">{t('hardware.binary_value', 'BINARY VALUE')}</span>
              <span className="text-amber-400 font-bold text-sm">
                0b{hardwareState.jumpers.map(j => j ? '1' : '0').join('')} ({jumperDecimal})
              </span>
            </div>
          </div>

          {/* DIP Switches UI */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-around">
            {hardwareState.jumpers.map((state, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400">ID{idx}</span>
                <button
                  onClick={() => onJumperToggle(idx)}
                  className={`w-10 h-16 rounded-lg p-1 transition-all flex flex-col justify-between items-center border ${
                    state
                      ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  <span className={`w-8 h-6 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-all ${
                    state ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {state ? t('hardware.on', 'ON') : t('hardware.off', 'OFF')}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">2^{idx}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Jumper Mode Status Banner */}
          {isUnsupportedJumperInFW10 && (
            <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-1 my-2">
              <div className="font-bold text-red-400">
                {t('hardware.unsupported_banner_title', '⚠️ UNSUPPORTED JUMPER ID #{{id}} IN FIRMWARE v1.0.0', { id: effectiveToolId })}
              </div>
              <p className="text-[11px] text-slate-300">
                {t('hardware.unsupported_banner_body', 'Jumpers select Tool ID #{{id}} ({{name}}). Firmware 1.0 only supports IDs 0 to 11. Flash Firmware v1.1.0 in Flasher Studio to use this tool profile.', { id: effectiveToolId, name: activeToolName })}
              </p>
            </div>
          )}

          {isFreeConfigMode ? (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Database className="w-4 h-4 text-amber-400" />
                {t('hardware.free_config_title', 'Special Free Configuration Mode (Jumper 11111) Active')}
              </div>
              <p className="text-[11px] text-slate-300">
                {t('hardware.free_config_body', 'The jumper matrix is set to 31 (11111). The hardware reads the tool profile dynamically from F-RAM register 0x1A2 instead of physical jumpers.')}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-mono text-slate-400">{t('hardware.override_fram_label', 'Override F-RAM Tool ID:')}</span>
                <select
                  value={hardwareState.freeConfigFramId}
                  onChange={(e) => onSetFreeConfigId(parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono rounded px-2 py-1 focus:outline-none"
                >
                  {Array.from({ length: 25 }, (_, i) => (
                    <option key={i} value={i}>
                      {t('hardware.tool_option', 'Tool #{{id}}', { id: i })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-center justify-between">
              <span>{t('hardware.mapped_profile', 'Mapped Profile:')} <strong className="text-amber-300">{activeToolName}</strong></span>
              <span className="text-[10px] font-mono text-slate-500">{t('hardware.hardware_match', 'Hardware Profile Direct Match')}</span>
            </div>
          )}

          {/* Fault Simulation Toggle */}
          <div className="pt-2">
            <button
              onClick={onToggleFault}
              className={`w-full py-2.5 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-2 border ${
                hardwareState.systemError
                  ? 'bg-red-500 text-white border-red-400 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{hardwareState.systemError ? t('hardware.clear_fault', 'CLEAR HARDWARE FAULT') : t('hardware.trigger_fault', 'TRIGGER SIMULATED FAULT (RED LED PRIORITY)')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status LED, Camera Ring & Expansion Board Selector */}
      <div className="space-y-4">
        
        {/* Status LED (WS2812B) & Camera Ring */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            {t('hardware.status_ring_title', 'Digital Status LED & 8-LED Camera Ring')}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Status LED Controls */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-semibold text-slate-300">{t('hardware.status_led_label', 'Status LED (CONN_LED1)')}</div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> {t('hardware.fault_priority', '1. Fault Active (Red)')}
                </div>
                <div className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> {t('hardware.can_priority', '2. CAN Active <1.5s (Blue)')}
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('hardware.idle_priority', '3. Idle Timeout >1.5s (Green)')}
                </div>
              </div>

              {/* RGB Override Simulator */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-mono text-slate-400">{t('hardware.rgb_override_label', 'CAN 0x100 RGB Override (10s)')}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={`#${((1 << 24) + (customR << 16) + (customG << 8) + customB).toString(16).slice(1)}`}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setCustomR(parseInt(hex.substr(1, 2), 16));
                      setCustomG(parseInt(hex.substr(3, 2), 16));
                      setCustomB(parseInt(hex.substr(5, 2), 16));
                    }}
                    className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <button
                    onClick={() => onLedOverride(customR, customG, customB)}
                    className="flex-1 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded hover:bg-amber-400 transition"
                  >
                    {t('hardware.send_override', 'Send 0x100 Override')}
                  </button>
                </div>

                {hardwareState.ledMode === 'override' && (
                  <button
                    onClick={onResetLedAuto}
                    className="w-full py-1 text-[10px] font-mono bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  >
                    {t('hardware.reset_auto', 'Reset to Auto Mode')}
                  </button>
                )}
              </div>
            </div>

            {/* Camera Ring LED Controls */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                {t('hardware.ring_title', '8-Pixel Ring (AOI Lighting)')}
              </div>

              {/* 8 Pixel Ring Visualizer */}
              <div className="flex justify-center items-center py-2">
                <div className="relative w-16 h-16 rounded-full border-2 border-slate-800 flex items-center justify-center">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (i * 360) / 8;
                    const rad = (angle * Math.PI) / 180;
                    const x = Math.cos(rad) * 22;
                    const y = Math.sin(rad) * 22;

                    return (
                      <span
                        key={i}
                        className="absolute w-2.5 h-2.5 rounded-full shadow-sm transition-all"
                        style={{
                          transform: `translate(${x}px, ${y}px)`,
                          backgroundColor: `rgba(245, 158, 11, ${hardwareState.ringLedBrightness / 100})`,
                          boxShadow: `0 0 6px rgba(245, 158, 11, ${hardwareState.ringLedBrightness / 100})`
                        }}
                      />
                    );
                  })}
                  <span className="text-[9px] font-mono text-slate-500">{t('hardware.ring_center_label', 'RING')}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span>{t('hardware.brightness_label', 'BRIGHTNESS')}</span>
                  <span className="text-amber-400 font-bold">{hardwareState.ringLedBrightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hardwareState.ringLedBrightness}
                  onChange={(e) => onSetRingBrightness(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

          </div>
        </div>

        {/* 20-Pin Expansion Connector Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            {t('hardware.expansion_title', '20-Pin Expansion Connector Variant')}
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            {t('hardware.expansion_subtitle', 'Select expansion board topology (Basic vs Advanced with STM32F303CB Slave + Sensors)')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { id: 'none', label: t('hardware.exp_none_label', 'None (Main Board Standalone)'), motor: t('hardware.exp_none_motor', 'Internal TMC2209 (2.0A)') },
              { id: 'basic_tmc2209', label: t('hardware.exp_basic2209_label', 'Basic Expansion (TMC2209)'), motor: t('hardware.exp_basic2209_motor', 'Aux Stepper (2.0A)') },
              { id: 'basic_tmc5160a', label: t('hardware.exp_basic5160_label', 'Basic Expansion (TMC5160A)'), motor: t('hardware.exp_basic5160_motor', 'High-Current Stepper (10.0A)') },
              { id: 'advanced_tmc2209', label: t('hardware.exp_adv2209_label', 'Advanced Slave (TMC2209 + Sensors)'), motor: t('hardware.exp_adv2209_motor', 'Aux Stepper + ADS1115/MLX90640') },
              { id: 'advanced_tmc5160a', label: t('hardware.exp_adv5160_label', 'Advanced Slave (TMC5160A 10A + Sensors)'), motor: t('hardware.exp_adv5160_motor', '10A Stepper + ADS1115/MLX90640') }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => onSetExpansionBoard(opt.id as ExpansionBoardType)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  hardwareState.expansionBoard === opt.id
                    ? 'bg-amber-500/10 border-amber-500 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-between">
                  <span>{opt.label}</span>
                  {hardwareState.expansionBoard === opt.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">{opt.motor}</div>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
