// =============================================================================
// URTC Web Studio - CAN protocol constants shared by Tester Studio and (where
// relevant) Flasher Studio. Mirrors tester_config.py / flasher_config.py from
// the URTC-TESTER and URTC-FLASHER Python tools byte-for-byte - see
// docs/CANBUS.TXT in the URTC firmware repo for the authoritative wire-level
// reference. Kept in sync by hand across all 3 tools, same as the Python
// tools are kept in sync with the firmware and with each other.
// =============================================================================

// --- Global / cross-tool commands ---
export const CAN_ID_STATUS_LED_CMD = 0x100; // status LED + ring LED + OLED mode, one 8-byte frame
export const CAN_ID_QUERY_ACTIVE_TOOL = 0x110;
export const CAN_ID_ACTIVE_TOOL_RESP = 0x111;

export const CAN_ID_FRAM_QUERY = 0x190;
export const CAN_ID_FRAM_STATE_RESP = 0x191;
export const CAN_ID_ERASE_FRAM = 0x192;
export const ERASE_FRAM_MAGIC = [0xE3, 0xA5, 0xE0, 0xff];

export const CAN_ID_EXPANSION_SPI_REQ = 0x180;
export const CAN_ID_EXPANSION_SPI_RESP = 0x181;
export const CAN_ID_EXPANSION_DIAG0_REQ = 0x182;
export const CAN_ID_EXPANSION_DIAG0_RESP = 0x183;

export const CAN_ID_SET_EXPANSION_TYPE = 0x1a0;
export const CAN_ID_EXPANSION_TYPE_RESP = 0x1a1; // empty payload = query, same ID answers
export const CAN_ID_SET_FREE_TOOL = 0x1a2;
export const CAN_ID_FREE_TOOL_CONFIG_RESP = 0x1a3; // empty payload = query, same ID answers
export const CAN_ID_SET_DEVICE_SERIAL = 0x1a4;
export const CAN_ID_PERIPHERAL_INFO_RESP = 0x1a5; // empty payload = query, same ID answers
export const CAN_ID_SET_MLX_VARIANT = 0x1a6;
export const CAN_ID_MLX_VARIANT_RESP = 0x1a7; // empty payload = query, same ID answers

export const EXPANSION_BOARD_TYPES = [
  'None',
  'Basic (TMC2209)',
  'Basic (TMC5160A)',
  'Advanced (TMC2209 + STM32F303CBT6)',
  'Advanced (TMC5160A + STM32F303CBT6)',
  'Basic (ADS1115 only)',
  'Basic (MLX9064x only)',
];

export const MLX_SENSOR_VARIANTS = [
  'None',
  'MLX90640 (32x24)',
  'MLX90641 (16x12)',
  'MLX90642 (32x24, onboard-calculated)',
];

// --- Impact / scan probe event ---
export const CAN_ID_IMPACT_EVENT = 0x095;

// --- Shared plain-stepper motion (tools 1,2,3,6,7,12,16 + soldering iron's own feeder) ---
export const CAN_ID_MOTION_CMD = 0x120;

// --- Tool 0: Soldering Iron ---
export const CAN_ID_SOLDER_SETPOINT = 0x130;
export const CAN_ID_SOLDER_FEEDER_RESET = 0x131;
export const CAN_ID_SOLDER_FEEDER_QUERY = 0x132; // empty payload = query, same ID answers
export const CAN_ID_SOLDER_TELEMETRY = 0x135; // shared with Hot Air Rework
export const SOLDER_FEEDER_RESET_MAGIC = [0x52, 0x53, 0x50, 0x30]; // "RSP0"

// --- Tool 4: Vacuum Pickup (telemetry only, no command) ---
export const CAN_ID_VACUUM_TELEMETRY = 0x145;

// --- Tool 5: Drill ---
export const CAN_ID_DRILL_CMD = 0x140;
export const CAN_ID_DRILL_TELEMETRY = 0x147;

// --- Tool 8: AOI Inspection ---
export const CAN_ID_AOI_CMD = 0x150;
export const CAN_ID_AOI_TELEMETRY = 0x155;

// --- Tool 9: Laser Engraver ---
export const CAN_ID_LASER_CMD = 0x160;
export const CAN_ID_LASER_TELEMETRY = 0x165;

// --- Tool 10: 3D Printer ---
export const CAN_ID_3DP_THERMAL_MOTION = 0x170; // nozzle heater + extruder motion, combined
export const CAN_ID_3DP_LAYERFAN_CMD = 0x173;
export const CAN_ID_3DP_HOTEND_TELEMETRY = 0x175;
export const CAN_ID_3DP_LAYERFAN_TELEMETRY = 0x177;
export const CAN_ID_3DP_HOTENDFAN_CMD = 0x178;
export const CAN_ID_3DP_HOTENDFAN_TELEMETRY = 0x179;

// --- Tool 13: Electromagnet ---
export const CAN_ID_ELECTROMAGNET_CMD = 0x1b0;

