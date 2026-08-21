export interface ToolProfile {
  id: number;
  name: string;
  category: 'Shipped (v1.0)' | 'Expansion (v1.1)';
  description: string;
  heroMetricLabel: string;
  heroMetricUnit: string;
  defaultSetpoint: number;
  minVal: number;
  maxVal: number;
  watchdogMs?: number; // Timeout requiring periodic CAN pings
  pinsUsed: string[];
  features: string[];
  iconFrames: string[]; // 4 frames for OLED animation
}

export interface CanFrame {
  id: number; // e.g. 0x100, 0x110, 0x7F0
  idHex: string;
  dlc: number;
  data: number[];
  dataHex: string;
  timestamp: string;
  direction: 'Tx' | 'Rx';
  description: string;
  // Monotonically increasing, assigned at creation - a stable React list key.
  // Frame lists (CAN log, raw bus monitor) prepend new entries rather than
  // appending, so an array-index key would silently reassign every row's
  // identity to a different frame on each new arrival; `seq` never changes
  // for a given frame regardless of where it later ends up in the array.
  seq: number;
}

export type ExpansionBoardType = 
  | 'none'
  | 'basic_tmc2209'
  | 'basic_tmc5160a'
  | 'advanced_tmc2209'
  | 'advanced_tmc5160a';

export interface HardwareState {
  jumpers: boolean[]; // [ID0, ID1, ID2, ID3, ID4]
  freeConfigFramId: number;
  systemError: boolean;
  systemErrorMessage: string;
  canActive: boolean;
  lastCanTimestamp: number;
  
  // Status LED (WS2812B)
  ledMode: 'auto' | 'override';
  ledOverrideColor: { r: number; g: number; b: number };
  ledOverrideExpires: number; // epoch ms
  
  // Camera Ring (8 LEDs)
  ringLedBrightness: number;
  ringLedStrobe: boolean;

  // Expansion Board
  expansionBoard: ExpansionBoardType;
  expansionMotorCurrent: number; // Amps (up to 2.0A internal or 10.0A expansion)

  // OLED Settings
  oledInverted: boolean;
  oledNightMode: boolean;
  oledShowSplash: boolean;

  // F-RAM Saved State
  framSavedSetpoints: Record<number, number>;
  framLastWriteTime: string;
}

export interface FlasherState {
  mode: 'idle' | 'erasing' | 'receiving' | 'verifying' | 'flashing' | 'complete' | 'error';
  progress: number;
  statusText: string;
  firmwareVersion: string;
  targetHardwareId: number;
  selectedFile: string;
  hmacVerified: boolean;
  crcVerified: boolean;
  log: string[];
}
