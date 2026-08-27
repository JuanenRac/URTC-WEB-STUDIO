import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FlasherState, CanFrame } from '../types';
import { RefreshCw, ShieldCheck, Cpu, CheckCircle2, AlertOctagon, Terminal, DownloadCloud, XCircle, Fingerprint } from 'lucide-react';
import { TOOL_PROFILES } from '../data/toolsData';
import { BoardVersionInfo } from '../App';
import {
  CAN_ID_EXPANSION_TYPE_RESP, CAN_ID_MLX_VARIANT_RESP, CAN_ID_SET_FREE_TOOL,
  CAN_ID_FREE_TOOL_CONFIG_RESP, CAN_ID_PERIPHERAL_INFO_RESP, EXPANSION_BOARD_TYPES, MLX_SENSOR_VARIANTS
} from '../lib/canIds';

interface FlasherStudioProps {
  onStartCanOta: (
    target: 'main' | 'slave',
    firmwareFile: string,
    fileObj: File | null | undefined,
    downloadUrl: string | undefined,
    opts: { triggerBootloader: boolean; eraseFram: boolean; allowDowngrade: boolean }
  ) => void;
  onStartSwdFlash: (firmwareFile: string, fileObj?: File | null, bootloaderFile?: string, bootloaderObj?: File | null) => void;
  onReadback: () => void;
  onCancel: () => void;
  flasherState: FlasherState;
  isConnected: boolean;
  boardVersion: BoardVersionInfo | null;
  onQueryVersion: () => void;
  errorCounters: { tec: number; rec: number } | null;
  onQueryErrorCounters: () => void;
  onSendFrame?: (id: number, data: number[], description?: string) => Promise<void>;
  onWaitForFrame?: (id: number, timeoutMs?: number) => Promise<CanFrame | null>;
}

const LOCAL_FIRMWARE_FILES = [
  { name: 'URTC_V1.1_F303CC.bin', label: 'URTC_V1.1_F303CC.bin (main application)' },
  { name: 'URTC_SLAVE_APP.bin', label: 'URTC_SLAVE_APP.bin (expansion slave application)' },
];
const LOCAL_BOOTLOADER_FILES = [
  { name: 'URTC_BOOTLOADER.bin', label: 'URTC_BOOTLOADER.bin (main board)' },
  { name: 'URTC_SLAVE_BOOTLOADER.bin', label: 'URTC_SLAVE_BOOTLOADER.bin (expansion slave)' },
];

