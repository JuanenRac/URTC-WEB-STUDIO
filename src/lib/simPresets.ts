// The predefined messages of the CAN Bus Protocol Analyzer, and the rule that
// keeps the simulator apart from the real bus.
//
// A preset is a demonstration. Without a board it plays a simulated exchange
// (a request and the answer the firmware would give). With a board connected it
// never injects a made-up frame: only a plain query is actually sent - with its
// real payload - and the answer that appears in the log is the board's own.
// Everything else is shown as a simulated frame that is not transmitted.

export interface PresetButton { label: string; id: string }

export const PRESET_GROUPS: { system: PresetButton[]; tool: PresetButton[]; bootloader: PresetButton[] } = {
  system: [
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
    { label: '0x1A5 Query Device Serial', id: '0x1A5' },
  ],
  tool: [
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
    { label: '0x179 Hotend Fan RPM (3D)', id: '0x179' },
  ],
  bootloader: [
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
    { label: '0x7FA Bootloader Version', id: '0x7FA' },
  ],
};

/** The only presets that go out to a real board: plain queries, with the payload the firmware expects. */
export const SAFE_QUERY_PRESETS: Record<string, { id: number; data: number[]; description: string }> = {
  '0x110': { id: 0x110, data: [], description: 'Query active tool' },
  '0x182': { id: 0x182, data: [], description: 'Query TMC DIAG0' },
  '0x190': { id: 0x190, data: [], description: 'Query F-RAM state' },
  '0x1A1': { id: 0x1a1, data: [], description: 'Query expansion board type' },
  '0x1A3': { id: 0x1a3, data: [], description: 'Query free tool configuration' },
  '0x1A5': { id: 0x1a5, data: [], description: 'Query peripheral info and serial number' },
  '0x7F8': { id: 0x7f8, data: [0x00], description: 'Query board version' },
};

export interface SimFrameSpec {
  idHex: string;
  dataHex: string;
  description: string;
  direction: 'Tx' | 'Rx';
  delayMs: number;
}

export interface PresetPlan {
  /** Sent to the real board (only ever a plain query). */
  realQuery?: { id: number; data: number[]; description: string };
  /** Shown in the log, flagged as simulated; never transmitted. */
  simulated: SimFrameSpec[];
  /** Effect on the simulated LED panel. */
  led?: { r: number; g: number; b: number };
}

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

function simulationOf(presetId: string, activeToolId: number, activeToolName: string): { frames: SimFrameSpec[]; led?: PresetPlan['led'] } {
  const tx = (idHex: string, dataHex: string, description: string): SimFrameSpec => ({ idHex, dataHex, description, direction: 'Tx', delayMs: 0 });
  const rx = (idHex: string, dataHex: string, description: string, delayMs: number): SimFrameSpec => ({ idHex, dataHex, description, direction: 'Rx', delayMs });
  switch (presetId) {
    case '0x110':
      return { frames: [tx('0x110', '', 'Query active tool'), rx('0x111', `${hex2(activeToolId)} 00 00 00`, `Active tool #${activeToolId} (${activeToolName})`, 150)] };
    case '0x100':
      return { frames: [tx('0x100', 'FF 80 00 00 FF FF FF 01', 'Status LED (255,128,0), OLED standard, ring white on')], led: { r: 255, g: 128, b: 0 } };
    case '0x190':
      return { frames: [tx('0x190', '', 'Query F-RAM state'), rx('0x191', '01 00 00 01 40 00 00 00', 'F-RAM state: valid, tool 0, no error, 320', 150)] };
    case '0x180':
      return { frames: [tx('0x180', '03 01 02 03', 'Expansion SPI passthrough, 3 bytes'), rx('0x181', '03 00 00 00', 'Expansion SPI reply', 150)] };
    case '0x7F0':
      return { frames: [tx('0x7F0', 'B0 07 1D 5A', 'Enter bootloader (magic)'), rx('0x7F5', '01', 'Bootloader status: listening', 300)] };
    case '0x7F8':
      return { frames: [tx('0x7F8', '00', 'Query board version'), rx('0x7F9', '00 03 03 CC 01 00 00 01', 'Application 0.1, HardwareID 0x0303CC01', 150)] };
    default:
      return { frames: [tx(presetId, '00 00 00 00 00 00 00 00', `Simulated example frame for ${presetId}`)] };
  }
}

export function planPreset(presetId: string, state: { connected: boolean; activeToolId: number; activeToolName: string }): PresetPlan {
  const sim = simulationOf(presetId, state.activeToolId, state.activeToolName);
  if (!state.connected) return { simulated: sim.frames, led: sim.led };
  // With a board connected nothing invented may look like it came from it: the simulated exchange is cut down to what was "sent", and a plain query is really sent.
  const query = SAFE_QUERY_PRESETS[presetId];
  if (query) return { realQuery: query, simulated: [] };
  return { simulated: sim.frames.filter(f => f.direction === 'Tx'), led: sim.led };
}
