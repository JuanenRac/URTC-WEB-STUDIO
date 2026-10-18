// =============================================================================
// URTC Web Studio - CAN protocol constants shared by Tester Studio and (where
// relevant) Flasher Studio. Follows tester_config.py / flasher_config.py from
// the URTC-TESTER and URTC-FLASHER Python tools for the identifiers it uses
// (not every identifier of those tools is here, and some names differ; the
// bootloader identifiers live in lib/flasher.ts) - see docs/CANBUS.TXT in the
// URTC firmware repo for the authoritative wire-level reference.
// =============================================================================

import * as generated from './generated/urtcCanIds';

// --- Global / cross-tool commands ---
export const CAN_ID_STATUS_LED_CMD = generated.CAN_ID_GLOBAL_STATUS; // status LED + ring LED + OLED mode, one 8-byte frame
export const CAN_ID_QUERY_ACTIVE_TOOL = generated.CAN_ID_QUERY_ACTIVE_TOOL;
export const CAN_ID_ACTIVE_TOOL_RESP = generated.CAN_ID_ACTIVE_TOOL_RESP;

export const CAN_ID_FRAM_QUERY = generated.CAN_ID_FRAM_QUERY;
export const CAN_ID_FRAM_STATE_RESP = generated.CAN_ID_FRAM_STATE_RESP;
export const CAN_ID_ERASE_FRAM = generated.CAN_ID_ERASE_FRAM;
export const ERASE_FRAM_MAGIC = [...generated.MAGIC_ERASE_FRAM];

export const CAN_ID_EXPANSION_SPI_REQ = generated.CAN_ID_EXPANSION_SPI_REQ;
export const CAN_ID_EXPANSION_SPI_RESP = generated.CAN_ID_EXPANSION_SPI_RESP;
export const CAN_ID_EXPANSION_DIAG0_REQ = generated.CAN_ID_EXPANSION_DIAG0_REQ;
export const CAN_ID_EXPANSION_DIAG0_RESP = generated.CAN_ID_EXPANSION_DIAG0_RESP;

export const CAN_ID_SET_EXPANSION_TYPE = generated.CAN_ID_SET_EXPANSION_TYPE;
export const CAN_ID_EXPANSION_TYPE_RESP = generated.CAN_ID_EXPANSION_TYPE_RESP; // empty payload = query, same ID answers
export const CAN_ID_SET_FREE_TOOL = generated.CAN_ID_SET_FREE_TOOL;
export const CAN_ID_FREE_TOOL_CONFIG_RESP = generated.CAN_ID_FREE_TOOL_CONFIG_RESP; // empty payload = query, same ID answers
export const CAN_ID_SET_DEVICE_SERIAL = generated.CAN_ID_SET_DEVICE_SERIAL;
export const CAN_ID_PERIPHERAL_INFO_RESP = generated.CAN_ID_PERIPHERAL_INFO_RESP; // empty payload = query, same ID answers
export const CAN_ID_SET_MLX_VARIANT = generated.CAN_ID_SET_MLX_VARIANT;
export const CAN_ID_MLX_VARIANT_RESP = generated.CAN_ID_MLX_VARIANT_RESP; // empty payload = query, same ID answers

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
export const CAN_ID_IMPACT_EVENT = generated.CAN_ID_IMPACT_EVENT;

// --- Shared plain-stepper motion (tools 1,2,3,6,7,12,16 + soldering iron's own feeder) ---
export const CAN_ID_MOTION_CMD = generated.CAN_ID_MOTION_CMD;

// --- Tool 0: Soldering Iron ---
export const CAN_ID_SOLDER_SETPOINT = generated.CAN_ID_SOLDER_SETPOINT;
export const CAN_ID_SOLDER_FEEDER_RESET = generated.CAN_ID_SOLDER_FEEDER_RESET;
export const CAN_ID_SOLDER_FEEDER_QUERY = generated.CAN_ID_SOLDER_FEEDER_POS; // empty payload = query, same ID answers
export const CAN_ID_SOLDER_TELEMETRY = generated.CAN_ID_SOLDER_TELEMETRY; // shared with Hot Air Rework
export const SOLDER_FEEDER_RESET_MAGIC = [...generated.MAGIC_SOLDER_FEEDER_RESET]; // "RSP0"

// --- Tool 4: Vacuum Pickup (telemetry only, no command) ---
export const CAN_ID_VACUUM_TELEMETRY = generated.CAN_ID_VACUUM_TELEMETRY;

// --- Tool 5: Drill ---
export const CAN_ID_DRILL_CMD = generated.CAN_ID_DRILL_CMD;
export const CAN_ID_DRILL_TELEMETRY = generated.CAN_ID_DRILL_TELEMETRY;

// --- Tool 8: AOI Inspection ---
export const CAN_ID_AOI_CMD = generated.CAN_ID_AOI_CMD;
export const CAN_ID_AOI_TELEMETRY = generated.CAN_ID_AOI_TELEMETRY;

