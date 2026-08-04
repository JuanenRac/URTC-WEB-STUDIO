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

export default function App() {
  const [activeTab, setActiveTab] = useState<'control' | 'oled' | 'can' | 'flasher' | 'thermal' | 'specs' | 'tester'>('control');
  
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

  // CAN Bus Frames Log
  const [canFrames, setCanFrames] = useState<CanFrame[]>([]);

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

  // Helper to log a CAN frame
  const logCanFrame = (idHex: string, dataHex: string, desc: string, direction: 'Tx' | 'Rx' = 'Tx') => {
    const dlc = dataHex.trim().split(/\s+/).filter(Boolean).length;
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    const idNum = parseInt(idHex.replace('0x', ''), 16);

    const frame: CanFrame = {
      id: idNum,
      idHex,
      dlc,
      data: dataHex.trim().split(/\s+/).map(h => parseInt(h, 16)),
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

  // Periodic simulation loop (thermal/sensor noise + CAN watchdog LED reset)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate live reading approaching target setpoint with small noise
      setLiveReadings(prev => {
        const next = { ...prev };
        const target = setpoints[activeToolId] ?? activeTool.defaultSetpoint;
        const current = prev[activeToolId] ?? target;
        const diff = target - current;
        const step = diff * 0.15 + (Math.random() - 0.5) * 0.4;
        next[activeToolId] = current + step;
        return next;
      });

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

  // Start simulated CAN-OTA update
  const handleStartCanOta = (fwFile: string) => {
    const isV10 = fwFile.includes('v1_0') || fwFile.includes('1.0');
    const targetVersion = isV10 ? '1.0.0' : '1.1.0';

    setFlasherState(prev => ({
      ...prev,
      mode: 'erasing',
      progress: 0,
      selectedFile: fwFile,
      statusText: `1/5: Resetting MCU into CAN Bootloader for ${fwFile}...`,
      log: ['[0.00s] Sending CAN 0x7F0 magic payload (B0 07 1D 5A)...', '[0.30s] Bootloader ACK (0x7F5 status 0x01: LISTENING)...']
    }));

    logCanFrame('0x7F0', 'B0 07 1D 5A 00 00 00 00', `CAN OTA Reset Command (${fwFile})`, 'Tx');

    setTimeout(() => {
      setFlasherState(prev => ({
        ...prev,
        mode: 'receiving',
        progress: 25,
        statusText: '2/5: HardwareID & Signature verified. Transferring pages to Backup Slot...',
        log: [...prev.log, `[1.20s] CAN 0x7F1 Transfer: ${isV10 ? '84,992' : '114,688'} bytes (${fwFile})`, '[1.50s] CAN 0x7F7 HMAC-SHA256 Signature verified ✓']
      }));

      logCanFrame('0x7F1', '00 01 C0 00 F3 03 00 00', 'CAN OTA Start Header', 'Tx');
    }, 1200);

    setTimeout(() => {
      setFlasherState(prev => ({
        ...prev,
        mode: 'verifying',
        progress: 75,
        statusText: '3/5: Page writes finished. Computing Backup Slot CRC32 & HMAC-SHA256...',
        log: [...prev.log, '[2.80s] Pages written and verified with page-by-page ACK (0x7F3)', '[3.20s] Computing Backup Slot CRC32 checksum...']
      }));

      logCanFrame('0x7F4', '9A B8 C7 D6 01 01 00 00', 'CAN OTA End & CRC32 Verify', 'Tx');
    }, 2800);

    setTimeout(() => {
      setFlasherState(prev => ({
        ...prev,
        mode: 'flashing',
        progress: 90,
        statusText: '4/5: Copying verified Backup Slot -> Main Application Slot (0x08008000)...',
        log: [...prev.log, '[4.00s] Verification PASSED ✓. Copying backup -> main slot...', '[4.50s] Writing Metadata Page (0x08007800)...']
      }));
    }, 4000);

    setTimeout(() => {
      setFirmwareVersion(targetVersion);
      setFlasherState(prev => ({
        ...prev,
        mode: 'idle',
        progress: 100,
        firmwareVersion: targetVersion,
        statusText: `5/5: OTA Update Complete! MCU Rebooted into Firmware v${targetVersion}`,
        log: [...prev.log, `[5.20s] Update SUCCESS! Booting STM32F303CC application v${targetVersion} ✓`]
      }));

      handleResetSplash();
    }, 5200);
  };

  // Start SWD Mass Erase
  const handleStartSwdFlash = (fwFile: string) => {
    const isV10 = fwFile.includes('v1_0') || fwFile.includes('1.0');
    const targetVersion = isV10 ? '1.0.0' : '1.1.0';

    setFlasherState(prev => ({
      ...prev,
      mode: 'erasing',
      progress: 0,
      selectedFile: fwFile,
      statusText: `SWD ST-Link flashing ${fwFile}...`,
      log: ['[0.00s] Initializing ST-Link v2/v3 SWD Interface...', '[0.40s] STM32F303CCT6 detected (Device ID: 0x422)', '[1.00s] Mass erasing flash memory (256 KB)...']
    }));

    setTimeout(() => {
      setFlasherState(prev => ({
        ...prev,
        mode: 'flashing',
        progress: 50,
        statusText: `Flashing BOOTLOADER.hex & ${fwFile} at 0x08008000...`,
        log: [...prev.log, '[1.80s] Mass erase completed', '[2.20s] Flashing Bootloader at 0x08000000...', `[3.00s] Flashing Main Application v${targetVersion} at 0x08008000...`]
      }));
    }, 1800);

    setTimeout(() => {
      setFirmwareVersion(targetVersion);
      setFlasherState(prev => ({
        ...prev,
        mode: 'idle',
        progress: 100,
        firmwareVersion: targetVersion,
        statusText: `SWD Flash Complete! Active Firmware: v${targetVersion}`,
        log: [...prev.log, '[4.20s] SWD Write and Verification Complete ✓', `[4.80s] Target Reset & Running Firmware v${targetVersion}!`]
      }));

      handleResetSplash();
    }, 4800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      
      {/* Header */}
      <Header
        hardwareState={hardwareState}
        activeToolName={activeTool.name}
        firmwareVersion={firmwareVersion}
        onSetFirmwareVersion={handleSetFirmwareVersion}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 max-w-[1400px] w-full mx-auto">
        {/* Left Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 min-w-0">
          
          {/* TAB 1: Tool Matrix & Live Control */}
          {activeTab === 'control' && (
          <div className="space-y-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-900">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6">
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
          />
        )}
      </main>
      </div>
    </div>
  );
}