// --- Tool 14 / 24: Spot Welder / Ultrasonic Welder (shared payload shape) ---
export const CAN_ID_WELD_SPOT_CMD = 0x1c0;
export const CAN_ID_WELD_ULTRASONIC_CMD = 0x200;
export const WELD_PULSE_MAX_MS = 2000;

// --- Tool 18: UV Curing ---
export const CAN_ID_UV_CURING_CMD = 0x1d0;

// --- Tool 19: Hot Air Rework (telemetry shared with soldering iron's 0x135) ---
export const CAN_ID_HOTAIR_CMD = 0x1e0;

// --- Tool 21: Crimping Actuator (same payload shape as 0x120, routed to expansion driver) ---
export const CAN_ID_CRIMPING_CMD = 0x1f0;

// --- Tool 23: Paste Jetting ---
export const CAN_ID_PASTE_JETTING_CONFIG = 0x230;
export const CAN_ID_PASTE_JETTING_PULSE = 0x231;

// --- Tool 17: Flying Probe ---
export const CAN_ID_FLYING_PROBE_BASIC = 0x243; // passive telemetry, onboard ADC
export const CAN_ID_FLYING_PROBE_ADS_CONFIG = 0x240;
export const CAN_ID_FLYING_PROBE_ADS_TRIGGER = 0x241;
export const CAN_ID_FLYING_PROBE_ADS_RESULT = 0x242; // empty payload = query, same ID answers

// --- Tool 22: Thermal Inspection ---
export const CAN_ID_THERMAL_TRIGGER = 0x250;
export const CAN_ID_THERMAL_STATUS = 0x251; // empty payload = query, same ID answers
export const CAN_ID_THERMAL_RAW_CHUNK_REQ = 0x252;
export const CAN_ID_THERMAL_RAW_CHUNK_RESP = 0x253;
export const CAN_ID_THERMAL_CAL_CHUNK_REQ = 0x254;
export const CAN_ID_THERMAL_CAL_CHUNK_RESP = 0x255;
export const THERMAL_CHUNK_COUNT = 48; // 48 chunks x 16 px = 768px = 32x24

// --- Tool catalog ---
export const TOOL_NAMES: Record<number, string> = {
  0: 'Soldering Iron',
  1: 'Paste Dispenser',
  2: 'Liquid Dispenser',
  3: 'Screwdriver',
  4: 'Vacuum Pickup',
  5: 'Drill',
  6: 'Gripper (Gimbal)',
  7: 'Gripper (NEMA)',
  8: 'AOI Inspection',
  9: 'Laser Engraver',
  10: '3D Printer',
  11: 'Scan Probe',
  12: 'SMT Pick & Place',
  13: 'Electromagnet',
  14: 'Spot Welder',
  15: 'Conformal Coating',
  16: 'Vacuum Gripper (LG)',
  17: 'Flying Probe',
  18: 'UV Curing',
  19: 'Hot Air Rework',
  20: 'Press-Fit Inserter',
  21: 'Crimping Actuator',
  22: 'Thermal Inspection',
  23: 'Paste Jetting',
  24: 'Ultrasonic Welder',
};

// Tools 1,2,3,6,7,12,16 all share the plain-stepper 0x120 motion panel.
export const MOTION_TOOL_IDS = new Set([1, 2, 3, 6, 7, 12, 16]);
// No CAN handler at all - actuator/sensor lives on the robot mainboard, not this board.
export const NO_HANDLER_TOOL_IDS = new Set([15, 20]);

// --- Bootloader/OTA status + verify-fail-reason tables (shared display use) ---
export const STATUS_NAMES: Record<number, string> = {
  0x01: 'Listening',
  0x02: 'Erasing backup slot',
  0x03: 'Receiving firmware data',
  0x04: 'Verify OK - jumping to new firmware',
  0x05: 'Verify FAILED',
  0x06: 'Verifying (size/CRC32/HMAC/HardwareID)',
  0x07: 'Copying backup into main slot',
  0xff: 'Error',
};
export const VERIFY_FAIL_REASONS: Record<number, string> = {
  0x01: 'Incomplete transfer',
  0x02: 'CRC32 mismatch',
  0x03: 'HMAC signature mismatch',
  0x04: 'HardwareID mismatch',
  0x05: 'Rollback rejected (anti-rollback)',
};

// --- Keepalive resend intervals ---
// A real master has to satisfy the firmware's own communication watchdogs by
// resending its command periodically. 150ms is used as a safety margin under
// every 250ms watchdog (soldering iron, laser, UV curing, hot air rework, 3D
// printer nozzle); the layer fan's watchdog is a separate, longer 1000ms, so
// it gets its own 400ms margin instead of reusing the 150/250 ratio blindly.
export const KEEPALIVE_INTERVAL_MS = 150;
export const LAYERFAN_KEEPALIVE_INTERVAL_MS = 400;