export const FlasherStudio: React.FC<FlasherStudioProps> = ({
  onStartCanOta,
  onStartSwdFlash,
  onReadback,
  onCancel,
  flasherState,
  isConnected,
  boardVersion,
  onQueryVersion,
  errorCounters,
  onQueryErrorCounters,
  onSendFrame,
  onWaitForFrame
}) => {
  const { t } = useTranslation();
  const [flashTarget, setFlashTarget] = useState<'main' | 'slave'>('main');
  const [selectedFirmware, setSelectedFirmware] = useState<string>('URTC_V1.1_F303CC.bin');
  const [runAppTrigger, setRunAppTrigger] = useState<boolean>(true);
  const [eraseFram, setEraseFram] = useState<boolean>(false);
  const [allowDowngrade, setAllowDowngrade] = useState<boolean>(false);
  const [activeFlasherTab, setActiveFlasherTab] = useState<'can-ota' | 'swd' | 'config'>('can-ota');
  const [customFile, setCustomFile] = useState<File | null>(null);

  // GitHub Firmware State
  const [githubFirmwares, setGithubFirmwares] = useState<{ name: string, size: number, download_url: string }[]>([]);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const [githubError, setGithubError] = useState('');

  const fetchGithubFirmwares = async () => {
    setIsFetchingGithub(true);
    setGithubError('');
    try {
      const res = await fetch('https://api.github.com/repos/JuanenRac/URTC/contents/firmware');
      if (!res.ok) throw new Error(t('flasher.error_fetch_github', 'Failed to fetch from GitHub'));
      const data = await res.json();
      const files = data.filter((item: any) => item.type === 'file' && (item.name.endsWith('.bin') || item.name.endsWith('.hex')));
      setGithubFirmwares(files);
    } catch (e: any) {
      setGithubError(e.message);
    } finally {
      setIsFetchingGithub(false);
    }
  };

  useEffect(() => {
    fetchGithubFirmwares();
  }, []);

  useEffect(() => {
    // Slave-only checkboxes/target constraints, mirroring the Python flasher:
    // allow-downgrade and F-RAM erase have no slave equivalent, and the slave's
    // own default file differs from the main board's.
    if (flashTarget === 'slave') {
      setAllowDowngrade(false);
      setEraseFram(false);
      if (!customFile) setSelectedFirmware('URTC_SLAVE_APP.bin');
    } else if (!customFile) {
      setSelectedFirmware('URTC_V1.1_F303CC.bin');
    }
  }, [flashTarget]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // SWD State
  const [swdTool, setSwdTool] = useState<string>('STM32CubeProgrammer');
  const [swdBootloader, setSwdBootloader] = useState<string>('URTC_BOOTLOADER.bin');
  const [swdApp, setSwdApp] = useState<string>('URTC_V1.1_F303CC.bin');
  const [swdBackup, setSwdBackup] = useState<boolean>(false);
  const [swdDryRun, setSwdDryRun] = useState<boolean>(true);

  const [swdBootloaderFile, setSwdBootloaderFile] = useState<File | null>(null);
  const [swdAppFile, setSwdAppFile] = useState<File | null>(null);

  const swdBootloaderInputRef = React.useRef<HTMLInputElement>(null);
  const swdAppInputRef = React.useRef<HTMLInputElement>(null);

  // Peripheral config tab state
  const [serialNumber, setSerialNumber] = useState<string>('0');
  const [selectedFreeTool, setSelectedFreeTool] = useState<string>('0');
  const [expansionType, setExpansionType] = useState<number | null>(null);
  const [mlxVariant, setMlxVariant] = useState<number | null>(null);
  const [peripheralInfo, setPeripheralInfo] = useState<{ type: number; serial: number } | null>(null);
  const [freeToolConfig, setFreeToolConfig] = useState<number | null>(null);

  const queryAndSet = async (
    id: number,
    timeoutMs: number,
    apply: (data: number[]) => void,
    label: string
  ) => {
    if (!onSendFrame || !onWaitForFrame) return;
    await onSendFrame(id, [], `Query ${label}`);
    const resp = await onWaitForFrame(id, timeoutMs);
    if (resp) apply(resp.data);
  };

  const busy = flasherState.mode !== 'idle';
  const isBootloaderMode = boardVersion?.responder === 'bootloader';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

      {/* Left Column: Flash Memory Map & OTA / SWD Controls */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                {t('flasher.title', 'URTC Flasher Studio (CAN OTA)')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('flasher.subtitle', 'Golden-Image A/B Backup Slot Architecture • HMAC-SHA256 Signed OTA Updates')}
              </p>
            </div>
          </div>

          {/* Real board version panel */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-amber-400" />
                {t('flasher.board_version_title', 'Connected Board (queried live via CAN 0x7F8/0x7F9/0x7FA)')}
              </div>
              <button
                onClick={onQueryVersion}
                disabled={!isConnected}
                className="px-2.5 py-1 rounded border text-[11px] font-semibold bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                {t('flasher.query_version', 'Query Version')}
              </button>
            </div>
            {!isConnected && (
              <div className="text-[11px] text-slate-500">{t('flasher.connect_prompt', 'Connect the USB-CAN adapter (top header) to query the real board.')}</div>
            )}
            {isConnected && !boardVersion && (
              <div className="text-[11px] text-slate-500">{t('flasher.no_version_yet', 'No version reported yet - click "Query Version".')}</div>
            )}
            {boardVersion && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-slate-500">{t('flasher.responder_label', 'Responder')}</div>
                  <div className="text-slate-200 font-semibold">{boardVersion.responder}</div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-slate-500">{t('flasher.hardware_id_label', 'HardwareID')}</div>
                  <div className={`font-semibold ${boardVersion.hardwareId === 0x0303CC01 || boardVersion.hardwareId === 0x0303CB01 ? 'text-emerald-400' : 'text-red-400'}`}>
                    0x{boardVersion.hardwareId.toString(16).toUpperCase().padStart(8, '0')}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-slate-500">{t('flasher.app_version_label', 'App Version')}</div>
                  <div className="text-slate-200 font-semibold">
                    {boardVersion.hardwareId === 0 ? t('flasher.none_installed', 'none installed') : `${boardVersion.appMajor}.${boardVersion.appMinor}`}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <div className="text-slate-500">{t('flasher.bootloader_version_label', 'Bootloader Version')}</div>
                  <div className="text-slate-200 font-semibold">
                    {boardVersion.bootMajor !== undefined ? `${boardVersion.bootMajor}.${boardVersion.bootMinor}.${boardVersion.bootPatch}` : t('flasher.na_app_running', 'n/a (app running)')}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <span className="text-[11px] text-slate-400">{t('flasher.error_counters_label', 'CAN error counters (TEC/REC, 0x7FB/0x7FC)')}</span>
              <div className="flex items-center gap-2">
                {errorCounters && (
                  <span className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                    errorCounters.tec >= 128 || errorCounters.rec >= 128 ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    (errorCounters.tec > 0 || errorCounters.rec > 0) ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>TEC={errorCounters.tec} REC={errorCounters.rec}</span>
                )}
                <button
                  onClick={onQueryErrorCounters}
                  disabled={!isConnected}
                  className="px-2.5 py-1 rounded border text-[11px] font-semibold bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition"
                >
                  {t('flasher.query', 'Query')}
                </button>
              </div>
            </div>
          </div>

          {/* Flash Memory Architecture Visualizer */}
          <div className="mb-6 space-y-2">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>{flashTarget === 'main' ? t('flasher.flash_map_main', 'STM32F303CC FLASH MEMORY MAP (256 KB)') : t('flasher.flash_map_slave', 'STM32F303CB FLASH MEMORY MAP (128 KB)')}</span>
              <span>0x08000000 - {flashTarget === 'main' ? '0x08040000' : '0x08020000'}</span>
            </div>

            {flashTarget === 'main' ? (
              <div className="grid grid-cols-12 gap-1 text-[10px] font-mono text-center">
                <div className="col-span-2 p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <div className="font-bold">{t('flasher.seg_bootloader', 'BOOTLOADER')}</div><div>30 KB</div><div className="text-[9px] text-amber-400/80 mt-1">0x08000000</div>
                </div>
                <div className="col-span-1 p-2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  <div className="font-bold">{t('flasher.seg_meta', 'META')}</div><div>2 KB</div><div className="text-[9px] text-slate-500 mt-1">0x08007800</div>
                </div>
                <div className="col-span-4 p-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <div className="font-bold">{t('flasher.seg_main_slot', 'MAIN SLOT (ACTIVE)')}</div><div>112 KB</div><div className="text-[9px] text-emerald-400/80 mt-1">0x08008000</div>
                </div>
                <div className="col-span-5 p-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                  <div className="font-bold">{t('flasher.seg_backup_slot', 'BACKUP STAGING SLOT')}</div><div>112 KB</div><div className="text-[9px] text-cyan-400/80 mt-1">0x08024000</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-1 text-[10px] font-mono text-center">
                <div className="col-span-3 p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  <div className="font-bold">{t('flasher.seg_bootloader', 'BOOTLOADER')}</div><div>18 KB</div><div className="text-[9px] text-amber-400/80 mt-1">0x08000000</div>
                </div>
                <div className="col-span-4 p-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  <div className="font-bold">{t('flasher.seg_main_slot', 'MAIN SLOT (ACTIVE)')}</div><div>54 KB</div><div className="text-[9px] text-emerald-400/80 mt-1">0x08005000</div>
                </div>
                <div className="col-span-5 p-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                  <div className="font-bold">{t('flasher.seg_backup_slot', 'BACKUP STAGING SLOT')}</div><div>54 KB</div><div className="text-[9px] text-cyan-400/80 mt-1">~0x08013000</div>
                </div>
              </div>
            )}
          </div>

          {/* Firmware Selection & Actions */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">

            <div className="flex gap-2 border-b border-slate-800/60 pb-2 mb-3">
              <button onClick={() => setActiveFlasherTab('can-ota')} className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${activeFlasherTab === 'can-ota' ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'}`}>{t('flasher.tab_can_ota', 'CAN-OTA Programming')}</button>
              <button onClick={() => setActiveFlasherTab('swd')} className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${activeFlasherTab === 'swd' ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'}`}>{t('flasher.tab_swd', 'SWD/JTAG (desktop only)')}</button>
              <button onClick={() => setActiveFlasherTab('config')} className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${activeFlasherTab === 'config' ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'}`}>{t('flasher.tab_config', 'Board Config')}</button>
            </div>

            {activeFlasherTab === 'can-ota' && (
              <>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition"
                    style={{ borderColor: flashTarget === 'main' ? '#f59e0b66' : '#1e293b', color: flashTarget === 'main' ? '#fbbf24' : '#94a3b8', background: flashTarget === 'main' ? '#f59e0b1a' : 'transparent' }}>
                    <input type="radio" checked={flashTarget === 'main'} onChange={() => setFlashTarget('main')} className="accent-amber-500" />
                    {t('flasher.target_main', 'This board (main, direct CAN-OTA)')}
                  </label>
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition"
                    style={{ borderColor: flashTarget === 'slave' ? '#f59e0b66' : '#1e293b', color: flashTarget === 'slave' ? '#fbbf24' : '#94a3b8', background: flashTarget === 'slave' ? '#f59e0b1a' : 'transparent' }}>
                    <input type="radio" checked={flashTarget === 'slave'} onChange={() => setFlashTarget('slave')} className="accent-amber-500" />
                    {t('flasher.target_slave', 'Expansion slave (relayed via I2C, 0x210-0x219)')}
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">{t('flasher.select_firmware_label', 'Select Firmware Image (.bin):')}</label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedFirmware}
                      onChange={(e) => { setSelectedFirmware(e.target.value); setCustomFile(null); }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    >
                      <optgroup label={t('flasher.optgroup_local', 'Local (public/firmware/)')}>
                        {LOCAL_FIRMWARE_FILES.filter(f => flashTarget === 'slave' ? f.name.includes('SLAVE') : !f.name.includes('SLAVE')).map(f => (
                          <option key={f.name} value={f.name}>{f.label}</option>
                        ))}
                      </optgroup>
                      {githubFirmwares.length > 0 && (
                        <optgroup label={t('flasher.optgroup_github', 'GitHub Repository (JuanenRac/URTC)')}>
                          {githubFirmwares.filter(fw => !fw.name.toLowerCase().includes('bootloader')).map(fw => (
                            <option key={fw.name} value={fw.name}>{fw.name} ({Math.round(fw.size / 1024)}KB)</option>
                          ))}
                        </optgroup>
                      )}
                      {customFile && <option value={customFile.name}>{customFile.name} {t('flasher.option_browsed', '(browsed)')}</option>}
                    </select>
                    <input type="file" accept=".bin" ref={fileInputRef} className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setCustomFile(e.target.files[0]);
                          setSelectedFirmware(e.target.files[0].name);
                        }
                      }} />
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition whitespace-nowrap">{t('flasher.browse', 'Browse...')}</button>
                  </div>
                  {githubError && <div className="text-[10px] text-red-400 mt-1">{t('flasher.github_listing_error', 'GitHub listing:')} {githubError}</div>}
                </div>

                <div className="space-y-3 pt-2 pb-2">
                  <div className="flex flex-col gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={runAppTrigger} onChange={(e) => setRunAppTrigger(e.target.checked)} className="mt-0.5 accent-amber-500 rounded bg-slate-900 border-slate-700" />
                      <div>
                        <span className="font-semibold block text-slate-200">{t('flasher.trigger_label', 'Board is currently running the application (send enter-bootloader trigger first)')}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{t('flasher.trigger_sub', 'Uncheck if the board is already sitting in its bootloader.')}</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2 text-xs cursor-pointer ${flashTarget === 'slave' ? 'opacity-40 pointer-events-none' : 'text-slate-300'}`}>
                      <input type="checkbox" checked={eraseFram} disabled={flashTarget === 'slave'} onChange={(e) => setEraseFram(e.target.checked)} className="mt-0.5 accent-amber-500 rounded bg-slate-900 border-slate-700" />
                      <div>
                        <span className="font-semibold block text-slate-200">{t('flasher.erase_label', 'Also erase the persistence F-RAM before flashing')}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{t('flasher.erase_sub', 'Main board only (no F-RAM on the expansion slave). Only takes effect while the trigger above also runs (F-RAM erase requires the application still running).')}</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2 text-xs cursor-pointer ${flashTarget === 'slave' ? 'opacity-40 pointer-events-none' : 'text-slate-300'}`}>
                      <input type="checkbox" checked={allowDowngrade} disabled={flashTarget === 'slave'} onChange={(e) => setAllowDowngrade(e.target.checked)} className="mt-0.5 accent-amber-500 rounded bg-slate-900 border-slate-700" />
                      <div>
                        <span className="font-semibold block text-slate-200">{t('flasher.downgrade_label', 'Allow downgrade (bypass anti-rollback, CAN 0x7FD)')}</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{t('flasher.downgrade_sub', 'Main board only. One-shot per attempt - only lifts the version-ordering check, the full image still transfers and is verified normally.')}</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (allowDowngrade && !window.confirm(t('flasher.alert_downgrade_confirm', 'You are about to authorize a firmware DOWNGRADE, bypassing the bootloader\'s anti-rollback protection. Continue?'))) return;
                      if (!window.confirm(t('flasher.alert_flash_confirm', 'Flash "{{firmware}}" to the {{target}} now?', { firmware: selectedFirmware, target: flashTarget === 'slave' ? t('flasher.alert_target_slave', 'expansion slave') : t('flasher.alert_target_main', 'main board') }))) return;
                      onStartCanOta(flashTarget, selectedFirmware, customFile, githubFirmwares.find(f => f.name === selectedFirmware)?.download_url, { triggerBootloader: runAppTrigger, eraseFram, allowDowngrade });
                    }}
                    disabled={busy || !isConnected}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition shadow-md shadow-amber-500/10 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                    <span>{t('flasher.start_button', 'START CAN-OTA UPDATE ({{target}})', { target: flashTarget === 'slave' ? t('flasher.target_slave_short', 'slave') : t('flasher.target_main_short', 'main') })}</span>
                  </button>
                  {busy && (
                    <button onClick={onCancel} className="px-4 py-2.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/80 font-semibold text-xs transition flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> {t('flasher.cancel_button', 'Cancel')}
                    </button>
                  )}
                </div>

                {flashTarget === 'main' && (
                  <button
                    onClick={onReadback}
                    disabled={busy || !isConnected}
                    className="w-full py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                    title={t('flasher.backup_button_title', "Reads the main slot's current contents back over CAN before you overwrite it (bootloader must already be running)")}
                  >
                    <DownloadCloud className="w-4 h-4 text-cyan-400" />
                    <span>{t('flasher.backup_button', 'Backup Firmware (CAN readback, 0x7FE/0x7FF)')}</span>
                  </button>
                )}
                {!isConnected && (
                  <div className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5" /> {t('flasher.connect_warning', 'Connect the USB-CAN adapter to enable flashing.')}
                  </div>
                )}
              </>
            )}

            {activeFlasherTab === 'swd' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] leading-relaxed">
                  {t('flasher.swd_notice', "A browser has no API to drive an SWD/JTAG probe (Web Serial only talks to serial-framed devices like a USB-CAN adapter, not a debug probe's own protocol). This tab exists to explain the exact commands the desktop URTC Flasher tool runs locally via STM32CubeProgrammer/pyOCD - it will not execute anything from here.")}
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">{t('flasher.swd_bootloader_label', 'Bootloader File (.bin):')}</label>
                  <select value={swdBootloader} onChange={(e) => { setSwdBootloader(e.target.value); setSwdBootloaderFile(null); }} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300">
                    {LOCAL_BOOTLOADER_FILES.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">{t('flasher.swd_app_label', 'Application File (.bin):')}</label>
                  <select value={swdApp} onChange={(e) => { setSwdApp(e.target.value); setSwdAppFile(null); }} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300">
                    {LOCAL_FIRMWARE_FILES.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400">{t('flasher.swd_tool_label', 'Tool:')}</label>
                    <select value={swdTool} onChange={(e) => setSwdTool(e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-300">
                      <option value="STM32CubeProgrammer">STM32CubeProgrammer</option>
                      <option value="pyOCD">pyOCD</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1 pb-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={swdBackup} onChange={(e) => setSwdBackup(e.target.checked)} className="accent-amber-500" /> {t('flasher.swd_backup_label', 'Backup existing flash contents before programming')}
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={swdDryRun} onChange={(e) => setSwdDryRun(e.target.checked)} className="accent-amber-500" /> {t('flasher.swd_dryrun_label', 'Dry run (print the commands, execute nothing)')}
                  </label>
                </div>
                <button
                  onClick={() => onStartSwdFlash(swdApp, swdAppFile, swdBootloader, swdBootloaderFile)}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>{t('flasher.swd_show_command', 'Show equivalent desktop command')}</span>
                </button>
              </div>
            )}

            {activeFlasherTab === 'config' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('flasher.config_expansion_title', 'Expansion Board Type (0x1A0/0x1A1)')}</h3>
                  <div className="flex items-end gap-3">
                    <button onClick={() => queryAndSet(CAN_ID_EXPANSION_TYPE_RESP, 1500, (d) => setExpansionType(d[0]), 'expansion board type')} disabled={!isConnected} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs text-slate-200 transition">{t('flasher.query', 'Query')}</button>
                    <span className="text-xs text-slate-300 font-mono">{expansionType !== null ? EXPANSION_BOARD_TYPES[expansionType] ?? `unknown (${expansionType})` : '—'}</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('flasher.config_mlx_title', 'MLX9064x Sensor Variant (0x1A6/0x1A7)')}</h3>
                  <div className="flex items-end gap-3">
                    <button onClick={() => queryAndSet(CAN_ID_MLX_VARIANT_RESP, 1500, (d) => setMlxVariant(d[0]), 'MLX sensor variant')} disabled={!isConnected} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs text-slate-200 transition">{t('flasher.query', 'Query')}</button>
                    <span className="text-xs text-slate-300 font-mono">{mlxVariant !== null ? MLX_SENSOR_VARIANTS[mlxVariant] ?? `unknown (${mlxVariant})` : '—'}</span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('flasher.config_freetool_title', 'Free Tool Configuration (ID pins 11111)')}</h3>
                  <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">{t('flasher.config_freetool_sub', 'Only takes effect on a board with all 5 ID jumpers installed. Saved to non-volatile memory.')}</p>
                  <div className="flex gap-2 mb-2">
                    <select value={selectedFreeTool} onChange={(e) => setSelectedFreeTool(e.target.value)} className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300">
                      <option value="0">{t('flasher.config_freetool_none', '[0] None installed')}</option>
                      {TOOL_PROFILES.map(tool => <option key={tool.id} value={tool.id + 1}>{tool.id} - {tool.name}</option>)}
                    </select>
                    <button onClick={() => onSendFrame?.(CAN_ID_SET_FREE_TOOL, [parseInt(selectedFreeTool)], 'Program free tool config')} disabled={!isConnected} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition">{t('flasher.config_program', 'Program')}</button>
                    <button onClick={() => queryAndSet(CAN_ID_FREE_TOOL_CONFIG_RESP, 1500, (d) => setFreeToolConfig(d[1] ?? null), 'free tool config')} disabled={!isConnected} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs text-slate-200 transition">{t('flasher.query', 'Query')}</button>
                  </div>
                  {freeToolConfig !== null && <div className="text-[11px] text-slate-400">{t('flasher.config_currently', 'Currently configured:')} {freeToolConfig === 0 || freeToolConfig > 25 ? t('flasher.config_currently_none', 'none') : TOOL_PROFILES.find(t => t.id === freeToolConfig - 1)?.name ?? `#${freeToolConfig - 1}`}</div>}
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">{t('flasher.config_peripheral_title', 'Peripheral Info & Serial Number (0x1A4/0x1A5)')}</h3>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">{t('flasher.config_serial_label', 'New Serial Number:')}</label>
                      <input type="number" min="0" max="255" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300" />
                    </div>
                    <button onClick={() => queryAndSet(CAN_ID_PERIPHERAL_INFO_RESP, 1500, (d) => setPeripheralInfo({ type: d[0], serial: d[1] }), 'peripheral info')} disabled={!isConnected} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs text-slate-200 transition">{t('flasher.query', 'Query')}</button>
                    <button onClick={() => onSendFrame?.(0x1a4, [parseInt(serialNumber) & 0xFF], 'Program device serial')} disabled={!isConnected} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-lg text-xs text-slate-200 transition">{t('flasher.config_program', 'Program')}</button>
                  </div>
                  {peripheralInfo && <div className="text-[11px] text-slate-400 mt-2">{t('flasher.config_peripheral_type_label', 'Peripheral type:')} 0x{peripheralInfo.type.toString(16).padStart(2, '0')}{peripheralInfo.type === 0x03 ? ' (URTC)' : ''} &bull; {t('flasher.config_serial_field_label', 'Serial:')} {peripheralInfo.serial}</div>}
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {flasherState.mode !== 'idle' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">{flasherState.statusText}</span>
                  <span className="text-amber-400 font-bold">{flasherState.progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/30" style={{ width: `${flasherState.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Flasher Console Output Log */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full min-h-[400px]">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              {t('flasher.protocol_log_title', 'FLASHER PROTOCOL LOG')}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              {flasherState.mode === 'idle' && flasherState.progress === 100 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : null}
              {t('flasher.hmac_crc_label', 'HMAC-SHA256 & CRC32')}
            </span>
          </div>

          <div className="flex-1 p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-1.5 overflow-y-auto max-h-[420px]">
            {flasherState.log.length === 0 ? (
              <div className="text-slate-500 italic">
                {t('flasher.log_ready', 'Ready. Select a firmware image and click "START CAN-OTA UPDATE".')}
              </div>
            ) : (
              flasherState.log.map((entry, idx) => (
                <div key={idx} className="leading-relaxed">{entry}</div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
