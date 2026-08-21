import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ToolCatalog } from './components/ToolCatalog';
import { OledDisplay } from './components/OledDisplay';
import { HardwarePanel } from './components/HardwarePanel';
import { CanBusAnalyzer } from './components/CanBusAnalyzer';
import { FlasherStudio } from './components/FlasherStudio';
import { ThermalCameraViewer } from './components/ThermalCameraViewer';
import { SpecsAndBomViewer } from './components/SpecsAndBomViewer';
import { TesterStudio } from './components/TesterStudio';
import { TOOL_PROFILES } from './data/toolsData';
import { HardwareState, CanFrame, ExpansionBoardType } from './types';
import { useSerialCanBus } from './hooks/useSerialCanBus';
import { useFlasher } from './hooks/useFlasher';
import {
  CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE, CAN_ID_BOOTLOADER_VERSION_RESPONSE,
  THIS_HARDWARE_ID, FIRMWARE_VERSION_MAJOR, FIRMWARE_VERSION_MINOR,
  parseManifest, computeSha256Hex, FirmwareManifest
} from './lib/flasher';

export interface BoardVersionInfo {
  responder: 'application' | 'bootloader';
  hardwareId: number;
  appMajor: number;
  appMinor: number;
  bootMajor?: number;
  bootMinor?: number;
  bootPatch?: number;
}

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'control' | 'oled' | 'can' | 'flasher' | 'thermal' | 'specs' | 'tester'>('control');
  
  // CAN Bus Frames Log
  const [canFrames, setCanFrames] = useState<CanFrame[]>([]);

  const handleFrameReceived = React.useCallback((frame: CanFrame) => {
    setCanFrames(prev => [frame, ...prev.slice(0, 99)]);
    setHardwareState(prev => {
      const newState = {
        ...prev,
        canActive: true,
        lastCanTimestamp: Date.now()
      };
      
      // Parse CAN_ID_ACTIVE_TOOL_RESP (0x111)
      if (frame.id === 0x111 && frame.data.length >= 4) {
        const toolId = frame.data[0];
        newState.jumpers = [
          Boolean(toolId & 0x01),
          Boolean(toolId & 0x02),
          Boolean(toolId & 0x04),
          Boolean(toolId & 0x08),
          Boolean(toolId & 0x10)
        ];
        newState.systemError = frame.data[1] !== 0;
        newState.systemErrorMessage = newState.systemError ? 'CRITICAL ERROR DECLARED' : '';
      }

      // Parse Telemetry (e.g., Solder Temperature 0x135)
      // Assuming payload has temperature in some bytes. Real payload: struct.pack(">hB", current_temp, endstop)
      if (frame.id === 0x135 && frame.data.length >= 2) {
         const temp = (frame.data[0] << 8) | frame.data[1];
         // It's tricky to map it perfectly without knowing active tool ID, but we can just set liveReadings for ID 1
         setLiveReadings(r => ({ ...r, 1: temp }));
      }
      
      return newState;
    });
  }, []);

  const serialCan = useSerialCanBus(handleFrameReceived);
  
  // Hardware state
  const [hardwareState, setHardwareState] = useState<HardwareState>({
    jumpers: [false, false, false, false, false], // ID 0 by default (T12 Soldering Station)
    freeConfigFramId: 0,
    systemError: false,
    systemErrorMessage: '',
    canActive: true,
    lastCanTimestamp: Date.now(),
    ledMode: 'auto',
    ledOverrideColor: { r: 0, g: 0, b: 0 },
    ledOverrideExpires: 0,
    ringLedBrightness: 80,
    ringLedStrobe: false,
    expansionBoard: 'none',
    expansionMotorCurrent: 2.0,
    oledInverted: false,
    oledNightMode: false,
    oledShowSplash: false,
    framSavedSetpoints: { 0: 320, 1: 1.5, 9: 0, 10: 215 },
    framLastWriteTime: '2026-08-03 09:40:00'
  });

  // Active Tool ID calculated from 5 jumpers or free config
  const jumperDecimal = hardwareState.jumpers.reduce((acc, bit, idx) => acc + (bit ? (1 << idx) : 0), 0);
  const isFreeConfig = jumperDecimal === 31;
  const activeToolId = isFreeConfig ? hardwareState.freeConfigFramId : jumperDecimal;
  const isInvalidToolId = activeToolId > 24 && activeToolId !== 31;

  const activeTool = TOOL_PROFILES.find(t => t.id === activeToolId) || TOOL_PROFILES[0];

  // Setpoint & Live reading state
  const [setpoints, setSetpoints] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    TOOL_PROFILES.forEach(t => {
      initial[t.id] = t.defaultSetpoint;
    });
    return initial;
  });

  const [liveReadings, setLiveReadings] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    TOOL_PROFILES.forEach(t => {
      initial[t.id] = t.defaultSetpoint;
    });
    return initial;
  });

  // Cosmetic sandbox toggle for the Control/OLED/Specs demo tabs only (which
  // tool profiles a given firmware build would unlock) - unrelated to the
  // real, queried board version shown in Flasher/Tester Studio once connected.
  const [firmwareVersion, setFirmwareVersion] = useState<string>('1.1.0');
  const handleSetFirmwareVersion = (ver: string) => {
    setFirmwareVersion(ver);
    logCanFrame('0x7F9', `01 ${ver === '1.0.0' ? '00' : '01'} 00 F3 03 00 00 00`, `Sandbox firmware version switched to v${ver}`, 'Rx');
  };

  const flasher = useFlasher(serialCan);
  const [boardVersion, setBoardVersion] = useState<BoardVersionInfo | null>(null);

  const handleQueryVersion = async () => {
    if (!serialCan.isConnected) return;
    await serialCan.sendFrame(CAN_ID_QUERY_VERSION, [0x00], 'Query board version');
    const resp = await serialCan.waitForFrame(CAN_ID_VERSION_RESPONSE, 1500);
    if (!resp || resp.data.length < 8) { setBoardVersion(null); return; }
    const responder: BoardVersionInfo['responder'] = resp.data[0] === 0x00 ? 'application' : 'bootloader';
    const hardwareId = ((resp.data[1] << 24) | (resp.data[2] << 16) | (resp.data[3] << 8) | resp.data[4]) >>> 0;
    const appMajor = (resp.data[5] << 8) | resp.data[6];
    const appMinor = resp.data[7];
    const info: BoardVersionInfo = { responder, hardwareId, appMajor, appMinor };

    if (responder === 'bootloader') {
      // Order between 0x7F9/0x7FA isn't guaranteed - grace window for the companion frame.
      const bootResp = await serialCan.waitForFrame(CAN_ID_BOOTLOADER_VERSION_RESPONSE, 300);
      if (bootResp && bootResp.data.length >= 3) {
        info.bootMajor = bootResp.data[0];
        info.bootMinor = bootResp.data[1];
        info.bootPatch = bootResp.data[2];
      }
    }
    setBoardVersion(info);
  };

  // Helper to log a CAN frame (or send it if hardware is connected)
  const logCanFrame = (idHex: string, dataHex: string, desc: string, direction: 'Tx' | 'Rx' = 'Tx') => {
    const idNum = parseInt(idHex.replace('0x', ''), 16);
    const dataBytes = dataHex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16));

    if (direction === 'Tx' && serialCan.isConnected) {
      serialCan.sendFrame(idNum, dataBytes, desc).catch(console.error);
      return; // sendFrame already adds to the log
    }

    if (direction === 'Rx' && serialCan.isConnected) {
      // Don't simulate Rx if we have real hardware connected
      return;
    }

    const dlc = dataBytes.length;
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    const frame: CanFrame = {
      id: idNum,
      idHex,
      dlc,
      data: dataBytes,
      dataHex,
      timestamp,
      direction,
      description: desc
    };

    setCanFrames(prev => [frame, ...prev.slice(0, 99)]);
    
    // Update CAN active timestamp
    setHardwareState(prev => ({
      ...prev,
      canActive: true,
      lastCanTimestamp: Date.now()
    }));
  };

  // Periodic simulation loop (CAN watchdog LED reset). Mount-once: reads the
  // latest state via the functional setState updater instead of closing over
  // `hardwareState` directly, so this doesn't need hardwareState (or any other
  // state) in its dependency array. hardwareState.lastCanTimestamp is bumped
  // on every incoming CAN frame, so depending on hardwareState here would
  // tear down and recreate the interval on every single frame, undermining
  // the very inactivity watchdog it implements (activeToolId/setpoints
  // aren't even read by the effect body).
  useEffect(() => {
    const interval = setInterval(() => {
      setHardwareState(prev => {
        let next = prev;

        // Check LED override timeout (10 seconds)
        if (prev.ledMode === 'override' && Date.now() > prev.ledOverrideExpires) {
          next = { ...next, ledMode: 'auto' };
        }

        // Check CAN active timeout (1.5 seconds)
        if (prev.canActive && Date.now() - prev.lastCanTimestamp > 1500) {
          next = { ...next, canActive: false };
        }

        return next; // same reference when nothing changed - no extra re-render
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Handle jumper toggle
  const handleJumperToggle = (idx: number) => {
    setHardwareState(prev => {
      const nextJumpers = [...prev.jumpers];
      nextJumpers[idx] = !nextJumpers[idx];
      return { ...prev, jumpers: nextJumpers };
    });
    logCanFrame('0x111', `${activeToolId.toString(16).padStart(2, '0')} 00 00 00 00 00 00 00`, `Active Tool ID Changed to #${activeToolId}`, 'Rx');
  };

  // Handle direct tool selection from catalog
  const handleSelectToolFromCatalog = (id: number) => {
    // Set 5-bit jumpers corresponding to ID
    const jumpers = [
      Boolean(id & 0x01),
      Boolean(id & 0x02),
      Boolean(id & 0x04),
      Boolean(id & 0x08),
      Boolean(id & 0x10)
    ];
    setHardwareState(prev => ({ ...prev, jumpers }));
    logCanFrame('0x110', `${id.toString(16).padStart(2, '0')} 00 00 00 00 00 00 00`, `Catalog Selected Tool #${id} (${TOOL_PROFILES[id]?.name})`, 'Tx');
  };

  // Setpoint change
  const handleSetpointChange = (val: number) => {
    setSetpoints(prev => ({ ...prev, [activeToolId]: val }));
    logCanFrame('0x190', `${activeToolId.toString(16).padStart(2, '0')} ${(Math.round(val) & 0xFF).toString(16).padStart(2, '0')} 00 00 00 00 00 00`, `Setpoint Updated for Tool #${activeToolId} -> ${val.toFixed(1)}`);
  };

  // Save to F-RAM
  const handleSaveToFram = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setHardwareState(prev => ({
      ...prev,
      framSavedSetpoints: { ...setpoints },
      framLastWriteTime: nowStr
    }));
    logCanFrame('0x191', `0x191 ACK`, `FM24CL64B F-RAM Setpoints Saved Snapshot`, 'Rx');
  };

  // Custom CAN send - raw frame injector (CanBusAnalyzer). Validated the same
  // way as its protected twin, tester/GlobalPanels.tsx's CustomFramePanel:
  // mask the ID to the 11-bit CAN standard range, and drop any non-hex/out
  // -of-range data tokens before capping to the 8-byte CAN payload limit.
  const handleSendCustomFrame = (idHex: string, dataHex: string, desc: string) => {
    const idNum = (parseInt(idHex.replace('0x', ''), 16) || 0) & 0x7FF;
    const bytes = dataHex.trim().split(/\s+/).filter(Boolean)
      .map(h => parseInt(h, 16))
      .filter(b => Number.isFinite(b) && b >= 0 && b <= 0xFF)
      .slice(0, 8);

    const safeIdHex = `0x${idNum.toString(16).toUpperCase().padStart(3, '0')}`;
    const safeDataHex = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    logCanFrame(safeIdHex, safeDataHex, desc, 'Tx');

    // Handle special command triggers
    if (safeIdHex.toLowerCase() === '0x100' && bytes.length >= 3) {
      setHardwareState(prev => ({
        ...prev,
        ledMode: 'override',
        ledOverrideColor: { r: bytes[0], g: bytes[1], b: bytes[2] },
        ledOverrideExpires: Date.now() + 10000
      }));
    }
  };

  // Preset triggers
  const handleTriggerPreset = (presetId: string) => {
    switch (presetId) {
      case '0x110':
        logCanFrame('0x110', '00 00 00 00 00 00 00 00', 'Host Query Active Tool Profile', 'Tx');
        setTimeout(() => {
          logCanFrame('0x111', `${activeToolId.toString(16).padStart(2, '0')} 00 00 00 00 00 00 00`, `URTC Response: Active Tool #${activeToolId} (${activeTool.name})`, 'Rx');
        }, 150);
        break;
      case '0x100':
        logCanFrame('0x100', 'FF 80 00 64 00 00 00 00', 'Set LED RGB (255,128,0) & Ring 100%', 'Tx');
        setHardwareState(prev => ({
          ...prev,
          ledMode: 'override',
          ledOverrideColor: { r: 255, g: 128, b: 0 },
          ledOverrideExpires: Date.now() + 10000
        }));
        break;
      case '0x190':
        logCanFrame('0x190', '00 00 00 00 00 00 00 00', 'Host Request F-RAM Setpoints Dump', 'Tx');
        setTimeout(() => {
          logCanFrame('0x191', '00 01 40 01 00 00 00 00', 'F-RAM Dump: Tool setpoints retrieved', 'Rx');
        }, 150);
        break;
      case '0x180':
        logCanFrame('0x180', '80 00 01 07 00 00 00 00', 'Expansion SPI Passthrough -> TMC5160 DRVCTRL', 'Tx');
        setTimeout(() => {
          logCanFrame('0x181', '00 00 01 07 00 00 00 00', 'Expansion SPI Reply <- TMC5160 Register Status', 'Rx');
        }, 150);
        break;
      case '0x7F0':
        logCanFrame('0x7F0', 'B0 07 1D 5A 00 00 00 00', 'Trigger CAN OTA Reset Payload', 'Tx');
        setTimeout(() => {
          logCanFrame('0x7F5', '01 00 00 00 00 00 00 00', 'Bootloader Status: Listening (0x01)', 'Rx');
        }, 300);
        break;
      case '0x7F8':
        logCanFrame('0x7F8', '00 00 00 00 00 00 00 00', 'Version Query Request', 'Tx');
        setTimeout(() => {
          logCanFrame('0x7F9', '01 01 00 F3 03 00 00 00', 'App Version: 1.1.0, HW ID: 0xF303', 'Rx');
          logCanFrame('0x7FA', '01 01 01 F3 03 00 00 00', 'Bootloader Version: 1.1.1, HW ID: 0xF303', 'Rx');
        }, 150);
        break;
      default:
        logCanFrame(presetId, '00 00 00 00 00 00 00 00', `Generic predefined command ${presetId}`, 'Tx');
        break;
    }
  };

  // Replay boot splash
  const handleResetSplash = () => {
    setHardwareState(prev => ({ ...prev, oledShowSplash: true }));
    setTimeout(() => {
      setHardwareState(prev => ({ ...prev, oledShowSplash: false }));
    }, 2500);
  };

  // Best-effort <file>.manifest.json sidecar lookup, mirroring the Python
  // flasher's own URTCFlasher._check_manifest: only reachable for files that
  // came from a known URL (GitHub listing or the local /firmware/ folder) -
  // a browser-picked File object has no fetchable sidecar.
  const tryFetchManifest = async (fileName: string, downloadUrl?: string): Promise<FirmwareManifest | null> => {
    const manifestUrl = downloadUrl ? `${downloadUrl}.manifest.json` : `/firmware/${fileName}.manifest.json`;
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) return null;
      return parseManifest(await res.json());
    } catch {
      return null;
    }
  };

  const loadFirmwareBytes = async (fwFile: string, fileObj?: File | null, downloadUrl?: string): Promise<Uint8Array> => {
    if (fileObj) return new Uint8Array(await fileObj.arrayBuffer());
    const res = await fetch(downloadUrl || `/firmware/${fwFile}`);
    if (!res.ok) throw new Error(t('flasher.error_fetch_firmware', 'Failed to fetch firmware file'));
    return new Uint8Array(await res.arrayBuffer());
  };

  // Start REAL CAN-OTA update (main board or expansion slave)
  const handleStartCanOta = async (
    target: 'main' | 'slave',
    fwFile: string,
    fileObj: File | null | undefined,
    downloadUrl: string | undefined,
    opts: { triggerBootloader: boolean; eraseFram: boolean; allowDowngrade: boolean }
  ) => {
    if (!serialCan.isConnected) {
      alert(t('flasher.alert_connect_first', 'Please connect to the USB-CAN adapter first using the top header.'));
      return;
    }
    const fileName = fileObj ? fileObj.name : fwFile;
    flasher.setFlasherState(prev => ({ ...prev, selectedFile: fileName, log: [] }));

    let data: Uint8Array;
    try {
      data = await loadFirmwareBytes(fwFile, fileObj, downloadUrl);
    } catch (e: any) {
      flasher.setFlasherState(prev => ({ ...prev, log: [...prev.log, t('flasher.log_could_not_read', 'ERROR: could not read firmware file: {{message}}', { message: e.message })] }));
      return;
    }

    const manifest = fileObj ? null : await tryFetchManifest(fileName, downloadUrl);
    let reportMajor = FIRMWARE_VERSION_MAJOR, reportMinor = FIRMWARE_VERSION_MINOR;
    if (manifest?.versionMajor !== undefined) {
      reportMajor = manifest.versionMajor;
      reportMinor = manifest.versionMinor!;
      flasher.appendLog(t('flasher.log_manifest_found', 'Manifest found: reporting declared version {{version}} to the bootloader.', { version: manifest.version }));
    }
    if (manifest?.sha256) {
      const actual = await computeSha256Hex(data.buffer as ArrayBuffer);
      if (actual !== manifest.sha256) {
        flasher.appendLog(t('flasher.log_manifest_mismatch', "WARNING: manifest sha256 does not match the selected file (manifest={{manifest}}, actual={{actual}}). Continuing - the bootloader's own CRC32+HMAC check is the real gate.", { manifest: manifest.sha256, actual }));
      }
    }

    try {
      if (target === 'slave') {
        await flasher.flashSlave(data, { triggerBootloader: opts.triggerBootloader, reportMajor, reportMinor });
      } else {
        await flasher.flashMain(data, { ...opts, reportMajor, reportMinor });
        handleResetSplash();
      }
    } catch (e: any) {
      flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', statusText: t('flasher.status_update_failed', 'Update failed'), log: [...prev.log, t('flasher.log_error_prefix', 'ERROR: {{message}}', { message: e.message })] }));
    }
  };

  const handleCancelFlash = () => {
    flasher.cancel();
  };

  // Backup / readback the main board's currently installed firmware over CAN
  const handleReadback = async () => {
    if (!serialCan.isConnected) {
      alert(t('flasher.alert_connect_first', 'Please connect to the USB-CAN adapter first using the top header.'));
      return;
    }
    flasher.setFlasherState(prev => ({ ...prev, mode: 'receiving', progress: 0, statusText: t('flasher.status_reading_back', 'Reading back main slot over CAN...'), log: [t('flasher.log_starting_readback', 'Starting flash readback (0x7FE/0x7FF)...')] }));
    try {
      const data = await flasher.readBack((pct) => {
        flasher.setFlasherState(prev => ({ ...prev, progress: pct }));
      });
      const suggestedName = `URTC_readback_${new Date().toISOString().replace(/[:.]/g, '-')}.bin`;

      // File System Access API (same Chromium-only browser family already
      // required for Web Serial, so no extra compatibility cost) lets the
      // user pick where to save, closer to the desktop Flasher's native
      // "Save As..." dialog. Falls back to the existing <a download> Blob
      // approach (straight to the Downloads folder) when unavailable - e.g.
      // an insecure context, or a browser build without the picker.
      if ('showSaveFilePicker' in window) {
        try {
          // @ts-ignore - showSaveFilePicker isn't in the default TS DOM lib
          const handle = await window.showSaveFilePicker({
            suggestedName,
            types: [{ description: 'Firmware binary', accept: { 'application/octet-stream': ['.bin'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(data);
          await writable.close();
        } catch (pickerErr: any) {
          if (pickerErr?.name === 'AbortError') {
            // User cancelled the save dialog - the readback itself already
            // succeeded, so report that instead of treating this as a failure.
            flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_readback_cancelled', 'Readback complete ({{bytes}} bytes) but the save dialog was cancelled.', { bytes: data.length }), log: [...prev.log, t('flasher.log_readback_save_cancelled', 'Save dialog cancelled - data was not written to disk.')] }));
            return;
          }
          throw pickerErr;
        }
      } else {
        const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        a.click();
        URL.revokeObjectURL(url);
      }
      flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_readback_complete', 'Readback complete: {{bytes}} bytes saved.', { bytes: data.length }), log: [...prev.log, t('flasher.log_readback_success', 'Readback SUCCESS: {{bytes}} bytes.', { bytes: data.length })] }));
    } catch (e: any) {
      flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', statusText: t('flasher.status_readback_failed', 'Readback failed'), log: [...prev.log, t('flasher.log_error_prefix', 'ERROR: {{message}}', { message: e.message })] }));
    }
  };

  // SWD/JTAG full-chip programming needs to spawn STM32CubeProgrammer/pyOCD as a
  // local subprocess against the ST-Link probe - Web Serial has no such capability,
  // and there is no browser API that can drive an SWD probe directly. This is a
  // structural limitation of running in a browser, not a missing feature - use the
  // URTC Flasher desktop tool (same repo family) for SWD/JTAG programming.
  const handleStartSwdFlash = (fwFile: string, fileObj?: File | null, bootloaderFile?: string, bootloaderObj?: File | null) => {
    const appName = fileObj ? fileObj.name : fwFile;
    const bootName = bootloaderObj ? bootloaderObj.name : (bootloaderFile || 'URTC_BOOTLOADER.bin');

    flasher.setFlasherState(prev => ({
      ...prev,
      mode: 'idle',
      progress: 0,
      selectedFile: appName,
      statusText: t('flasher.status_swd_not_possible', 'SWD/JTAG requires a local tool - not possible from a browser'),
      log: [
        t('flasher.log_swd_not_available', '[Not available] Web Serial cannot drive an SWD/JTAG probe - there is no browser API for it, so this is a structural limitation, not a missing feature.'),
        t('flasher.log_swd_use_desktop', 'Use the URTC Flasher desktop tool instead: it shells out to STM32CubeProgrammer or pyOCD to flash {{boot}} at 0x08000000 and {{app}} at 0x08008000.', { boot: bootName, app: appName })
      ]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      
      {/* Header */}
      <Header
        hardwareState={hardwareState}
        activeToolName={activeTool.name}
        firmwareVersion={firmwareVersion}
        onSetFirmwareVersion={handleSetFirmwareVersion}
        isConnected={serialCan.isConnected}
        onConnect={serialCan.connect}
        onDisconnect={serialCan.disconnect}
        portName={serialCan.portName}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 max-w-[1400px] w-full mx-auto">
        {/* Left Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace */}
        <main className="flex-1 p-2 md:p-4 space-y-4 pb-8 min-w-0">
          
          {/* TAB 1: Tool Matrix & Live Control */}
          {activeTab === 'control' && (
          <div className="space-y-4">
            <ToolCatalog
              selectedToolId={activeToolId}
              onSelectTool={handleSelectToolFromCatalog}
              setpoint={setpoints[activeToolId] ?? activeTool.defaultSetpoint}
              onSetpointChange={handleSetpointChange}
              liveReading={liveReadings[activeToolId] ?? activeTool.defaultSetpoint}
              hardwareState={hardwareState}
              onSaveToFram={handleSaveToFram}
              firmwareVersion={firmwareVersion}
              onSwitchToFirmware11={() => handleSetFirmwareVersion('1.1.0')}
            />

            {/* Compact OLED & Hardware Quick-Peek */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-900">
              <OledDisplay
                activeTool={activeTool}
                setpoint={setpoints[activeToolId] ?? activeTool.defaultSetpoint}
                liveReading={liveReadings[activeToolId] ?? activeTool.defaultSetpoint}
                hardwareState={hardwareState}
                invalidToolId={isInvalidToolId}
                onResetSplash={handleResetSplash}
                firmwareVersion={firmwareVersion}
              />

              <HardwarePanel
                hardwareState={hardwareState}
                onJumperToggle={handleJumperToggle}
                onSetFreeConfigId={(id) => setHardwareState(prev => ({ ...prev, freeConfigFramId: id }))}
                onToggleFault={() => setHardwareState(prev => ({ ...prev, systemError: !prev.systemError }))}
                onLedOverride={(r, g, b) => {
                  setHardwareState(prev => ({
                    ...prev,
                    ledMode: 'override',
                    ledOverrideColor: { r, g, b },
                    ledOverrideExpires: Date.now() + 10000
                  }));
                }}
                onResetLedAuto={() => setHardwareState(prev => ({ ...prev, ledMode: 'auto' }))}
                onSetRingBrightness={(val) => setHardwareState(prev => ({ ...prev, ringLedBrightness: val }))}
                onSetExpansionBoard={(board: ExpansionBoardType) => setHardwareState(prev => ({ ...prev, expansionBoard: board }))}
                activeToolName={activeTool.name}
                firmwareVersion={firmwareVersion}
              />
            </div>
          </div>
        )}

        {/* TAB 2: OLED & Hardware Monitor */}
        {activeTab === 'oled' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-12 xl:col-span-6">
                <OledDisplay
                  activeTool={activeTool}
                  setpoint={setpoints[activeToolId] ?? activeTool.defaultSetpoint}
                  liveReading={liveReadings[activeToolId] ?? activeTool.defaultSetpoint}
                  hardwareState={hardwareState}
                  invalidToolId={isInvalidToolId}
                  onResetSplash={handleResetSplash}
                  firmwareVersion={firmwareVersion}
                />
              </div>

              <div className="lg:col-span-6">
                <HardwarePanel
                  hardwareState={hardwareState}
                  onJumperToggle={handleJumperToggle}
                  onSetFreeConfigId={(id) => setHardwareState(prev => ({ ...prev, freeConfigFramId: id }))}
                  onToggleFault={() => setHardwareState(prev => ({ ...prev, systemError: !prev.systemError }))}
                  onLedOverride={(r, g, b) => {
                    setHardwareState(prev => ({
                      ...prev,
                      ledMode: 'override',
                      ledOverrideColor: { r, g, b },
                      ledOverrideExpires: Date.now() + 10000
                    }));
                  }}
                  onResetLedAuto={() => setHardwareState(prev => ({ ...prev, ledMode: 'auto' }))}
                  onSetRingBrightness={(val) => setHardwareState(prev => ({ ...prev, ringLedBrightness: val }))}
                  onSetExpansionBoard={(board: ExpansionBoardType) => setHardwareState(prev => ({ ...prev, expansionBoard: board }))}
                  activeToolName={activeTool.name}
                  firmwareVersion={firmwareVersion}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAN Bus Protocol Analyzer */}
        {activeTab === 'can' && (
          <CanBusAnalyzer
            canFrames={canFrames}
            onSendCustomFrame={handleSendCustomFrame}
            onClearLog={() => setCanFrames([])}
            onTriggerPreset={handleTriggerPreset}
          />
        )}

        {/* TAB 4: Firmware OTA / Flasher Studio */}
        {activeTab === 'flasher' && (
          <FlasherStudio
            onStartCanOta={handleStartCanOta}
            onStartSwdFlash={handleStartSwdFlash}
            onReadback={handleReadback}
            onCancel={handleCancelFlash}
            flasherState={flasher.flasherState}
            isConnected={serialCan.isConnected}
            boardVersion={boardVersion}
            onQueryVersion={handleQueryVersion}
            errorCounters={flasher.errorCounters}
            onQueryErrorCounters={flasher.queryErrorCounters}
            onSendFrame={serialCan.sendFrame}
            onWaitForFrame={serialCan.waitForFrame}
          />
        )}

        {/* TAB 5: Thermal IR Inspection */}
        {activeTab === 'thermal' && (
          <ThermalCameraViewer />
        )}

        {/* TAB 6: BOM & Hardware Pinouts */}
        {activeTab === 'specs' && (
          <SpecsAndBomViewer />
        )}

        {/* TAB 7: Tester Studio */}
        {activeTab === 'tester' && (
          <TesterStudio
            hardwareState={hardwareState}
            activeToolId={activeToolId}
            activeToolName={activeTool.name}
            canFrames={canFrames}
            isConnected={serialCan.isConnected}
            onSendFrame={serialCan.sendFrame}
            onWaitForFrame={serialCan.waitForFrame}
            subscribe={serialCan.subscribe}
            subscribeAll={serialCan.subscribeAll}
          />
        )}
      </main>
      </div>
    </div>
  );
}
