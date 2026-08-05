import React, { useState, useEffect } from 'react';
import { FlasherState } from '../types';
import { RefreshCw, ShieldCheck, Cpu, HardDrive, CheckCircle2, AlertOctagon, Terminal, FileCode, DownloadCloud } from 'lucide-react';
import { TOOL_PROFILES } from '../data/toolsData';

interface FlasherStudioProps {
  onStartCanOta: (firmwareFile: string, fileObj?: File | null, downloadUrl?: string) => void;
  onStartSwdFlash: (firmwareFile: string, fileObj?: File | null, bootloaderFile?: string, bootloaderObj?: File | null) => void;
  flasherState: FlasherState;
  onSetFirmwareVersion: (ver: string) => void;
  onSendFrame?: (id: number, data: number[]) => Promise<void>;
}

export const FlasherStudio: React.FC<FlasherStudioProps> = ({
  onStartCanOta,
  onStartSwdFlash,
  flasherState,
  onSetFirmwareVersion,
  onSendFrame
}) => {
  const [selectedFirmware, setSelectedFirmware] = useState<string>(flasherState.selectedFile || 'URTC_v1_1_F303CC.bin');
  const [comPort, setComPort] = useState<string>('COM3');
  const [bitrate, setBitrate] = useState<string>('500 kbit/s');
  const [autoDetect, setAutoDetect] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serialNumber, setSerialNumber] = useState<string>('0');
  const [selectedFreeTool, setSelectedFreeTool] = useState<string>('0');
  const [runAppTrigger, setRunAppTrigger] = useState<boolean>(true);
  const [eraseFram, setEraseFram] = useState<boolean>(false);
  const [activeFlasherTab, setActiveFlasherTab] = useState<'can-ota' | 'swd' | 'freetool'>('can-ota');
  const [customFile, setCustomFile] = useState<File | null>(null);
  
  // GitHub Firmware State
  const [githubFirmwares, setGithubFirmwares] = useState<{name: string, size: number, download_url: string}[]>([]);
  const [isFetchingGithub, setIsFetchingGithub] = useState(false);
  const [githubError, setGithubError] = useState('');

  const fetchGithubFirmwares = async () => {
    setIsFetchingGithub(true);
    setGithubError('');
    try {
      const res = await fetch('https://api.github.com/repos/JuanenRac/URTC/contents/firmware');
      if (!res.ok) throw new Error('Failed to fetch from GitHub');
      const data = await res.json();
      const files = data.filter((item: any) => item.type === 'file' && (item.name.endsWith('.bin') || item.name.endsWith('.hex')));
      setGithubFirmwares(files);
      if (files.length > 0 && !files.find((f: any) => f.name === selectedFirmware)) {
         setSelectedFirmware(files[0].name);
      }
    } catch (e: any) {
      setGithubError(e.message);
    } finally {
      setIsFetchingGithub(false);
    }
  };

  useEffect(() => {
    fetchGithubFirmwares();
  }, []);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // SWD State
  const [swdTool, setSwdTool] = useState<string>('STM32CubeProgrammer');
  const [swdBootloader, setSwdBootloader] = useState<string>('URTC_BOOTLOADER.bin');
  const [swdApp, setSwdApp] = useState<string>('URTC_v1_1_F303CC.bin');
  const [swdBackup, setSwdBackup] = useState<boolean>(false);
  const [swdDryRun, setSwdDryRun] = useState<boolean>(false);
  
  const [swdBootloaderFile, setSwdBootloaderFile] = useState<File | null>(null);
  const [swdAppFile, setSwdAppFile] = useState<File | null>(null);

  const swdBootloaderInputRef = React.useRef<HTMLInputElement>(null);
  const swdAppInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      
      {/* Left Column: Flash Memory Map & OTA / SWD Controls */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                URTC Flasher Studio (CAN OTA & SWD/JTAG)
              </h2>
              <p className="text-xs text-slate-400">
                Golden-Image A/B Backup Slot Architecture • HMAC-SHA256 Signed OTA Updates
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full border text-xs font-mono font-semibold ${
                flasherState.firmwareVersion.startsWith('1.0')
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                Active FW: v{flasherState.firmwareVersion} ({flasherState.firmwareVersion.startsWith('1.0') ? '12 Tools' : '25 Tools'})
              </span>
            </div>
          </div>

          {/* Firmware Version Scope Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Firmware Scope & Tool Capabilities Matrix:
              </div>
              <div className="flex gap-1 font-mono text-[11px]">
                <button
                  onClick={() => onSetFirmwareVersion('1.0.0')}
                  className={`px-2 py-0.5 rounded border transition ${
                    flasherState.firmwareVersion === '1.0.0'
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  Set FW 1.0
                </button>
                <button
                  onClick={() => onSetFirmwareVersion('1.1.0')}
                  className={`px-2 py-0.5 rounded border transition ${
                    flasherState.firmwareVersion === '1.1.0'
                      ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  Set FW 1.1
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className={`p-2 rounded border ${
                flasherState.firmwareVersion.startsWith('1.0')
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="font-bold flex items-center gap-1">
                  <span>Firmware v1.0.0</span>
                  <span className="text-[9px] px-1 bg-amber-500/20 text-amber-300 rounded">12 Tools</span>
                </div>
                <div className="text-[10px] mt-0.5">
                  Supports basic shipped tool profiles (IDs 0–11: Soldering, Dispenser, Screwdriver, Vacuum, Drill, Grippers, AOI, Laser, 3D Print, Scanner).
                </div>
              </div>

              <div className={`p-2 rounded border ${
                flasherState.firmwareVersion.startsWith('1.1')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="font-bold flex items-center gap-1">
                  <span>Firmware v1.1.0</span>
                  <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-300 rounded">25 Tools</span>
                </div>
                <div className="text-[10px] mt-0.5">
                  Unlocks all 25 profiles (IDs 0–24) including 13 Expansion Profiles (Pick&Place, Spot Welder, Hot Air, Thermal MLX90640, Piezo Jet, Wire Crimp, etc.).
                </div>
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 mb-5">
            <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">Hardware Connection</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-300">
              <span className="flex-1">Hardware connection is managed globally via the top Header (Web Serial API). Connect using the <strong className="text-amber-400">USB-CAN Adapter</strong> button above.</span>
              <button 
                className="px-6 py-2 bg-slate-800 text-slate-300 font-semibold rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Firmware Utility Ready</span>
              </button>
            </div>
          </div>


          {/* Flash Memory Architecture Visualizer */}
          <div className="mb-6 space-y-2">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>STM32F303CC FLASH MEMORY MAP (256 KB TOTAL)</span>
              <span>0x08000000 - 0x08040000</span>
            </div>

            <div className="grid grid-cols-12 gap-1 text-[10px] font-mono text-center">
              {/* Bootloader 30K */}
              <div className="col-span-2 p-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <div className="font-bold">BOOTLOADER</div>
                <div>30 KB</div>
                <div className="text-[9px] text-amber-400/80 mt-1">0x08000000</div>
              </div>

              {/* Metadata 2K */}
              <div className="col-span-1 p-2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                <div className="font-bold">META</div>
                <div>2 KB</div>
                <div className="text-[9px] text-slate-500 mt-1">0x08007800</div>
              </div>

              {/* Main Slot 112K */}
              <div className="col-span-4 p-2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                <div className="font-bold">MAIN SLOT (ACTIVE APP)</div>
                <div>112 KB</div>
                <div className="text-[9px] text-emerald-400/80 mt-1">0x08008000</div>
              </div>

              {/* Backup Slot 112K */}
              <div className="col-span-5 p-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                <div className="font-bold">BACKUP STAGING SLOT</div>
                <div>112 KB</div>
                <div className="text-[9px] text-cyan-400/80 mt-1">0x08024000</div>
              </div>
            </div>
          </div>

          {/* Firmware Selection & Actions */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
            
            <div className="flex gap-2 border-b border-slate-800/60 pb-2 mb-3">
              <button 
                onClick={() => setActiveFlasherTab('can-ota')}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                  activeFlasherTab === 'can-ota' 
                    ? 'bg-slate-800 text-slate-200 border-slate-700' 
                    : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'
                }`}>CAN-OTA Programming</button>
              <button 
                onClick={() => setActiveFlasherTab('swd')}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                  activeFlasherTab === 'swd' 
                    ? 'bg-slate-800 text-slate-200 border-slate-700' 
                    : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'
                }`}>SWD/JTAG Programming</button>
              <button 
                onClick={() => setActiveFlasherTab('freetool')}
                className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                  activeFlasherTab === 'freetool' 
                    ? 'bg-slate-800 text-slate-200 border-slate-700' 
                    : 'bg-transparent text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-800'
                }`}>Free tool config (ID pin 11111)</button>
            </div>
            
            {activeFlasherTab === 'can-ota' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Firmware Image (.bin / .hex):
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedFirmware}
                      onChange={(e) => {
                        setSelectedFirmware(e.target.value);
                        setCustomFile(null); // Clear custom file if preset is selected
                      }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    >
                      <optgroup label="Local (firmware/)">
                        <option value="URTC_v1_1_F303CC.bin">✓ URTC_v1_1_F303CC.bin (Version 1.1, 112KB)</option>
                        <option value="URTC_v1_0_F303CC.bin">✓ URTC_v1_0_F303CC.bin (Version 1.0, 112KB)</option>
                        <option value="URTC_SLAVE_APP.bin">✓ URTC_SLAVE_APP.bin (Slave STM32F303CB, 64KB)</option>
                      </optgroup>
                      {githubFirmwares.length > 0 && (
                        <optgroup label="GitHub Repository">
                          {githubFirmwares.filter(fw => !fw.name.toLowerCase().includes('bootloader')).map(fw => (
                            <option key={fw.name} value={fw.name}>{fw.name} ({Math.round(fw.size / 1024)}KB)</option>
                          ))}
                        </optgroup>
                      )}
                      {customFile && <option value={customFile.name}>{customFile.name} (Custom)</option>}
                    </select>
                    <input 
                      type="file" 
                      accept=".bin,.hex" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          setCustomFile(file);
                          setSelectedFirmware(file.name);
                        }
                      }} 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition whitespace-nowrap"
                    >
                      Browse bin...
                    </button>
                  </div>
                </div>
                
                {/* Flash Settings */}
                <div className="space-y-3 pt-2 pb-2">
                  <div className="flex flex-col gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={runAppTrigger} onChange={(e) => setRunAppTrigger(e.target.checked)} className="mt-0.5 accent-amber-500 rounded bg-slate-900 border-slate-700" />
                      <div>
                        <span className="font-semibold block text-slate-200">Board is currently running the application (send 0x7F0 trigger first)</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Uncheck this if the board is already sitting in the bootloader (fresh flash, or no valid application currently present)</span>
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={eraseFram} onChange={(e) => setEraseFram(e.target.checked)} className="mt-0.5 accent-amber-500 rounded bg-slate-900 border-slate-700" />
                      <div>
                        <span className="font-semibold block text-slate-200">Also erase the persistence F-RAM before flashing</span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Optional, off by default. Wipes the board's saved tool-parameter state (see CANBUS.TXT 0x190-0192).</span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-slate-400">Target Node Serial (0-255):</label>
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onStartCanOta(selectedFirmware, customFile)}
                    disabled={flasherState.mode !== 'idle'}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition shadow-md shadow-amber-500/10 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${flasherState.mode !== 'idle' ? 'animate-spin' : ''}`} />
                    <span>START CAN-OTA UPDATE ({selectedFirmware.includes('v1_0') ? 'v1.0' : 'v1.1'})</span>
                  </button>
                </div>
              </>
            )}

            {activeFlasherTab === 'swd' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Bootloader File (.bin):</label>
                  <div className="flex gap-2">
                    <select
                      value={swdBootloader}
                      onChange={(e) => {
                        setSwdBootloader(e.target.value);
                        setSwdBootloaderFile(null);
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    >
                      <optgroup label="Local (firmware/)">
                        <option value="URTC_BOOTLOADER.bin">URTC_BOOTLOADER.bin (16.1KB)</option>
                      </optgroup>
                      {githubFirmwares.length > 0 && (
                        <optgroup label="GitHub Repository">
                          {githubFirmwares.filter(fw => fw.name.toLowerCase().includes('bootloader')).map(fw => (
                            <option key={fw.name} value={fw.name}>{fw.name} ({Math.round(fw.size / 1024)}KB)</option>
                          ))}
                        </optgroup>
                      )}
                      {swdBootloaderFile && <option value={swdBootloaderFile.name}>{swdBootloaderFile.name} (Custom)</option>}
                    </select>
                    <input 
                      type="file" 
                      accept=".bin,.hex" 
                      ref={swdBootloaderInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSwdBootloaderFile(e.target.files[0]);
                          setSwdBootloader(e.target.files[0].name);
                        }
                      }} 
                    />
                    <button 
                      onClick={fetchGithubFirmwares}
                      disabled={isFetchingGithub}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition border border-slate-700 disabled:opacity-50 flex items-center justify-center"
                      title="Refresh from GitHub"
                    >
                      <DownloadCloud className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => swdBootloaderInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition"
                    >
                      Browse...
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Application File (.bin):</label>
                  <div className="flex gap-2">
                    <select
                      value={swdApp}
                      onChange={(e) => {
                        setSwdApp(e.target.value);
                        setSwdAppFile(null);
                      }}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                    >
                      <optgroup label="Local (firmware/)">
                        <option value="URTC_v1_1_F303CC.bin">✓ URTC_v1_1_F303CC.bin (Version 1.1, 112KB)</option>
                        <option value="URTC_v1_0_F303CC.bin">✓ URTC_v1_0_F303CC.bin (Version 1.0, 112KB)</option>
                        <option value="URTC_SLAVE_APP.bin">✓ URTC_SLAVE_APP.bin (Slave STM32F303CB, 64KB)</option>
                      </optgroup>
                      {githubFirmwares.length > 0 && (
                        <optgroup label="GitHub Repository">
                          {githubFirmwares.filter(fw => !fw.name.toLowerCase().includes('bootloader')).map(fw => (
                            <option key={fw.name} value={fw.name}>{fw.name} ({Math.round(fw.size / 1024)}KB)</option>
                          ))}
                        </optgroup>
                      )}
                      {swdAppFile && <option value={swdAppFile.name}>{swdAppFile.name} (Custom)</option>}
                    </select>
                    <input 
                      type="file" 
                      accept=".bin,.hex" 
                      ref={swdAppInputRef} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSwdAppFile(e.target.files[0]);
                          setSwdApp(e.target.files[0].name);
                        }
                      }} 
                    />
                    <button 
                      onClick={fetchGithubFirmwares}
                      disabled={isFetchingGithub}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition border border-slate-700 disabled:opacity-50 flex items-center justify-center"
                      title="Refresh from GitHub"
                    >
                      <DownloadCloud className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => swdAppInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition"
                    >
                      Browse...
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400">Tool:</label>
                    <select value={swdTool} onChange={(e) => setSwdTool(e.target.value)} className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500">
                      <option value="STM32CubeProgrammer">STM32CubeProgrammer</option>
                      <option value="pyOCD">pyOCD</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400">Probe:</label>
                    <div className="flex gap-2">
                      <select className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500">
                        <option value="">(none found)</option>
                      </select>
                      <button className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition">↻</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 pt-1 pb-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={swdBackup} onChange={(e) => setSwdBackup(e.target.checked)} className="accent-amber-500 rounded bg-slate-900 border-slate-700" />
                    Backup existing flash contents before programming
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={swdDryRun} onChange={(e) => setSwdDryRun(e.target.checked)} className="accent-amber-500 rounded bg-slate-900 border-slate-700" />
                    Dry run (Check connectivity and readout protection only)
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onStartSwdFlash(swdApp, swdAppFile, swdBootloader, swdBootloaderFile)}
                    disabled={flasherState.mode !== 'idle'}
                    className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                  >
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>MASS ERASE & SWD FLASH</span>
                  </button>
                </div>
              </div>
            )}
            
            {activeFlasherTab === 'freetool' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Free Tool Configuration</h3>
                  <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                    This configures the tool profile for a board that has all 5 ID pins pulled high (11111). 
                    It has no effect on any other board. The configuration is saved to the board's non-volatile memory.
                  </p>
                  
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-300">Select Tool Profile:</label>
                    <div className="flex gap-2">
                      <select 
                      value={selectedFreeTool}
                      onChange={(e) => setSelectedFreeTool(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500">
                        <option value="0">[0] None installed</option>
                        {TOOL_PROFILES.map(tool => (
                          <option key={tool.id} value={tool.id}>{tool.id} - {tool.name}</option>
                        ))}
                      </select>
                      <button 
                      onClick={() => onSendFrame?.(0x1A2, [parseInt(selectedFreeTool)])}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition">
                        Program
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">Peripheral Info & Serial Number</h3>
                  <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                    Query the board's hardware identity, or reassign its CAN bus serial number (0-255).
                    The serial number is used to tell multiple boards of the same type apart.
                  </p>
                  
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">New Serial Number:</label>
                      <input type="number" min="0" max="255" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500" />
                    </div>
                    <button onClick={() => onSendFrame?.(0x1A5, [])} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200 transition">Query</button>
                    <button onClick={() => onSendFrame?.(0x1A4, [parseInt(serialNumber)])} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-200 transition">Program</button>
                  </div>
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
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300 shadow-sm shadow-amber-500/30"
                    style={{ width: `${flasherState.progress}%` }}
                  />
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
              FLASHER PROTOCOL LOG
            </span>
            <div className="flex gap-2">
              <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-slate-300 transition">
                Export Debug Bundle...
              </button>
              <span className="text-[10px] text-slate-500 flex items-center">HMAC-SHA256 & CRC32</span>
            </div>
          </div>

          <div className="flex-1 p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-1.5 overflow-y-auto max-h-[420px]">
            {flasherState.log.length === 0 ? (
              <div className="text-slate-500 italic">
                Ready. Select a firmware image and click "START CAN-OTA UPDATE" or "MASS ERASE & SWD FLASH".
              </div>
            ) : (
              flasherState.log.map((entry, idx) => (
                <div key={idx} className="leading-relaxed">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