// --- Tool 9: Laser Engraver ---
export const CAN_ID_LASER_CMD = generated.CAN_ID_LASER_CMD;
export const CAN_ID_LASER_TELEMETRY = generated.CAN_ID_LASER_TELEMETRY;

// --- Tool 10: 3D Printer ---
export const CAN_ID_3DP_THERMAL_MOTION = generated.CAN_ID_PRINTER_THERMAL_MOTION; // nozzle heater + extruder motion, combined
export const CAN_ID_3DP_LAYERFAN_CMD = generated.CAN_ID_PRINTER_LAYERFAN_CMD;
export const CAN_ID_3DP_HOTEND_TELEMETRY = generated.CAN_ID_PRINTER_HOTEND_TELEMETRY;
export const CAN_ID_3DP_LAYERFAN_TELEMETRY = generated.CAN_ID_PRINTER_LAYERFAN_RPM;
export const CAN_ID_3DP_HOTENDFAN_CMD = generated.CAN_ID_PRINTER_HOTENDFAN_CMD;
export const CAN_ID_3DP_HOTENDFAN_TELEMETRY = generated.CAN_ID_PRINTER_HOTENDFAN_RPM;

// --- Tool 13: Electromagnet ---
export const CAN_ID_ELECTROMAGNET_CMD = generated.CAN_ID_ELECTROMAGNET_CMD;

// --- Tool 14 / 24: Spot Welder / Ultrasonic Welder (shared payload shape) ---
export const CAN_ID_WELD_SPOT_CMD = generated.CAN_ID_SPOT_WELD_CMD;
export const CAN_ID_WELD_ULTRASONIC_CMD = generated.CAN_ID_ULTRASONIC_WELD_CMD;
export const WELD_PULSE_MAX_MS = 2000;

// --- Tool 18: UV Curing ---
export const CAN_ID_UV_CURING_CMD = generated.CAN_ID_UV_CURING_CMD;

// --- Tool 19: Hot Air Rework (telemetry shared with soldering iron's 0x135) ---
export const CAN_ID_HOTAIR_CMD = generated.CAN_ID_HOTAIR_CMD;

// --- Tool 21: Crimping Actuator (same payload shape as 0x120, routed to expansion driver) ---
export const CAN_ID_CRIMPING_CMD = generated.CAN_ID_CRIMPING_CMD;

// --- Tool 23: Paste Jetting ---
export const CAN_ID_PASTE_JETTING_CONFIG = generated.CAN_ID_PASTE_JETTING_CONFIG;
export const CAN_ID_PASTE_JETTING_PULSE = generated.CAN_ID_PASTE_JETTING_PULSE;

// --- Tool 17: Flying Probe ---
export const CAN_ID_FLYING_PROBE_BASIC = generated.CAN_ID_FLYING_PROBE_BASIC; // passive telemetry, onboard ADC
export const CAN_ID_FLYING_PROBE_ADS_CONFIG = generated.CAN_ID_ADS1115_CONFIG;
export const CAN_ID_FLYING_PROBE_ADS_TRIGGER = generated.CAN_ID_ADS1115_TRIGGER;
export const CAN_ID_FLYING_PROBE_ADS_RESULT = generated.CAN_ID_ADS1115_RESULT; // empty payload = query, same ID answers

// --- Tool 22: Thermal Inspection ---
export const CAN_ID_THERMAL_TRIGGER = generated.CAN_ID_THERMAL_TRIGGER;
export const CAN_ID_THERMAL_STATUS = generated.CAN_ID_THERMAL_STATUS; // empty payload = query, same ID answers
export const CAN_ID_THERMAL_RAW_CHUNK_REQ = generated.CAN_ID_THERMAL_RAW_CHUNK_REQ;
export const CAN_ID_THERMAL_RAW_CHUNK_RESP = generated.CAN_ID_THERMAL_RAW_CHUNK;
export const CAN_ID_THERMAL_CAL_CHUNK_REQ = generated.CAN_ID_THERMAL_CAL_CHUNK_REQ;
export const CAN_ID_THERMAL_CAL_CHUNK_RESP = generated.CAN_ID_THERMAL_CAL_CHUNK;
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

// --- Bootloader verify-fail reason codes (second byte of a 0x7F5 verify-fail frame) ---
// The wording lives in the locales as flasher.verify_fail_<code>.
export const VERIFY_FAIL_CODES: readonly number[] = [0x01, 0x02, 0x03, 0x04, 0x05];

// --- Keepalive resend intervals ---
// A real master has to satisfy the firmware's own communication watchdogs by
// resending its command periodically. 150ms is used as a safety margin under
// every 250ms watchdog (soldering iron, laser, UV curing, hot air rework, 3D
// printer nozzle); the layer fan's watchdog is a separate, longer 1000ms, so
// it gets its own 400ms margin instead of reusing the 150/250 ratio blindly.
export const KEEPALIVE_INTERVAL_MS = 150;
export const LAYERFAN_KEEPALIVE_INTERVAL_MS = 400;
