import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../types';
import { Radio, Play, Trash2, Send, ShieldCheck, Cpu } from 'lucide-react';

interface CanBusAnalyzerProps {
  canFrames: CanFrame[];
  onSendCustomFrame: (idHex: string, dataHex: string, description: string) => void;
  onClearLog: () => void;
  onTriggerPreset: (presetName: string) => void;
}

export const CanBusAnalyzer: React.FC<CanBusAnalyzerProps> = ({
  canFrames,
  onSendCustomFrame,
  onClearLog,
  onTriggerPreset
}) => {
  const { t } = useTranslation();
  const [customId, setCustomId] = useState<string>('0x100');
  const [customData, setCustomData] = useState<string>('FF 80 00 00 00 00 00 00');
  const [customDesc, setCustomDesc] = useState<string>('Host Custom Frame');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSendCustomFrame(customId, customData, customDesc);
  };

  return (
    <div className="space-y-4">
      
      {/* CAN Bus Status & Control Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              {t('canbus.title', 'CAN Bus Protocol Analyzer (1 Mbps / SocketCAN / SLCAN)')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('canbus.subtitle', 'Low-Latency Real-Time Telemetry & Watchdog Pinger (docs/CANBUS.TXT)')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClearLog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>{t('canbus.clear_log', 'Clear Log')}</span>
            </button>
          </div>
        </div>

        {/* Preset Command Triggers */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-slate-300 mb-3">{t('canbus.presets_title', 'Predefined URTC Protocol Messages (docs/CANBUS.TXT):')}</div>

          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">{t('canbus.category_system', 'System & Configuration')}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '0x100 Set RGB / OLED Mode', id: '0x100' },
                  { label: '0x110 Query Active Tool', id: '0x110' },
                  { label: '0x180 SPI Passthrough Req', id: '0x180' },
                  { label: '0x182 Query TMC_DIAG0', id: '0x182' },
                  { label: '0x190 Query F-RAM State', id: '0x190' },
                  { label: '0x192 Erase F-RAM State', id: '0x192' },
                  { label: '0x1A0 Set Expansion Type', id: '0x1A0' },
                  { label: '0x1A1 Query Expansion Type', id: '0x1A1' },
                  { label: '0x1A2 Set Free Tool Config', id: '0x1A2' },
                  { label: '0x1A3 Query Free Tool Config', id: '0x1A3' },
                  { label: '0x1A4 Set Device Serial', id: '0x1A4' },
                  { label: '0x1A5 Query Device Serial', id: '0x1A5' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-amber-500" />{p.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">{t('canbus.category_tool', 'Tool-Specific Control & Telemetry')}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '0x095 Touch Probe Impact', id: '0x095' },
                  { label: '0x120 Stepper Control', id: '0x120' },
                  { label: '0x130 T12 Setpoint (Iron)', id: '0x130' },
                  { label: '0x135 T12 Telemetry (Iron)', id: '0x135' },
                  { label: '0x140 BL4260 Speed (Drill)', id: '0x140' },
                  { label: '0x145 ADC/Input (Vacuum)', id: '0x145' },
                  { label: '0x147 RPM Telemetry (Drill)', id: '0x147' },
                  { label: '0x150 Ring Control (AOI)', id: '0x150' },
                  { label: '0x155 Endstop (AOI)', id: '0x155' },
                  { label: '0x160 Laser Power (Engraver)', id: '0x160' },
                  { label: '0x165 Endstop (Engraver)', id: '0x165' },
                  { label: '0x170 Thermal+Extruder (3D)', id: '0x170' },
                  { label: '0x173 Delta Fan PWM (3D)', id: '0x173' },
                  { label: '0x175 Hotend Telemetry (3D)', id: '0x175' },
                  { label: '0x177 Layer Fan RPM (3D)', id: '0x177' },
                  { label: '0x178 Hotend Fan PWM (3D)', id: '0x178' },
                  { label: '0x179 Hotend Fan RPM (3D)', id: '0x179' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-cyan-500" />{p.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">{t('canbus.category_bootloader', 'Bootloader (CAN-OTA)')}</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '0x7F0 Enter Bootloader', id: '0x7F0' },
                  { label: '0x7F1 Start Update', id: '0x7F1' },
                  { label: '0x7F2 FW Data', id: '0x7F2' },
                  { label: '0x7F3 Page Ack', id: '0x7F3' },
                  { label: '0x7F4 End Update / Verify', id: '0x7F4' },
                  { label: '0x7F5 Status', id: '0x7F5' },
                  { label: '0x7F6 Heartbeat', id: '0x7F6' },
                  { label: '0x7F7 HMAC-SHA256 Chunk', id: '0x7F7' },
                  { label: '0x7F8 Query Version', id: '0x7F8' },
                  { label: '0x7F9 Version Response', id: '0x7F9' },
                  { label: '0x7FA Bootloader Version', id: '0x7FA' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-emerald-500" />{p.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CAN Frame Injector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
          {t('canbus.inject_title', 'Inject Raw CAN Frame')}
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">{t('canbus.id_label', 'CAN ID (Hex)')}</label>
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="0x100"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">{t('canbus.data_label', 'Data Bytes (Hex, max 8 bytes)')}</label>
            <input
              type="text"
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder="FF 80 00 00 00 00 00 00"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">{t('canbus.desc_label', 'Description')}</label>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder={t('canbus.desc_placeholder', 'Custom command')}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="submit"
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1 shadow-md shadow-amber-500/10"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t('canbus.tx', 'Tx')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* CAN Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>{t('canbus.stream_title', 'REAL-TIME CAN FRAME STREAM ({{count}} FRAMES)', { count: canFrames.length })}</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> {t('canbus.mbps_active', '1 Mbps ACTIVE')}
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto overflow-x-auto font-mono text-xs">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead className="bg-slate-950 text-slate-400 text-[11px] sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2 px-4">{t('canbus.th_timestamp', 'TIMESTAMP')}</th>
                <th className="py-2 px-4">{t('canbus.th_dir', 'DIR')}</th>
                <th className="py-2 px-4">{t('canbus.th_id', 'ID (HEX)')}</th>
                <th className="py-2 px-4">{t('canbus.th_dlc', 'DLC')}</th>
                <th className="py-2 px-4">{t('canbus.th_data', 'DATA BYTES')}</th>
                <th className="py-2 px-4">{t('canbus.th_description', 'DESCRIPTION')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {canFrames.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    {t('canbus.no_frames', 'No CAN frames logged yet. Send a command above or toggle tools.')}
                  </td>
                </tr>
              ) : (
                canFrames.map((frame, index) => (
                  <tr key={index} className="hover:bg-slate-850 transition-colors">
                    <td className="py-2 px-4 text-slate-500">{frame.timestamp}</td>
                    <td className="py-2 px-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        frame.direction === 'Tx'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {frame.direction}
                      </span>
                    </td>
                    <td className="py-2 px-4 font-bold text-amber-400">{frame.idHex}</td>
                    <td className="py-2 px-4 text-slate-400">{frame.dlc}</td>
                    <td className="py-2 px-4 text-cyan-300 tracking-wider font-mono">{frame.dataHex}</td>
                    <td className="py-2 px-4 text-slate-300">{frame.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
