import React, { useState, useEffect } from 'react';
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
import { HardwareState, CanFrame, FlasherState, ExpansionBoardType } from './types';
import { useSerialCanBus } from './hooks/useSerialCanBus';
import { 
  CAN_ID_ENTER_BOOTLOADER, CAN_ID_STATUS, CAN_ID_START_UPDATE, CAN_ID_HMAC_CHUNK, 
  CAN_ID_DATA, CAN_ID_PAGE_ACK, CAN_ID_END_UPDATE, 
  THIS_HARDWARE_ID, FLASH_PAGE_SIZE, FIRMWARE_VERSION_MAJOR, FIRMWARE_VERSION_MINOR, 
  computeHmacSha256, packUInt32BE, packUInt16BE, getCrc32 
} from './lib/flasher';

export default function App() {
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

  // Flasher & Global Firmware Version State ('1.1.0' or '1.0.0')
  const [firmwareVersion, setFirmwareVersion] = useState<string>('1.1.0');

  const [flasherState, setFlasherState] = useState<FlasherState>({
    mode: 'idle',
    progress: 0,
    statusText: 'Idle',
    firmwareVersion: '1.1.0',
    targetHardwareId: 0xF303,
    selectedFile: 'URTC_v1_1_F303CC.bin',
    hmacVerified: true,
    crcVerified: true,
    log: []
  });

  const handleSetFirmwareVersion = (ver: string) => {
    setFirmwareVersion(ver);
    const selectedFile = ver.startsWith('1.0') ? 'URTC_v1_0_F303CC.bin' : 'URTC_v1_1_F303CC.bin';
    setFlasherState(prev => ({
      ...prev,
      firmwareVersion: ver,
      selectedFile
    }));
    logCanFrame('0x7F9', `01 ${ver === '1.0.0' ? '00' : '01'} 00 F3 03 00 00 00`, `System Firmware Version switched to v${ver}`, 'Rx');
  };

  // Helper to log a CAN frame (or send it if hardware is connected)
  const logCanFrame = (idHex: string, dataHex: string, desc: string, direction: 'Tx' | 'Rx' = 'Tx') => {
    const idNum = parseInt(idHex.replace('0x', ''), 16);
    const dataBytes = dataHex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16));

    if (direction === 'Tx' && serialCan.isConnected) {
      serialCan.sendFrame(idNum, dataBytes).catch(console.error);
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

  // Periodic simulation loop (CAN watchdog LED reset)
  useEffect(() => {
    const interval = setInterval(() => {
      // Check LED override timeout (10 seconds)
      if (hardwareState.ledMode === 'override' && Date.now() > hardwareState.ledOverrideExpires) {
        setHardwareState(prev => ({
          ...prev,
          ledMode: 'auto'
        }));
      }

      // Check CAN active timeout (1.5 seconds)
      if (Date.now() - hardwareState.lastCanTimestamp > 1500) {
        setHardwareState(prev => ({
          ...prev,
          canActive: false
        }));
      }
    }, 200);

    return () => clearInterval(interval);
  }, [activeToolId, setpoints, hardwareState]);

  // Handle jumper toggle
  const handleJumperToggle = (idx: number) => {
    setHardwareState(prev => {
      const nextJumpers = [...prev.jumpers];
      nextJumpers[idx] = !nextJumpers[idx];
      return { ...prev, jumpers: nextJumpers };
    });
    logCanFrame('0x111', `0${activeToolId.toString(16)} 00 00 00 00 00 00 00`, `Active Tool ID Changed to #${activeToolId}`, 'Rx');
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
    logCanFrame('0x110', `0${id.toString(16)} 00 00 00 00 00 00 00`, `Catalog Selected Tool #${id} (${TOOL_PROFILES[id]?.name})`, 'Tx');
  };

  // Setpoint change
  const handleSetpointChange = (val: number) => {
    setSetpoints(prev => ({ ...prev, [activeToolId]: val }));
    logCanFrame('0x190', `0${activeToolId.toString(16)} ${(Math.round(val) & 0xFF).toString(16).padStart(2, '0')} 00 00 00 00 00 00`, `Setpoint Updated for Tool #${activeToolId} -> ${val.toFixed(1)}`);
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

  // Custom CAN send
  const handleSendCustomFrame = (idHex: string, dataHex: string, desc: string) => {
    logCanFrame(idHex, dataHex, desc, 'Tx');

    // Handle special command triggers
    if (idHex.toLowerCase() === '0x100') {
      const bytes = dataHex.trim().split(/\s+/).map(h => parseInt(h, 16));
      if (bytes.length >= 3) {
        setHardwareState(prev => ({
          ...prev,
          ledMode: 'override',
          ledOverrideColor: { r: bytes[0], g: bytes[1], b: bytes[2] },
          ledOverrideExpires: Date.now() + 10000
        }));
      }
    }
  };

  // Preset triggers
  const handleTriggerPreset = (presetId: string) => {
    switch (presetId) {
      case '0x110':
        logCanFrame('0x110', '00 00 00 00 00 00 00 00', 'Host Query Active Tool Profile', 'Tx');
        setTimeout(() => {
          logCanFrame('0x111', `0${activeToolId.toString(16)} 00 00 00 00 00 00 00`, `URTC Response: Active Tool #${activeToolId} (${activeTool.name})`, 'Rx');
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

  // Start REAL CAN-OTA update
  const handleStartCanOta = async (fwFile: string, fileObj?: File | null, downloadUrl?: string) => {
    if (!serialCan.isConnected) {
      alert("Please connect to the USB-CAN adapter first using the top header.");
      return;
    }

    const isV10 = fwFile.includes('v1_0') || fwFile.includes('1.0');
    const targetVersion = isV10 ? '1.0.0' : '1.1.0';
    const fileName = fileObj ? fileObj.name : fwFile;
    
    let arrayBuffer: ArrayBuffer;
    try {
      if (fileObj) {
        arrayBuffer = await fileObj.arrayBuffer();
      } else {
        const res = await fetch(downloadUrl || `/firmware/${fileName}`);
        if (!res.ok) throw new Error("Failed to fetch firmware");
        arrayBuffer = await res.arrayBuffer();
      }
    } catch (e: any) {
      alert("Could not read firmware file: " + e.message);
      return;
    }

    const data = new Uint8Array(arrayBuffer);
    const size = data.length;
    const crc32 = getCrc32(data);
    const hmac = await computeHmacSha256(arrayBuffer);

    setFlasherState(prev => ({
      ...prev,
      mode: 'erasing',
      progress: 0,
      selectedFile: fileName,
      statusText: `1/5: Resetting MCU into CAN Bootloader...`,
      log: ['Sending CAN 0x7F0 magic payload (B0 07 1D 5A)...']
    }));

    try {
      logCanFrame('0x7F0', 'B0 07 1D 5A 00 00 00 00', 'CAN OTA Reset Command', 'Tx');
      await serialCan.sendFrame(CAN_ID_ENTER_BOOTLOADER, [0xB0, 0x07, 0x1D, 0x5A, 0x00, 0x00, 0x00, 0x00]);

      const statusFrame = await serialCan.waitForFrame(CAN_ID_STATUS, 5000);
      if (!statusFrame || statusFrame.data[0] !== 0x01) { // 0x01 = LISTENING
        throw new Error("Bootloader not responding (no LISTENING state)");
      }

      setFlasherState(prev => ({ ...prev, mode: 'receiving', progress: 5, log: [...prev.log, 'Bootloader listening. Starting update...'] }));
      
      const sizeBytes = packUInt32BE(size);
      const hwIdBytes = packUInt32BE(THIS_HARDWARE_ID);
      await serialCan.sendFrame(CAN_ID_START_UPDATE, [...sizeBytes, ...hwIdBytes]);

      const status2 = await serialCan.waitForFrame(CAN_ID_STATUS, 5000);
      if (!status2 || status2.data[0] !== 0x03) { // 0x03 = RECEIVING
        throw new Error("Bootloader rejected update start");
      }

      setFlasherState(prev => ({ ...prev, progress: 10, log: [...prev.log, 'Sending HMAC signature...'] }));
      
      for (let i = 0; i < 4; i++) {
        await serialCan.sendFrame(CAN_ID_HMAC_CHUNK, Array.from(hmac.slice(i*8, (i+1)*8)));
        await new Promise(r => setTimeout(r, 10));
      }

      setFlasherState(prev => ({ ...prev, progress: 15, statusText: '2/5: HardwareID & Signature verified. Transferring pages...', log: [...prev.log, 'Transferring data pages...'] }));
      
      let offset = 0;
      let pageIndex = 0;
      const totalPages = Math.ceil(size / FLASH_PAGE_SIZE);

      while (offset < size) {
        const pageEnd = Math.min(offset + FLASH_PAGE_SIZE, size);
        const pageData = data.slice(offset, pageEnd);
        
        for (let i = 0; i < pageData.length; i += 8) {
          const chunk = Array.from(pageData.slice(i, Math.min(i + 8, pageData.length)));
          while (chunk.length < 8) chunk.push(0);
          await serialCan.sendFrame(CAN_ID_DATA, chunk);
          await new Promise(r => setTimeout(r, 2)); // Pacing
        }

        const ack = await serialCan.waitForFrame(CAN_ID_PAGE_ACK, 3000);
        if (!ack) {
          throw new Error(`Timeout waiting for ACK on page ${pageIndex}`);
        }

        offset = pageEnd;
        pageIndex++;
        
        const pct = 15 + Math.floor((pageIndex / totalPages) * 70);
        setFlasherState(prev => ({ ...prev, progress: pct }));
      }

      setFlasherState(prev => ({ ...prev, mode: 'verifying', progress: 85, statusText: '3/5: Page writes finished. Computing Backup Slot CRC32...', log: [...prev.log, 'All pages written. Sending END command.'] }));
      
      const crcBytes = packUInt32BE(crc32);
      const vMajor = packUInt16BE(FIRMWARE_VERSION_MAJOR);
      const vMinor = packUInt16BE(FIRMWARE_VERSION_MINOR);
      await serialCan.sendFrame(CAN_ID_END_UPDATE, [...crcBytes, ...vMajor, ...vMinor]);

      setFlasherState(prev => ({ ...prev, mode: 'flashing', progress: 95, statusText: '4/5: Copying verified Backup Slot -> Main Application Slot...', log: [...prev.log, 'Waiting for bootloader to verify and copy...'] }));
      
      const endStatus = await serialCan.waitForFrame(CAN_ID_STATUS, 60000);
      if (!endStatus || endStatus.data[0] !== 0x04) { // 0x04 = VERIFY_OK
        throw new Error("Update verification failed on device");
      }

      setFirmwareVersion(targetVersion);
      setFlasherState(prev => ({
        ...prev,
        mode: 'idle',
        progress: 100,
        firmwareVersion: targetVersion,
        statusText: `5/5: OTA Update Complete! MCU Rebooted into Firmware v${targetVersion}`,
        log: [...prev.log, `Update SUCCESS! Booting STM32 application v${targetVersion}`]
      }));
      handleResetSplash();

    } catch (e: any) {
      setFlasherState(prev => ({
        ...prev,
        mode: 'idle',
        statusText: 'Update Failed',
        log: [...prev.log, `ERROR: ${e.message}`]
      }));
    }
  };

  // Start SWD Mass Erase
  const handleStartSwdFlash = (fwFile: string, fileObj?: File | null, bootloaderFile?: string, bootloaderObj?: File | null) => {
    const isV10 = fwFile.includes('v1_0') || fwFile.includes('1.0');
    const targetVersion = isV10 ? '1.0.0' : '1.1.0';
    const appName = fileObj ? fileObj.name : fwFile;
    const bootName = bootloaderObj ? bootloaderObj.name : (bootloaderFile || 'URTC_BOOTLOADER.bin');

    setFlasherState(prev => ({
      ...prev,
      mode: 'idle',
      progress: 0,
      selectedFile: appName,
      statusText: `SWD Flashing requires local tools`,
      log: [
        `[Error] In-browser SWD/JTAG flashing is not supported via Web Serial.`,
        `Please use STM32CubeProgrammer or OpenOCD locally with your ST-Link to flash ${bootName} at 0x08000000 and ${appName} at 0x08008000.`
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
            flasherState={flasherState}
            onSetFirmwareVersion={handleSetFirmwareVersion}
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
            activeToolName={activeTool.name}
            canFrames={canFrames}
            onSendFrame={serialCan.sendFrame}
          />
        )}
      </main>
      </div>
    </div>
  );
}
