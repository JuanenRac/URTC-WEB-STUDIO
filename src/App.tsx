import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ToolCatalog } from './components/ToolCatalog';
import { OledDisplay } from './components/OledDisplay';
import { HardwarePanel } from './components/HardwarePanel';
// The tabs that are not on screen at start are loaded when first opened, which keeps the first download small.
const CanBusAnalyzer = lazy(() => import('./components/CanBusAnalyzer').then(m => ({ default: m.CanBusAnalyzer })));
const FlasherStudio = lazy(() => import('./components/FlasherStudio').then(m => ({ default: m.FlasherStudio })));
const ThermalCameraViewer = lazy(() => import('./components/ThermalCameraViewer').then(m => ({ default: m.ThermalCameraViewer })));
const SpecsAndBomViewer = lazy(() => import('./components/SpecsAndBomViewer').then(m => ({ default: m.SpecsAndBomViewer })));
const TesterStudio = lazy(() => import('./components/TesterStudio').then(m => ({ default: m.TesterStudio })));
import { ConfirmDialog } from './components/ConfirmDialog';
import { TOOL_PROFILES } from './data/toolsData';
import { HardwareState, CanFrame, ExpansionBoardType } from './types';
import { useSerialCanBus } from './hooks/useSerialCanBus';
import { useFlasher } from './hooks/useFlasher';
import { useConfirmAction } from './hooks/useConfirmAction';
import {
  THIS_HARDWARE_ID, SLAVE_HARDWARE_ID, APP_MAX_SIZE, SLAVE_APP_MAX_SIZE,
  parseManifest, FirmwareManifest, compareVersions, formatVersion, computeSha256Hex
} from './lib/flasher';
import { BoardVersionInfo, SlaveVersionInfo, installedVersion } from './lib/boardVersion';
import { RemoteFirmware, downloadAsset, downloadAssetText, digestMismatch, GithubReleaseError } from './lib/githubRelease';
import { resolveSignature } from './lib/firmwareSignature';
import { validateImage, checkSidecar, resolveVersion } from './lib/firmwareImage';
import { parseCustomFrame, customFrameErrorText } from './lib/customFrame';
import { BUNDLED_FIRMWARE } from './lib/bundledFirmware';
import { CAN_ID_QUERY_ACTIVE_TOOL } from './lib/canIds';
import { createBatcher, Batcher } from './lib/frameBatcher';
import { summarizeBoardFrames, heaterToolId, BoardStatus, NO_BOARD_STATUS } from './lib/boardTelemetry';
import { planPreset } from './lib/simPresets';
import { rawSendPolicy } from './lib/dangerousActions';
import { runAllSafeOff } from './lib/safeOff';
import { downloadBlob } from './lib/download';

