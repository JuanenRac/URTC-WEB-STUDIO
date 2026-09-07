import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOOL_PROFILES } from '../data/toolsData';
import { ToolProfile, HardwareState } from '../types';
import { Zap, ShieldCheck, AlertCircle, Cpu, Radio, Save, Info, Sliders, Lock, ArrowUpRight, AlertOctagon } from 'lucide-react';

interface ToolCatalogProps {
  selectedToolId: number;
  onSelectTool: (id: number) => void;
  setpoint: number;
  onSetpointChange: (val: number) => void;
  liveReading: number;
  hardwareState: HardwareState;
  onSaveToFram: () => void;
  firmwareVersion: string;
  onSwitchToFirmware11?: () => void;
}

export const ToolCatalog: React.FC<ToolCatalogProps> = ({
  selectedToolId,
  onSelectTool,
  setpoint,
  onSetpointChange,
  liveReading,
  hardwareState,
  onSaveToFram,
  firmwareVersion,
  onSwitchToFirmware11
}) => {
  const { t } = useTranslation();
  const [filterCategory, setFilterCategory] = useState<'All' | 'Shipped (v0.0)' | 'Expansion (v0.1)'>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const isFirmware10 = firmwareVersion.startsWith('0.0');

  const activeTool = TOOL_PROFILES.find(t => t.id === selectedToolId) || TOOL_PROFILES[0];
  const isToolSupportedByActiveFirmware = activeTool.id < 12 || !isFirmware10;

  const filteredTools = TOOL_PROFILES.filter(t => {
    const matchesCat = filterCategory === 'All' || t.category === filterCategory;
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Calculate 5-bit DIP jumper array from tool ID
  const idToJumpers = (id: number): boolean[] => {
    return [
      Boolean(id & 0x01),
      Boolean(id & 0x02),
      Boolean(id & 0x04),
      Boolean(id & 0x08),
      Boolean(id & 0x10)
    ];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      
      {/* Left Column: Tool Catalog Grid & Filtering */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-400" />
                {t('toolcatalog.title', 'Tool Catalog Matrix (Firmware v{{version}})', { version: firmwareVersion })}
              </h2>
              <p className="text-xs text-slate-400">
                {isFirmware10
                  ? t('toolcatalog.subtitle_fw10', 'FW v0.0.0 Active • 12 Shipped Profiles Active (IDs 0–11) • 13 Expansion Profiles Locked 🔒')
                  : t('toolcatalog.subtitle_fw11', 'FW v0.1.0 Active • All 25 Profiles Unlocked & Functional (IDs 0–24)')}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setFilterCategory('All')}
                className={`px-2.5 py-1 rounded ${filterCategory === 'All' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t('toolcatalog.filter_all', 'All (25)')}
              </button>
              <button
                onClick={() => setFilterCategory('Shipped (v0.0)')}
                className={`px-2.5 py-1 rounded ${filterCategory === 'Shipped (v0.0)' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {t('toolcatalog.filter_v10', 'v0.0 (12)')}
              </button>
              <button
                onClick={() => setFilterCategory('Expansion (v0.1)')}
                className={`px-2.5 py-1 rounded flex items-center gap-1 ${filterCategory === 'Expansion (v0.1)' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <span>{t('toolcatalog.filter_v11', 'v0.1 (13)')}</span>
                {isFirmware10 && <Lock className="w-3 h-3 text-amber-400" />}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <input
            type="text"
            placeholder={t('toolcatalog.search_placeholder', 'Search tools by name, sensor, or functionality...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 mb-3"
          />

          {/* Tool Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {filteredTools.map((tool) => {
              const isSelected = tool.id === selectedToolId;
              const toolJumpers = idToJumpers(tool.id);
              const isSupported = tool.id < 12 || !isFirmware10;

              return (
                <div
                  key={tool.id}
                  onClick={() => onSelectTool(tool.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-sm shadow-amber-500/10'
                      : !isSupported
                      ? 'bg-slate-950/40 border-slate-900 text-slate-500 opacity-75 hover:bg-slate-900/60'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950'
                          : !isSupported
                          ? 'bg-slate-900 text-slate-600'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tool.id}
                      </span>
                      <h3 className={`text-xs font-semibold tracking-tight ${!isSupported ? 'text-slate-400' : ''}`}>
                        {tool.name}
                      </h3>
                    </div>

                    {!isSupported ? (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 font-bold">
                        <Lock className="w-2.5 h-2.5" />
                        {t('toolcatalog.fw11_required', 'FW 1.1 REQ')}
                      </span>
                    ) : (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        tool.category.includes('v0.0')
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {tool.category.includes('v0.0') ? 'v0.0' : 'v0.1'}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-400">
                    <div>
                      <span>{t('toolcatalog.jumpers_label', 'JUMPERS:')} </span>
                      <span className="text-amber-400 font-bold">
                        {toolJumpers.map(j => j ? '1' : '0').join('')}
                      </span>
                    </div>

                    {!isSupported ? (
                      <span className="text-amber-400/90 text-[9px]">{t('toolcatalog.unsupported_v10', 'Unsupported in v0.0')}</span>
                    ) : tool.watchdogMs ? (
                      <span className="text-amber-400/90 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                        {tool.watchdogMs}{t('toolcatalog.watchdog_suffix', 'ms Watchdog')}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Selected Tool Active Control & Telemetry Panel */}
      <div className="lg:col-span-5 space-y-4">
        
        {/* Active Tool Parameters & Sliders */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-mono font-bold">
                  ID {activeTool.id}
                </span>
                <h3 className="text-base font-bold text-slate-100">{activeTool.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeTool.category}</p>
            </div>

            <button
              onClick={onSaveToFram}
              disabled={!isToolSupportedByActiveFirmware}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-slate-950 font-semibold text-xs transition shadow-md shadow-amber-500/10"
              title={isToolSupportedByActiveFirmware ? t('toolcatalog.save_fram_title_enabled', 'Save current tool setpoints into F-RAM') : t('toolcatalog.save_fram_title_disabled', 'Tool unsupported in FW 1.0')}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('toolcatalog.save_fram', 'Save F-RAM')}</span>
            </button>
          </div>

          {/* UNSUPPORTED FIRMWARE WARNING ALERT */}
          {!isToolSupportedByActiveFirmware && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-slate-200 mb-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertOctagon className="w-4 h-4 text-amber-400" />
                {t('toolcatalog.unsupported_title', 'UNSUPPORTED TOOL ID IN FIRMWARE v{{version}}', { version: firmwareVersion })}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('toolcatalog.unsupported_body', 'Tool #{{id}} ({{name}}) belongs to the Expansion Profile catalog (v0.1). The currently active firmware (v0.0.0) only supports tools 0 through 11.', { id: activeTool.id, name: activeTool.name })}
              </p>
              {onSwitchToFirmware11 && (
                <button
                  onClick={onSwitchToFirmware11}
                  className="mt-1 w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  {t('toolcatalog.upgrade_button', 'Upgrade / Switch to Firmware v0.1.0 to Enable')}
                </button>
              )}
            </div>
          )}

          {/* Setpoint Slider Control */}
          <div className={`space-y-4 ${!isToolSupportedByActiveFirmware ? 'opacity-40 pointer-events-none' : ''}`}>
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  {t('toolcatalog.target_setpoint', 'TARGET SETPOINT ({{label}})', { label: activeTool.heroMetricLabel })}
                </span>
                <span className="text-amber-400 font-bold text-sm">
                  {setpoint.toFixed(1)} {activeTool.heroMetricUnit}
                </span>
              </div>
              
              <input
                type="range"
                min={activeTool.minVal}
                max={activeTool.maxVal}
                step={(activeTool.maxVal - activeTool.minVal) / 100}
                value={setpoint}
                disabled={!isToolSupportedByActiveFirmware}
                onChange={(e) => onSetpointChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />

              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>{activeTool.minVal} {activeTool.heroMetricUnit}</span>
                <span>{activeTool.maxVal} {activeTool.heroMetricUnit}</span>
              </div>
            </div>

            {/* Simulated Live Telemetry Reading Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-slate-400">{t('toolcatalog.sim_readback', 'SIMULATED SENSOR READBACK')}</div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">
                  {liveReading.toFixed(1)} <span className="text-xs">{activeTool.heroMetricUnit}</span>
                </div>
              </div>

              <div className="text-right font-mono text-xs">
                <div className="text-slate-400 text-[10px]">{t('toolcatalog.watchdog_label', 'WATCHDOG')}</div>
                {activeTool.watchdogMs ? (
                  <div className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 animate-pulse" />
                    {activeTool.watchdogMs}ms {t('toolcatalog.watchdog_active', 'ACTIVE')}
                  </div>
                ) : (
                  <div className="text-slate-500">{t('toolcatalog.watchdog_none', 'NO TIMEOUT')}</div>
                )}
              </div>
            </div>

            {/* Hardware Pins Assigned */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                {t('toolcatalog.pin_mapping_title', 'Hardware Pin Mapping & Signals')}
              </div>
              <ul className="space-y-1 text-xs font-mono text-slate-400">
                {activeTool.pinsUsed.map((pin, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{pin}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tool Profile Features */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">{t('toolcatalog.capabilities_title', 'Firmware Capabilities')}</div>
              <div className="flex flex-wrap gap-1.5">
                {activeTool.features.map((feat, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                  >
                    ✓ {feat}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};