export type { BoardVersionInfo, SlaveVersionInfo };

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'control' | 'oled' | 'can' | 'flasher' | 'thermal' | 'specs' | 'tester'>('control');
  
  // CAN Bus Frames Log
  const [canFrames, setCanFrames] = useState<CanFrame[]>([]);

  // Own seq counter for this list specifically: canFrames mixes real frames
  // (already carrying a seq minted by useSerialCanBus's own counter) with
  // simulated ones built locally in logCanFrame() below, which never pass
  // through useSerialCanBus at all. Re-stamping every entry here with a
  // single shared counter guarantees uniqueness within THIS list - relying
  // on the incoming value could collide, since a simulated frame's locally
  // -assigned seq and a real frame's useSerialCanBus-assigned seq are drawn
  // from independent counters that both start at 1.
  const canFramesSeqRef = useRef(0);

  // What the real board has said (0x111): the tool it reports and its fault
  // state. Tester Studio works from this, never from the simulator below.
  const [boardStatus, setBoardStatus] = useState<BoardStatus>(NO_BOARD_STATUS);

  // The bus can deliver dozens of frames per second. Updating the screen once
  // per frame re-rendered the whole app each time, so frames are collected and
  // applied together a few times per second (see lib/frameBatcher.ts).
  const batcherRef = useRef<Batcher<CanFrame> | null>(null);
  if (batcherRef.current === null) {
    batcherRef.current = createBatcher<CanFrame>((frames) => {
      const stamped = frames.map(f => ({ ...f, seq: ++canFramesSeqRef.current }));
      setCanFrames(prev => [...stamped.reverse(), ...prev].slice(0, 100));

      const facts = summarizeBoardFrames(frames);
      if (facts.status) setBoardStatus(facts.status);
      setHardwareState(prev => {
        const next = { ...prev, canActive: true, lastCanTimestamp: Date.now() };
        if (facts.status) {
          // The sandbox panels mirror the tool the real board reports.
          const toolId = facts.status.toolId ?? 0;
          next.jumpers = [Boolean(toolId & 0x01), Boolean(toolId & 0x02), Boolean(toolId & 0x04), Boolean(toolId & 0x08), Boolean(toolId & 0x10)];
          next.systemError = facts.status.systemError;
          next.systemErrorMessage = facts.status.errorMessage;
        }
        return next;
      });
      if (facts.heaterTemp !== undefined) {
        const temp = facts.heaterTemp;
        const toolId = heaterToolId(boardToolIdRef.current);
        setLiveReadings(r => ({ ...r, [toolId]: temp }));
      }
    }, { delayMs: 100, maxItems: 200 });
  }
  const boardToolIdRef = useRef<number | null>(null);
  boardToolIdRef.current = boardStatus.toolId;
  useEffect(() => () => batcherRef.current?.dispose(), []);

  const handleFrameReceived = useCallback((frame: CanFrame) => { batcherRef.current!.push(frame); }, []);

  const serialCan = useSerialCanBus(handleFrameReceived);

  // Real feature detection, not a browser-name sniff - matches the same
  // 'serial' in navigator check useSerialCanBus.ts's own connect() already
  // gates on before calling navigator.serial.requestPort(). That existing
  // check only ever surfaces as an alert() after the user clicks Connect;
  // this mirrors it as a banner shown up front, before any connection
  // attempt, on every unsupported browser (Firefox/Safari today, whatever
  // else lacks Web Serial tomorrow) rather than naming browsers directly.
  const isWebSerialUnsupported = typeof navigator === 'undefined' || !('serial' in navigator);

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
  const [firmwareVersion, setFirmwareVersion] = useState<string>('0.1.0');
  const handleSetFirmwareVersion = (ver: string) => {
    setFirmwareVersion(ver);
    logSimFrame('0x7F9', `00 03 03 CC 01 00 00 ${ver === '0.0.0' ? '00' : '01'}`, `Sandbox firmware version switched to v${ver}`, 'Rx');
  };

  const flasher = useFlasher(serialCan);
  const [boardVersion, setBoardVersion] = useState<BoardVersionInfo | null>(null);

  const [slaveVersion, setSlaveVersion] = useState<SlaveVersionInfo | null>(null);

  const handleQueryVersion = async () => {
    setBoardVersion(await flasher.queryVersion());
  };

  const handleQuerySlaveVersion = async () => {
    setSlaveVersion(await flasher.queryExpansionVersion());
  };

  // Adds a SIMULATED frame to the log. It is only ever local: it is never
  // transmitted, it is flagged in the log, and it never counts as something the
  // board said. While a real board is connected no simulated answer (Rx) is
  // produced at all, so it cannot be mistaken for the board's.
  const logSimFrame = (idHex: string, dataHex: string, desc: string, direction: 'Tx' | 'Rx' = 'Tx') => {
    if (direction === 'Rx' && serialCan.isConnected) return;

    const idNum = parseInt(idHex.replace('0x', ''), 16);
    const dataBytes = dataHex.trim().split(/\s+/).filter(Boolean).map(h => parseInt(h, 16));
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    const frame: CanFrame = {
      id: idNum,
      idHex,
      dlc: dataBytes.length,
      data: dataBytes,
      dataHex,
      timestamp,
      direction,
      description: desc,
      simulated: true,
      seq: ++canFramesSeqRef.current
    };

    setCanFrames(prev => [frame, ...prev.slice(0, 99)]);
    setHardwareState(prev => ({ ...prev, canActive: true, lastCanTimestamp: Date.now() }));
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

  // On a fresh connect, hardwareState.jumpers still holds whatever it was
  // initialized/left at (ID 0 on first load, or the previous session's last
  // -known value on a reconnect) - it only gets corrected once the board
  // spontaneously broadcasts a CAN_ID_ACTIVE_TOOL_RESP (0x111), e.g. after a
  // physical jumper change. If nothing changes the jumpers after connecting,
  // the UI would silently keep showing a stale/wrong tool ID indefinitely.
  // Actively querying CAN_ID_QUERY_ACTIVE_TOOL (0x110) right after connecting
  // prompts the board to answer immediately with its real current state -
  // the response is parsed by the existing 0x111 handling in
  // handleFrameReceived above, so no extra parsing logic is needed here.
  useEffect(() => {
    if (serialCan.isConnected) {
      serialCan.sendFrame(CAN_ID_QUERY_ACTIVE_TOOL, [0x00], 'Query active tool jumpers on connect').catch(console.error);
    }
  }, [serialCan.isConnected]);

  // Closing the page, or disconnecting, switches every running actuator off first.
  useEffect(() => {
    const switchOff = () => { void runAllSafeOff(); };
    window.addEventListener('pagehide', switchOff);
    window.addEventListener('beforeunload', switchOff);
    return () => {
      window.removeEventListener('pagehide', switchOff);
      window.removeEventListener('beforeunload', switchOff);
    };
  }, []);

  const handleDisconnect = async () => {
    await runAllSafeOff();
    await serialCan.disconnect();
  };

  // What the board reported is only valid while it is connected.
  useEffect(() => {
    if (!serialCan.isConnected) setBoardStatus(NO_BOARD_STATUS);
  }, [serialCan.isConnected]);

  // Handle jumper toggle (sandbox only: it changes the simulated board, nothing is sent)
  const handleJumperToggle = (idx: number) => {
    const nextJumpers = [...hardwareState.jumpers];
    nextJumpers[idx] = !nextJumpers[idx];
    const nextId = nextJumpers.reduce((acc, bit, i) => acc + (bit ? (1 << i) : 0), 0);
    const resolvedId = nextId === 31 ? hardwareState.freeConfigFramId : nextId;
    setHardwareState(prev => ({ ...prev, jumpers: nextJumpers }));
    logSimFrame('0x111', `${resolvedId.toString(16).toUpperCase().padStart(2, '0')} 00 00 00`, `Active Tool ID Changed to #${resolvedId}`, 'Rx');
  };

  // Handle direct tool selection from catalog (sandbox only: nothing is sent)
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
    logSimFrame('0x111', `${id.toString(16).toUpperCase().padStart(2, '0')} 00 00 00`, `Catalog Selected Tool #${id} (${TOOL_PROFILES[id]?.name})`, 'Rx');
  };

  // Setpoint change in the sandbox: it moves the simulated setpoint only. A real
  // setpoint is set from Tester Studio, which uses each tool's own command and
  // its safeguards.
  const handleSetpointChange = (val: number) => {
    setSetpoints(prev => ({ ...prev, [activeToolId]: val }));
  };

  // Save to F-RAM in the sandbox: snapshots the simulated setpoints.
  const handleSaveToFram = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setHardwareState(prev => ({
      ...prev,
      framSavedSetpoints: { ...setpoints },
      framLastWriteTime: nowStr
    }));
    logSimFrame('0x191', '01 00 00 01 40 00 00 00', 'Simulated F-RAM snapshot saved', 'Rx');
  };

  // Custom CAN send - raw frame injector (CanBusAnalyzer). Validated the same
  // way as its twin, tester/GlobalPanels.tsx's CustomFramePanel: an invalid
  // identifier or byte is refused with a message, never masked or dropped.
  const confirm = useConfirmAction();
  const tabFallback = <div className="p-4 text-xs text-slate-400" role="status">{t('app.loading', 'Loading...')}</div>;
  const handleSendCustomFrame = async (idHex: string, dataHex: string, desc: string) => {
    const parsed = parseCustomFrame(idHex, dataHex);
    if (parsed.ok === false) {
      alert(customFrameErrorText(t, parsed.error));
      return;
    }
    const bytes = parsed.data;
    const rawId = parsed.id.toString(16).toUpperCase().padStart(3, '0');
    const safeIdHex = `0x${rawId}`;
    const safeDataHex = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    if (serialCan.isConnected) {
      // A real board: identifiers only the board transmits are refused, and writes to its memory, bootloader commands and actuator commands are confirmed.
      const policy = rawSendPolicy(parsed.id);
      if (policy.kind === 'blocked') {
        alert(t('confirm.raw_blocked', 'Identifier 0x{{id}} is only ever sent by the board; sending it from here would collide with the board and feed false data to the other devices on the bus.', { id: rawId }));
        return;
      }
      if (policy.kind === 'confirm') {
        const message = policy.reason === 'memory'
          ? t('confirm.raw_memory', 'Identifier 0x{{id}} writes to the non-volatile memory of the board and stays after a restart.', { id: rawId })
          : policy.reason === 'bootloader'
            ? t('confirm.raw_bootloader', 'Identifier 0x{{id}} is a bootloader command; it can leave the board in update mode until it is updated or powered off and on.', { id: rawId })
            : t('confirm.raw_actuator', 'Identifier 0x{{id}} commands an actuator; it can move, heat or fire.', { id: rawId });
        if (!(await confirm('raw_frame', { message }))) return;
      }
      serialCan.sendFrame(parsed.id, bytes, desc).catch(console.error); // sendFrame adds it to the log
    } else {
      logSimFrame(safeIdHex, safeDataHex, desc, 'Tx');
    }

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

  // Preset triggers. See lib/simPresets.ts: with a board connected only a plain
  // query is sent; everything else is a flagged, local demonstration.
  const handleTriggerPreset = (presetId: string) => {
    const plan = planPreset(presetId, { connected: serialCan.isConnected, activeToolId, activeToolName: activeTool.name });
    if (plan.realQuery) {
      serialCan.sendFrame(plan.realQuery.id, plan.realQuery.data, plan.realQuery.description).catch(console.error);
    }
    for (const f of plan.simulated) {
      if (f.delayMs > 0) setTimeout(() => logSimFrame(f.idHex, f.dataHex, f.description, f.direction), f.delayMs);
      else logSimFrame(f.idHex, f.dataHex, f.description, f.direction);
    }
    if (plan.led) {
      const led = plan.led;
      setHardwareState(prev => ({ ...prev, ledMode: 'override', ledOverrideColor: led, ledOverrideExpires: Date.now() + 10000 }));
    }
  };

  // Replay boot splash. Clears any timer from a previous, still-pending call
  // before scheduling a new one - without this, clicking "Replay Splash"
  // again while the 2.5s animation is already running left BOTH timeouts
  // alive: the first one (from the earlier click) would still fire at its
  // own original 2.5s mark and turn the splash off early, cutting the second
  // replay short instead of giving it its own full 2.5s. Also fires on a
  // successful main-board CAN-OTA update (see handleStartCanOta above), so
  // this guards that path too, not just the manual button.
  const splashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleResetSplash = () => {
    if (splashTimeoutRef.current) clearTimeout(splashTimeoutRef.current);
    setHardwareState(prev => ({ ...prev, oledShowSplash: true }));
    splashTimeoutRef.current = setTimeout(() => {
      splashTimeoutRef.current = null;
      setHardwareState(prev => ({ ...prev, oledShowSplash: false }));
    }, 2500);
  };

  // <file>.manifest.json sidecar, mirroring the Python flasher's own
  // URTCFlasher._check_manifest. An image of the newest GitHub release brings its
  // sidecar among the release assets (a failed download is an error there: going on
  // without it would ask for a signing key instead of using the published signature);
  // a bundled image has it next to it in /firmware/; a browser-picked File has none.
  const tryFetchManifest = async (fileName: string, remote?: RemoteFirmware): Promise<FirmwareManifest | null> => {
    try {
      if (remote) {
        if (!remote.manifest) return null;
        return parseManifest(JSON.parse(await downloadAssetText(fetch, remote.manifest)));
      }
      const res = await fetch(`${import.meta.env.BASE_URL}firmware/${fileName}.manifest.json`);
      if (!res.ok) return null;
      return parseManifest(await res.json());
    } catch {
      if (remote) throw new Error(t('flasher.err_manifest_download', 'The manifest of this image could not be downloaded from the GitHub release.'));
      return null;
    }
  };

  const loadFirmwareBytes = async (fwFile: string, fileObj?: File | null, remote?: RemoteFirmware): Promise<Uint8Array> => {
    if (fileObj) return new Uint8Array(await fileObj.arrayBuffer());
    if (remote) return new Uint8Array(await downloadAsset(fetch, remote.asset));
    const res = await fetch(`${import.meta.env.BASE_URL}firmware/${fwFile}`);
    if (!res.ok) throw new Error(t('flasher.error_fetch_firmware', 'Failed to fetch firmware file'));
    return new Uint8Array(await res.arrayBuffer());
  };

  const githubErrorText = (e: unknown): string => {
    if (e instanceof GithubReleaseError) {
      if (e.code === 'rate_limit') return t('flasher.error_github_rate_limit', 'GitHub request limit reached: try again later, or use the bundled image or a file from disk.');
      if (e.code === 'no_release' || e.code === 'no_images') return t('flasher.error_github_no_release', 'The newest GitHub release has no firmware image.');
      if (e.code === 'network') return t('flasher.error_github_download_blocked', 'The browser could not download this file from GitHub (release files are served from a host that does not allow downloads from a web page). Download it from the release page, then pick it with Browse together with its .manifest.json, or use the bundled image.');
    }
    return t('flasher.error_fetch_firmware', 'Failed to fetch firmware file');
  };

  // Start REAL CAN-OTA update (main board or expansion slave)
  const handleStartCanOta = async (
    target: 'main' | 'slave',
    fwFile: string,
    fileObj: File | null | undefined,
    remote: RemoteFirmware | undefined,
    opts: { triggerBootloader: boolean; eraseFram: boolean; allowDowngrade: boolean },
    manifestFile?: File | null
  ) => {
    if (!serialCan.isConnected) {
      alert(t('flasher.alert_connect_first', 'Please connect to the USB-CAN adapter first using the top header.'));
      return;
    }
    const fileName = fileObj ? fileObj.name : fwFile;
    flasher.setFlasherState(prev => ({ ...prev, selectedFile: fileName, log: [] }));

    let data: Uint8Array;
    try {
      data = await loadFirmwareBytes(fwFile, fileObj, remote);
    } catch (e: any) {
      flasher.setFlasherState(prev => ({ ...prev, log: [...prev.log, t('flasher.log_could_not_read', 'ERROR: could not read firmware file: {{message}}', { message: remote ? githubErrorText(e) : e.message })] }));
      return;
    }

    const refuse = (message: string) => {
      flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', statusText: t('flasher.status_update_failed', 'Update failed'), log: [...prev.log, t('flasher.log_error_prefix', 'ERROR: {{message}}', { message })] }));
    };

    // Only an application image of the chosen board goes out: a bootloader, a text file or the other board's image is refused before any frame is sent.
    const problem = validateImage(data, target);
    if (problem) {
      const imageErrors: Record<string, string> = {
        empty: t('flasher.err_empty_file', 'Firmware file is empty'),
        too_large: t('flasher.err_exceeds_app_slot', 'Firmware exceeds the {{max}} byte application slot', { max: target === 'slave' ? SLAVE_APP_MAX_SIZE : APP_MAX_SIZE }),
        too_small: t('flasher.err_image_too_small', 'The file is too small to contain a vector table.'),
        bad_stack: t('flasher.err_image_bad_stack', 'The first word of the file is not a valid initial stack pointer for this chip: this is not a firmware image.'),
        bad_reset: t('flasher.err_image_bad_reset', 'The reset handler does not point inside the application slot of this board: this looks like a bootloader, or an image for the other board.'),
      };
      refuse(imageErrors[problem]);
      return;
    }

    let manifest: FirmwareManifest | null = null;
    if (fileObj && manifestFile) {
      try {
        manifest = parseManifest(JSON.parse(await manifestFile.text()));
      } catch {
        refuse(t('flasher.err_manifest_unreadable', 'The selected manifest is not valid JSON.'));
        return;
      }
    } else if (!fileObj) {
      try {
        manifest = await tryFetchManifest(fileName, remote);
      } catch (e: any) {
        refuse(e.message);
        return;
      }
    }
    // An image of the release must match the digests the release publishes for it (its .sha256 file and the digest GitHub lists).
    if (remote && !fileObj) {
      let sidecarText: string | null = null;
      if (remote.sha256) {
        try { sidecarText = await downloadAssetText(fetch, remote.sha256); } catch { refuse(t('flasher.err_manifest_download', 'The manifest of this image could not be downloaded from the GitHub release.')); return; }
      }
      const expected = digestMismatch(await computeSha256Hex(data.slice().buffer as ArrayBuffer), sidecarText, remote.asset.digest);
      if (expected) {
        refuse(t('flasher.err_release_digest', 'The downloaded image does not match the sha256 published by the release ({{expected}}).', { expected }));
        return;
      }
    }
    const sidecarProblem = checkSidecar(manifest, target);
    if (sidecarProblem) {
      refuse(sidecarProblem.code === 'malformed_signature'
        ? t('flasher.err_manifest_signature_malformed', 'The manifest has an hmac_sha256 that is not 64 hexadecimal characters.')
        : t('flasher.err_manifest_wrong_target', 'The manifest is for another board: it declares {{got}} and this update needs {{want}}.', { got: sidecarProblem.got, want: sidecarProblem.want }));
      return;
    }
    // No invented version: a wrong one stored in the board would make every later update look like a rollback.
    const version = resolveVersion(manifest, fileName);
    if (!version) {
      refuse(t('flasher.err_version_unknown', 'The version of this image is unknown: add a manifest with a version, or keep the version in the file name (for example _v0.3.3.bin).'));
      return;
    }
    const reportMajor = version.major, reportMinor = version.minor, reportPatch = version.patch;
    // Compared with what the board reported, if it was queried and is the board being updated; the patch counts only when both sides carry one.
    const installed = target === 'slave'
      ? (slaveVersion && slaveVersion.hardwareId === SLAVE_HARDWARE_ID ? installedVersion(slaveVersion) : null)
      : (boardVersion && boardVersion.hardwareId === THIS_HARDWARE_ID ? installedVersion(boardVersion) : null);
    if (installed) {
      const order = compareVersions(installed, version);
      const params = { installed: formatVersion(installed), image: formatVersion(version) };
      flasher.appendLog(order < 0
        ? t('flasher.log_image_older', 'The image ({{image}}) is older than the installed firmware ({{installed}}): the bootloader refuses it unless a downgrade is authorized.', params)
        : order === 0
          ? t('flasher.log_image_same', 'The image ({{image}}) has the same version as the installed firmware ({{installed}}).', params)
          : t('flasher.log_image_newer', 'The image ({{image}}) is newer than the installed firmware ({{installed}}).', params));
    }
    if (manifest?.versionMajor !== undefined) {
      flasher.appendLog(t('flasher.log_manifest_found', 'Manifest found: reporting declared version {{version}} to the bootloader.', { version: manifest.version }));
    }
    // The signature is published by the URTC build next to the image; this
    // app holds no key. Only an image WITHOUT a published signature (a
    // self-built file picked from disk, for a bench board) asks for a key,
    // kept in this function's memory for this one flash and never stored.
    let runtimeKey: string | null = null;
    if (!manifest?.hmacSha256) {
      runtimeKey = window.prompt(t('flasher.prompt_signing_key', 'This image has no published signature (<file>.manifest.json with hmac_sha256). To flash a self-built image to a bench board, enter its {{board}} signing key (64 hex characters). It is not stored.', { board: target === 'slave' ? 'slave' : 'master' }));
    }
    let signature: Uint8Array;
    try {
      const resolved = await resolveSignature(data, manifest, runtimeKey);
      signature = resolved.signature;
      if (resolved.source === 'manifest') {
        flasher.appendLog(t('flasher.log_signature_from_manifest', 'Using the signature published in the manifest (key: {{kind}}).', { kind: resolved.keyKind ?? 'unknown' }));
        if (resolved.keyKind === 'dev') {
          flasher.appendLog(t('flasher.log_dev_key_warning', 'NOTE: signed with the PUBLIC development key - only boards whose bootloader was built with that same key accept it.'));
          if (!(await confirm('dev_key'))) {
            flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', statusText: t('flasher.status_update_failed', 'Update failed'), log: [...prev.log, t('flasher.log_dev_key_declined', 'Cancelled: the image is signed with the public development key and the confirmation was declined.')] }));
            return;
          }
        }
      } else {
        flasher.appendLog(t('flasher.log_signature_runtime_key', 'Signed locally with the key entered for this flash.'));
      }
    } catch (e: any) {
      flasher.setFlasherState(prev => ({ ...prev, mode: 'idle', statusText: t('flasher.status_update_failed', 'Update failed'), log: [...prev.log, t('flasher.log_error_prefix', 'ERROR: {{message}}', { message: e.message })] }));
      return;
    }

    try {
      if (target === 'slave') {
        await flasher.flashSlave(data, { triggerBootloader: opts.triggerBootloader, reportMajor, reportMinor, reportPatch, signature });
      } else {
        await flasher.flashMain(data, { ...opts, reportMajor, reportMinor, reportPatch, signature });
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
        downloadBlob(new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }), suggestedName);
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
    const bootName = bootloaderObj ? bootloaderObj.name : (bootloaderFile || BUNDLED_FIRMWARE.mainBootloader);

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
      
      <ConfirmDialog />

      {/* Header */}
      <Header
        hardwareState={hardwareState}
        activeToolName={activeTool.name}
        firmwareVersion={firmwareVersion}
        onSetFirmwareVersion={handleSetFirmwareVersion}
        isConnected={serialCan.isConnected}
        onConnect={serialCan.connect}
        onDisconnect={handleDisconnect}
        onStopAll={() => { void runAllSafeOff(); }}
        portName={serialCan.portName}
      />

      {/* Bench-tool notice - only in the build published on GitHub Pages (VITE_BENCH_NOTICE=1). */}
      {import.meta.env.VITE_BENCH_NOTICE === '1' && (
        <div className="max-w-[1400px] w-full mx-auto px-2 md:px-4 pt-3" role="note">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('app.bench_notice', 'Bench tool - firmware images are signed with the public development key, which anyone can use. Do not rely on this page as a source of trusted firmware for a machine in service.')}</span>
          </div>
        </div>
      )}

      {/* Unsupported-browser banner - shown up front, before any connect
          attempt, so a Firefox/Safari visitor isn't left guessing why the
          Connect button in the Header does nothing useful. Not dismissible
          (unlike the send-failure banner below): the underlying condition
          can't change without a full page reload in a different browser. */}
      {isWebSerialUnsupported && (
        <div className="max-w-[1400px] w-full mx-auto px-2 md:px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('app.browser_unsupported_banner', "This browser does not support the Web Serial API - connecting to real hardware is not possible here. Please switch to Chrome or Edge.")}</span>
          </div>
        </div>
      )}

      {/* CAN send failure banner - covers every sendFrame() call across the
          app (tester tool panels, keepalive loops, flasher, etc.), most of
          which are fire-and-forget and would otherwise fail silently with
          nothing but a console trace. Placed above the tab content so it's
          visible no matter which tab was active when the send failed. */}
      {serialCan.sendError && (
        <div className="max-w-[1400px] w-full mx-auto px-2 md:px-4 pt-3">
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 text-xs font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{serialCan.sendError}</span>
            </div>
            <button
              onClick={serialCan.clearSendError}
              className="text-red-300 hover:text-red-100 shrink-0"
              title={t('app.dismiss', 'Dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex flex-1 max-w-[1400px] w-full mx-auto">
        {/* Left Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace */}
        <main className="flex-1 p-2 md:p-4 space-y-4 pb-8 min-w-0">
          
          {(activeTab === 'control' || activeTab === 'oled' || activeTab === 'thermal') && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-sky-950/60 text-sky-300 border border-sky-800/70 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{serialCan.isConnected
                ? t('app.simulator_notice_connected', 'Simulator: this tab models a board and sends nothing to the bus. What it shows is not what the connected board reports; use Tester Studio and Flasher Studio for the real board.')
                : t('app.simulator_notice', 'Simulator: this tab models a board and sends nothing to the bus. Connect a USB-CAN adapter to work with the real board in Tester Studio and Flasher Studio.')}</span>
            </div>
          )}

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
              onSwitchToFirmware11={() => handleSetFirmwareVersion('0.1.0')}
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
          <Suspense fallback={tabFallback}>
          <CanBusAnalyzer
            canFrames={canFrames}
            isConnected={serialCan.isConnected}
            onSendCustomFrame={handleSendCustomFrame}
            onClearLog={() => setCanFrames([])}
            onTriggerPreset={handleTriggerPreset}
          />
          </Suspense>
        )}

        {/* TAB 4: Firmware OTA / Flasher Studio */}
        {activeTab === 'flasher' && (
          <Suspense fallback={tabFallback}>
          <FlasherStudio
            onStartCanOta={handleStartCanOta}
            onStartSwdFlash={handleStartSwdFlash}
            onReadback={handleReadback}
            onCancel={handleCancelFlash}
            flasherState={flasher.flasherState}
            isConnected={serialCan.isConnected}
            boardVersion={boardVersion}
            onQueryVersion={handleQueryVersion}
            slaveVersion={slaveVersion}
            onQuerySlaveVersion={handleQuerySlaveVersion}
            errorCounters={flasher.errorCounters}
            onQueryErrorCounters={flasher.queryErrorCounters}
            onSendFrame={serialCan.sendFrame}
            onRequest={serialCan.request}
          />
          </Suspense>
        )}

        {/* TAB 5: Thermal IR Inspection */}
        {activeTab === 'thermal' && (
          <Suspense fallback={tabFallback}><ThermalCameraViewer /></Suspense>
        )}

        {/* TAB 6: BOM & Hardware Pinouts */}
        {activeTab === 'specs' && (
          <Suspense fallback={tabFallback}><SpecsAndBomViewer /></Suspense>
        )}

        {/* TAB 7: Tester Studio */}
        {activeTab === 'tester' && (
          <Suspense fallback={tabFallback}>
          <TesterStudio
            boardStatus={boardStatus}
            canFrames={canFrames}
            isConnected={serialCan.isConnected}
            onSendFrame={serialCan.sendFrame}
            onWaitForFrame={serialCan.waitForFrame}
            onRequest={serialCan.request}
            onFlushFrames={serialCan.flushFrames}
            subscribe={serialCan.subscribe}
            subscribeAll={serialCan.subscribeAll}
          />
          </Suspense>
        )}
      </main>
      </div>
    </div>
  );
}
