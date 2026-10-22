// =============================================================================
// URTC CAN protocol: constants, tables and pure frame builders and parsers.
// GENERATED from spec/can_protocol.json by tools/generate_constants.py - do not edit by hand.
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// Only erasable TypeScript syntax is used, so the file also runs under a type-stripping runtime.
// =============================================================================

export const PROTOCOL_VERSION = 1;
export const BYTE_ORDER = 'big';

// --- constants ---
export const BITRATE = 0x7A120; // Fixed bus bitrate (bit/s)
export const STANDARD_ID_MAX = 0x7FF; // Highest standard 11-bit identifier
export const DLC_MAX = 8; // Classic CAN payload limit (bytes)
export const HARDWARE_ID_MAIN = 0x303CC01; // HardwareID of the tool-head board (STM32F303CCT6, revision 1)
export const HARDWARE_ID_SLAVE = 0x303CB01; // HardwareID of the expansion slave (STM32F303CBT6)
export const FLASH_PAGE_SIZE = 0x800; // Flash page of the bootloader (bytes)
export const HMAC_LENGTH = 0x20; // HMAC-SHA256 signature length (bytes)
export const HMAC_CHUNK_COUNT = 4; // Frames of 8 bytes that carry the signature
export const PATCH_UNKNOWN = 0xFF; // Patch value meaning not known
export const PATCH_FLAG = 0x80; // High byte of the minor field: a patch follows in bits 6..0
export const PATCH_MAX = 0x7F; // Highest patch that fits the minor field
export const PATCH_FLAG_ACCEPTS_IN_END_UPDATE = 1; // Flag of 0x7E9: the bootloader reads the patch from the end-of-update frame
export const SLAVE_VERSION_EXT_MARKER = 0xE1; // First byte of the slave extended version register; never a status code
export const SLAVE_I2C_ADDRESS = 0x42; // 7-bit address of the expansion slave on the link bus
export const TELEMETRY_PERIOD_MS = 0x96; // Period of automatic telemetry (ms)
export const WATCHDOG_MS = 0xFA; // Communication watchdog of heaters, laser, drill and UV (ms)
export const LAYER_FAN_WATCHDOG_MS = 0x3E8; // Communication watchdog of the layer fan (ms)
export const KEEPALIVE_INTERVAL_MS = 0x96; // Resend interval hosts use under every 250 ms watchdog (ms)
export const LAYER_FAN_KEEPALIVE_INTERVAL_MS = 0x190; // Resend interval hosts use under the layer fan watchdog (ms)
export const LED_OVERRIDE_HOLD_MS = 0x2710; // How long a 0x100 override holds (ms)
export const ACTIVITY_WINDOW_MS = 0x5DC; // A frame of any ID within this window turns the status LED blue (ms)
export const BOOT_SPLASH_MS = 0x1388; // Approximate boot splash window; movement commands are deferred (ms)
export const HEARTBEAT_PERIOD_MS = 0x3E8; // Bootloader heartbeat period (ms)
export const VERSION_QUERY_TIMEOUT_S = 1.5; // Reference timeout of a version query (s)
export const VERSION_PATCH_GRACE_MS = 0x12C; // Grace window for 0x7E9 after 0x7F9 (ms)
export const READBACK_PAGE_BYTES = 0x800; // Bytes per read-back page (bytes)
export const READBACK_ACK_TIMEOUT_MS = 0xBB8; // The bootloader gives up on a read-back page not acknowledged in this time (ms)
export const HOTEND_FAN_STALL_MS = 0xBB8; // Hotend fan at duty above 0 with 0 RPM for this long is a critical error (ms)
export const HEATER_SETPOINT_MAX_C = 0x1BD; // Highest heater setpoint the firmware accepts (soldering iron and hot air) (C)
export const NOZZLE_SETPOINT_MAX_C = 0x12C; // Highest nozzle setpoint the hosts offer (hard ceiling in the firmware: 310) (C)
export const AOI_STROBE_MAX_MS = 0x1F4; // Highest strobe period the hosts offer (ms)
export const WELD_PULSE_MAX_MS = 0x7D0; // Longest weld pulse; the firmware clamps to it (ms)
export const PASTE_PULSE_MAX_MS = 0xFF; // Longest paste-jetting pulse that fits the byte (ms)
export const THERMAL_CHUNK_BYTES = 0x20; // Bytes per thermal chunk (4 frames of 8) (bytes)
export const THERMAL_CHUNK_COUNT_MLX90640 = 0x30; // Chunks of a 32x24 frame (MLX90640 and MLX90642)
export const THERMAL_CHUNK_COUNT_MLX90641 = 0xC; // Chunks of a 16x12 frame (MLX90641)
export const BLACKBOX_CHUNK_COUNT = 0x16; // Chunks of the fault recorder record read by 0x1A8

// --- identifiers ---
export const CAN_ID_IMPACT_EVENT = 0x095; // Impact register (touch probe, maximum priority)
export const CAN_ID_GLOBAL_STATUS = 0x100; // Status LED, ring LED and OLED mode
export const CAN_ID_QUERY_ACTIVE_TOOL = 0x110; // Query the active tool and the quick state
export const CAN_ID_ACTIVE_TOOL_RESP = 0x111; // Active tool and quick state
export const CAN_ID_MOTION_CMD = 0x120; // Plain stepper move (direction and step count)
export const CAN_ID_SOLDER_SETPOINT = 0x130; // T12 setpoint temperature
export const CAN_ID_SOLDER_FEEDER_RESET = 0x131; // Reset the solder wire feeder position
export const CAN_ID_SOLDER_FEEDER_POS = 0x132; // Solder wire feeder position
export const CAN_ID_SOLDER_TELEMETRY = 0x135; // T12 temperature telemetry
export const CAN_ID_DRILL_CMD = 0x140; // Drill speed and direction
export const CAN_ID_VACUUM_TELEMETRY = 0x145; // Vacuum pickup telemetry
export const CAN_ID_DRILL_TELEMETRY = 0x147; // Drill RPM and endstop telemetry
export const CAN_ID_AOI_CMD = 0x150; // AOI ring light mode and strobe period
export const CAN_ID_AOI_TELEMETRY = 0x155; // AOI endstop telemetry
export const CAN_ID_LASER_CMD = 0x160; // Laser power and interlock
export const CAN_ID_LASER_TELEMETRY = 0x165; // Laser endstop telemetry
export const CAN_ID_PRINTER_THERMAL_MOTION = 0x170; // Nozzle setpoint and extruder motion
export const CAN_ID_PRINTER_LAYERFAN_CMD = 0x173; // Layer fan power
export const CAN_ID_PRINTER_HOTEND_TELEMETRY = 0x175; // Hotend temperature telemetry
export const CAN_ID_PRINTER_LAYERFAN_RPM = 0x177; // Layer fan RPM telemetry
export const CAN_ID_PRINTER_HOTENDFAN_CMD = 0x178; // Hotend fan power
export const CAN_ID_PRINTER_HOTENDFAN_RPM = 0x179; // Hotend fan RPM telemetry
export const CAN_ID_EXPANSION_SPI_REQ = 0x180; // Expansion SPI passthrough request
export const CAN_ID_EXPANSION_SPI_RESP = 0x181; // Expansion SPI passthrough response
export const CAN_ID_EXPANSION_DIAG0_REQ = 0x182; // Query the TMC_DIAG0 level
export const CAN_ID_EXPANSION_DIAG0_RESP = 0x183; // TMC_DIAG0 level
export const CAN_ID_FRAM_QUERY = 0x190; // Query the recovered persisted state
export const CAN_ID_FRAM_STATE_RESP = 0x191; // Recovered persisted state
export const CAN_ID_ERASE_FRAM = 0x192; // Erase the recovered persisted state
export const CAN_ID_SET_EXPANSION_TYPE = 0x1A0; // Set the expansion board type
export const CAN_ID_EXPANSION_TYPE_RESP = 0x1A1; // Expansion board type (query and response)
export const CAN_ID_SET_FREE_TOOL = 0x1A2; // Set the free tool configuration
export const CAN_ID_FREE_TOOL_CONFIG_RESP = 0x1A3; // Raw jumper reading and free tool configuration
export const CAN_ID_SET_DEVICE_SERIAL = 0x1A4; // Set the device serial number
export const CAN_ID_PERIPHERAL_INFO_RESP = 0x1A5; // Peripheral type and device serial
export const CAN_ID_SET_MLX_VARIANT = 0x1A6; // Set the MLX9064x sensor variant
export const CAN_ID_MLX_VARIANT_RESP = 0x1A7; // MLX9064x sensor variant (query and response)
export const CAN_ID_BLACKBOX_QUERY = 0x1A8; // Request one chunk of the fault recorder
export const CAN_ID_BLACKBOX_CHUNK = 0x1A9; // One chunk of the fault recorder
export const CAN_ID_THERMAL_STATS_QUERY = 0x1AA; // Query the lifetime thermal counters
export const CAN_ID_THERMAL_STATS_RESP = 0x1AB; // Lifetime thermal counters
export const CAN_ID_SET_MULTINODE = 0x1AC; // Switch the multinode extension on or off (persistent, acts after the next power-up)
export const CAN_ID_MULTINODE_CONFIG_RESP = 0x1AD; // The multinode switch: stored value, value in force, instance and node address
export const CAN_ID_SET_FEATURES = 0x1AE; // Switch the optional firmware features on or off (persistent, acts after the next power-up)
export const CAN_ID_FEATURES_RESP = 0x1AF; // The optional firmware features: stored mask, mask in force and supported mask
export const CAN_ID_ELECTROMAGNET_CMD = 0x1B0; // Electromagnet coil
export const CAN_ID_HEALTH_PROFILE = 0x1B8; // Periodic health frame of the board (only while the health feature runs)
export const CAN_ID_PID_CONFIG = 0x1B9; // Gains of the heater PID and start of its relay autotune
export const CAN_ID_PID_STATE_RESP = 0x1BA; // The heater PID: gains in force, state and output
export const CAN_ID_SPOT_WELD_CMD = 0x1C0; // Spot welder timed pulse
export const CAN_ID_UV_CURING_CMD = 0x1D0; // UV curing LED duty
export const CAN_ID_HOTAIR_CMD = 0x1E0; // Hot-air nozzle setpoint and blower duty
export const CAN_ID_CRIMPING_CMD = 0x1F0; // Crimping actuator motor
export const CAN_ID_ULTRASONIC_WELD_CMD = 0x200; // Ultrasonic welder timed pulse
export const CAN_ID_SLAVE_ENTER_BOOTLOADER = 0x210; // Enter the expansion slave's bootloader
export const CAN_ID_SLAVE_START_UPDATE = 0x211; // Start the slave firmware update
export const CAN_ID_SLAVE_HMAC_CHUNK = 0x212; // Slave HMAC-SHA256 signature chunk
export const CAN_ID_SLAVE_DATA = 0x213; // Slave firmware data
export const CAN_ID_SLAVE_END_UPDATE = 0x214; // End the slave update and verify
export const CAN_ID_SLAVE_STATUS = 0x215; // Slave bootloader status
export const CAN_ID_SLAVE_PROGRESS = 0x216; // Slave update progress
export const CAN_ID_SLAVE_VERSION_RESP_1 = 0x217; // Slave bootloader version, part 1
export const CAN_ID_SLAVE_VERSION_RESP_2 = 0x218; // Slave bootloader version, part 2
export const CAN_ID_SLAVE_VERIFY_FAIL_REASON = 0x219; // Slave verify-fail reason
export const CAN_ID_SLAVE_REG_WRITE = 0x220; // Write a slave application register (generic)
export const CAN_ID_SLAVE_REG_READ = 0x221; // Read a slave application register (generic)
export const CAN_ID_PASTE_JETTING_CONFIG = 0x230; // Local PWM configuration
export const CAN_ID_PASTE_JETTING_PULSE = 0x231; // Local PWM pulse
export const CAN_ID_ADS1115_CONFIG = 0x240; // ADS1115 configuration
export const CAN_ID_ADS1115_TRIGGER = 0x241; // ADS1115 trigger a conversion
export const CAN_ID_ADS1115_RESULT = 0x242; // ADS1115 conversion result (query and response)
export const CAN_ID_FLYING_PROBE_BASIC = 0x243; // Basic-mode onboard ADC reading
export const CAN_ID_THERMAL_TRIGGER = 0x250; // Trigger a thermal capture
export const CAN_ID_THERMAL_STATUS = 0x251; // Thermal capture status (query and response)
export const CAN_ID_THERMAL_RAW_CHUNK_REQ = 0x252; // Request a raw pixel chunk
export const CAN_ID_THERMAL_RAW_CHUNK = 0x253; // Raw pixel chunk data
export const CAN_ID_THERMAL_CAL_CHUNK_REQ = 0x254; // Request a calibrated temperature chunk
export const CAN_ID_THERMAL_CAL_CHUNK = 0x255; // Calibrated temperature chunk data
export const CAN_ID_VERSION_PATCH_RESPONSE = 0x7E9; // Version patch response
export const CAN_ID_ENTER_BOOTLOADER = 0x7F0; // Enter the bootloader
export const CAN_ID_START_UPDATE = 0x7F1; // Start the firmware update
export const CAN_ID_DATA = 0x7F2; // Firmware data
export const CAN_ID_PAGE_ACK = 0x7F3; // Page written acknowledgement
export const CAN_ID_END_UPDATE = 0x7F4; // End the update and verify
export const CAN_ID_STATUS = 0x7F5; // Bootloader status
export const CAN_ID_HEARTBEAT = 0x7F6; // Bootloader heartbeat
export const CAN_ID_HMAC_CHUNK = 0x7F7; // HMAC-SHA256 signature chunk
export const CAN_ID_QUERY_VERSION = 0x7F8; // Query the version
export const CAN_ID_VERSION_RESPONSE = 0x7F9; // Version response
export const CAN_ID_BOOTLOADER_VERSION_RESPONSE = 0x7FA; // Bootloader's own version
export const CAN_ID_QUERY_ERROR_COUNTERS = 0x7FB; // Query the CAN error counters
export const CAN_ID_ERROR_COUNTERS_RESPONSE = 0x7FC; // CAN error counters
export const CAN_ID_AUTHORIZE_DOWNGRADE = 0x7FD; // Authorise a downgrade for the current update
export const CAN_ID_READBACK = 0x7FE; // Read back the installed application
export const CAN_ID_READBACK_PAGE_ACK = 0x7FF; // Read-back page acknowledgement

// --- enumerations ---
// Tool profile
export const TOOL_SOLDERING_IRON = 0x00;
export const TOOL_PASTE_DISPENSER = 0x01;
export const TOOL_LIQUID_DISPENSER = 0x02;
export const TOOL_SCREWDRIVER = 0x03;
export const TOOL_VACUUM_PICKUP = 0x04;
export const TOOL_DRILL = 0x05;
export const TOOL_GRIPPER_GIMBAL = 0x06;
export const TOOL_GRIPPER_NEMA = 0x07;
export const TOOL_AOI_INSPECTION = 0x08;
export const TOOL_LASER_ENGRAVER = 0x09;
export const TOOL_PRINTER_3D = 0x0A;
export const TOOL_SCAN_PROBE = 0x0B;
export const TOOL_SMT_PICKPLACE = 0x0C;
export const TOOL_ELECTROMAGNET = 0x0D;
export const TOOL_SPOT_WELDER = 0x0E;
export const TOOL_CONFORMAL_COATING = 0x0F;
export const TOOL_VACUUM_GRIPPER_LG = 0x10;
export const TOOL_FLYING_PROBE = 0x11;
export const TOOL_UV_CURING = 0x12;
export const TOOL_HOTAIR_REWORK = 0x13;
export const TOOL_PRESSFIT_INSERTER = 0x14;
export const TOOL_CRIMPING_ACTUATOR = 0x15;
export const TOOL_THERMAL_INSPECTION = 0x16;
export const TOOL_PASTE_JETTING = 0x17;
export const TOOL_ULTRASONIC_WELDER = 0x18;
export const TOOL_INVALID = 0x19;

// Bootloader status
export const STATUS_LISTENING = 0x01;
export const STATUS_ERASING = 0x02;
export const STATUS_RECEIVING = 0x03;
export const STATUS_VERIFYING = 0x06;
export const STATUS_COPYING = 0x07;
export const STATUS_VERIFY_OK = 0x04;
export const STATUS_VERIFY_FAIL = 0x05;
export const STATUS_ERROR = 0xFF;

// Verify-fail reason
export const VERIFY_FAIL_REASON_INCOMPLETE = 0x01;
export const VERIFY_FAIL_REASON_CRC32 = 0x02;
export const VERIFY_FAIL_REASON_HMAC = 0x03;
export const VERIFY_FAIL_REASON_HARDWARE_ID = 0x04;
export const VERIFY_FAIL_REASON_ROLLBACK = 0x05;

// Answering side
export const RESPONDER_APPLICATION = 0x00;
export const RESPONDER_BOOTLOADER = 0x01;

// Thermal fault code
export const THERMAL_FAULT_NONE = 0x00;
export const THERMAL_FAULT_MAXTEMP = 0x01;
export const THERMAL_FAULT_HEATING_NO_RISE = 0x02;
export const THERMAL_FAULT_DROPPED_AT_TARGET = 0x03;

// Reset cause flags
export const RESET_CAUSE_IWDG = 0x01;
export const RESET_CAUSE_WWDG = 0x02;
export const RESET_CAUSE_SOFTWARE = 0x04;
export const RESET_CAUSE_POWER_ON = 0x08;
export const RESET_CAUSE_PIN = 0x10;
export const RESET_CAUSE_LOW_POWER = 0x20;
export const RESET_CAUSE_OPTION_BYTES = 0x40;

// Expansion board type
export const EXPANSION_BOARD_NONE = 0x00;
export const EXPANSION_BOARD_BASIC_TMC2209 = 0x01;
export const EXPANSION_BOARD_BASIC_TMC5160A = 0x02;
export const EXPANSION_BOARD_ADVANCED_TMC2209 = 0x03;
export const EXPANSION_BOARD_ADVANCED_TMC5160A = 0x04;
export const EXPANSION_BOARD_BASIC_ADS1115 = 0x05;
export const EXPANSION_BOARD_BASIC_MLX9064X = 0x06;

// MLX9064x sensor variant
export const MLX_VARIANT_NONE = 0x00;
export const MLX_VARIANT_MLX90640 = 0x01;
export const MLX_VARIANT_MLX90641 = 0x02;
export const MLX_VARIANT_MLX90642 = 0x03;

// OLED mode
export const DISPLAY_MODE_STANDARD = 0x00;
export const DISPLAY_MODE_NIGHT = 0x01;
export const DISPLAY_MODE_STANDBY = 0x0F;

// AOI ring light mode
export const AOI_RING_OFF = 0x00;
export const AOI_RING_STROBE = 0x01;
export const AOI_RING_CONTINUOUS = 0x02;

// Thermal capture status
export const THERMAL_CAPTURE_IDLE = 0x00;
export const THERMAL_CAPTURE_BUSY = 0x01;
export const THERMAL_CAPTURE_READY = 0x02;
export const THERMAL_CAPTURE_ERROR = 0xFF;

// Plain stepper direction
export const MOTION_DIR_FORWARD = 0x01;
export const MOTION_DIR_REVERSE = 0x00;

// Drill direction
export const DRILL_DIR_COUNTER_CLOCKWISE = 0x01;
export const DRILL_DIR_CLOCKWISE = 0x00;

// Extruder direction
export const EXTRUDER_DIR_FORWARD = 0x01;
export const EXTRUDER_DIR_RETRACT = 0x00;

// Flags of the version patch frame
export const VERSION_FLAG_END_UPDATE_PATCH = 0x01;

// Impact register
export const IMPACT_IMPACT = 0x01;

// Optional firmware features (each one is off until switched on)
export const FEATURE_MOTION_RAMPS = 0x01;
export const FEATURE_HEALTH_PROFILE = 0x02;
export const FEATURE_HSI_AUTOTRIM = 0x04;
export const FEATURE_THERMAL_PID = 0x08;

// Speed profile of a stepper move
export const MOTION_PROFILE_CONSTANT = 0x00;
export const MOTION_PROFILE_TRAPEZOID = 0x01;
export const MOTION_PROFILE_S_CURVE = 0x02;

// What a PID configuration frame asks
export const PID_ACTION_SET_GAINS = 0x00;
export const PID_ACTION_AUTOTUNE_START = 0x01;
export const PID_ACTION_AUTOTUNE_ABORT = 0x02;
export const PID_ACTION_QUERY = 0x03;

// State of the heater PID
export const PID_STATE_OFF = 0x00;
export const PID_STATE_RUNNING = 0x01;
export const PID_STATE_AUTOTUNING = 0x02;
export const PID_STATE_AUTOTUNE_DONE = 0x03;
export const PID_STATE_AUTOTUNE_FAILED = 0x04;

export const ENUM_NAMES: Record<string, Record<number, string>> = {"tool": {"0": "SOLDERING_IRON", "1": "PASTE_DISPENSER", "2": "LIQUID_DISPENSER", "3": "SCREWDRIVER", "4": "VACUUM_PICKUP", "5": "DRILL", "6": "GRIPPER_GIMBAL", "7": "GRIPPER_NEMA", "8": "AOI_INSPECTION", "9": "LASER_ENGRAVER", "10": "PRINTER_3D", "11": "SCAN_PROBE", "12": "SMT_PICKPLACE", "13": "ELECTROMAGNET", "14": "SPOT_WELDER", "15": "CONFORMAL_COATING", "16": "VACUUM_GRIPPER_LG", "17": "FLYING_PROBE", "18": "UV_CURING", "19": "HOTAIR_REWORK", "20": "PRESSFIT_INSERTER", "21": "CRIMPING_ACTUATOR", "22": "THERMAL_INSPECTION", "23": "PASTE_JETTING", "24": "ULTRASONIC_WELDER", "25": "INVALID"}, "bootloader_status": {"1": "LISTENING", "2": "ERASING", "3": "RECEIVING", "6": "VERIFYING", "7": "COPYING", "4": "VERIFY_OK", "5": "VERIFY_FAIL", "255": "ERROR"}, "verify_fail_reason": {"1": "INCOMPLETE", "2": "CRC32", "3": "HMAC", "4": "HARDWARE_ID", "5": "ROLLBACK"}, "responder": {"0": "APPLICATION", "1": "BOOTLOADER"}, "thermal_fault": {"0": "NONE", "1": "MAXTEMP", "2": "HEATING_NO_RISE", "3": "DROPPED_AT_TARGET"}, "reset_cause": {"1": "IWDG", "2": "WWDG", "4": "SOFTWARE", "8": "POWER_ON", "16": "PIN", "32": "LOW_POWER", "64": "OPTION_BYTES"}, "expansion_board_type": {"0": "NONE", "1": "BASIC_TMC2209", "2": "BASIC_TMC5160A", "3": "ADVANCED_TMC2209", "4": "ADVANCED_TMC5160A", "5": "BASIC_ADS1115", "6": "BASIC_MLX9064X"}, "mlx_sensor_variant": {"0": "NONE", "1": "MLX90640", "2": "MLX90641", "3": "MLX90642"}, "display_mode": {"0": "STANDARD", "1": "NIGHT", "15": "STANDBY"}, "aoi_ring_mode": {"0": "OFF", "1": "STROBE", "2": "CONTINUOUS"}, "thermal_capture_status": {"0": "IDLE", "1": "BUSY", "2": "READY", "255": "ERROR"}, "motion_direction": {"1": "FORWARD", "0": "REVERSE"}, "drill_direction": {"1": "COUNTER_CLOCKWISE", "0": "CLOCKWISE"}, "extruder_direction": {"1": "FORWARD", "0": "RETRACT"}, "version_flags": {"1": "END_UPDATE_PATCH"}, "impact_event": {"1": "IMPACT"}, "firmware_feature": {"1": "MOTION_RAMPS", "2": "HEALTH_PROFILE", "4": "HSI_AUTOTRIM", "8": "THERMAL_PID"}, "motion_profile": {"0": "CONSTANT", "1": "TRAPEZOID", "2": "S_CURVE"}, "pid_action": {"0": "SET_GAINS", "1": "AUTOTUNE_START", "2": "AUTOTUNE_ABORT", "3": "QUERY"}, "pid_state": {"0": "OFF", "1": "RUNNING", "2": "AUTOTUNING", "3": "AUTOTUNE_DONE", "4": "AUTOTUNE_FAILED"}};
export const ENUM_TITLES: Record<string, Record<number, string>> = {"tool": {"0": "Soldering Iron", "1": "Paste Dispenser", "2": "Liquid Dispenser", "3": "Screwdriver", "4": "Vacuum Pickup", "5": "Drill", "6": "Gripper (Gimbal)", "7": "Gripper (NEMA)", "8": "AOI Inspection", "9": "Laser Engraver", "10": "3D Printer", "11": "Scan Probe", "12": "SMT Pick & Place", "13": "Electromagnet", "14": "Spot Welder", "15": "Conformal Coating", "16": "Vacuum Gripper (LG)", "17": "Flying Probe", "18": "UV Curing", "19": "Hot Air Rework", "20": "Press-Fit Inserter", "21": "Crimping Actuator", "22": "Thermal Inspection", "23": "Paste Jetting", "24": "Ultrasonic Welder", "25": "No tool assigned"}, "bootloader_status": {"1": "Listening", "2": "Erasing backup slot", "3": "Receiving firmware data", "6": "Verifying (size/CRC32/HMAC/HardwareID)", "7": "Copying backup into main slot", "4": "Verify OK - jumping to new firmware", "5": "Verify failed - main slot untouched", "255": "Error"}, "verify_fail_reason": {"1": "Incomplete transfer", "2": "CRC32 mismatch", "3": "HMAC signature mismatch", "4": "HardwareID mismatch", "5": "Rollback rejected"}, "responder": {"0": "The running application", "1": "The bootloader"}, "thermal_fault": {"0": "None", "1": "Temperature above the hard ceiling", "2": "Heater on, no temperature rise", "3": "Dropped far below the target at the target"}, "reset_cause": {"1": "Hardware watchdog", "2": "Window watchdog", "4": "Software reset", "8": "Power-on or brown-out", "16": "NRST pin", "32": "Low-power reset", "64": "Option-byte load"}, "expansion_board_type": {"0": "None installed", "1": "Basic, TMC2209", "2": "Basic, TMC5160A", "3": "Advanced, TMC2209 + STM32F303CBT6", "4": "Advanced, TMC5160A + STM32F303CBT6", "5": "Basic, ADS1115 only (direct connection)", "6": "Basic, MLX9064x only (direct connection)"}, "mlx_sensor_variant": {"0": "None installed", "1": "MLX90640 (32x24)", "2": "MLX90641 (16x12)", "3": "MLX90642 (32x24, onboard calculation)"}, "display_mode": {"0": "Standard", "1": "Night mode", "15": "Standby (display off)"}, "aoi_ring_mode": {"0": "Ring off", "1": "Synchronous strobe", "2": "Continuous illumination"}, "thermal_capture_status": {"0": "Idle", "1": "Capture in progress", "2": "Frame available", "255": "Sensor or I2C error"}, "motion_direction": {"1": "Clockwise or forward", "0": "Counter-clockwise or reverse"}, "drill_direction": {"1": "Counter-clockwise (FRIN high)", "0": "Clockwise (FRIN low)"}, "extruder_direction": {"1": "Forward", "0": "Retract"}, "version_flags": {"1": "This bootloader reads the patch from the minor field of the end-of-update frame"}, "impact_event": {"1": "Impact detected"}, "firmware_feature": {"1": "Trapezoidal and S-curve ramps for the stepper", "2": "Periodic health frame of the board", "4": "Trim of the internal oscillator against the CAN bit time", "8": "PID with anti-windup and relay autotune for the heaters"}, "motion_profile": {"0": "Constant speed (the behaviour without the ramps feature)", "1": "Trapezoidal: constant acceleration, cruise, constant deceleration", "2": "S-curve: the acceleration itself ramps up and down"}, "pid_action": {"0": "Store the gains in the frame", "1": "Start the relay autotune around the current setpoint", "2": "Abort a running autotune", "3": "Change nothing, answer with the state"}, "pid_state": {"0": "The feature is not running (bang-bang control)", "1": "PID control", "2": "Relay autotune in progress", "3": "Autotune finished and the gains were stored", "4": "Autotune gave up; the previous gains are kept"}};
export const TOOL_NAMES: Record<number, string> = ENUM_TITLES.tool;

// --- magic payloads: a destructive or one-shot command is only obeyed with exactly these four bytes ---
export const MAGIC_ENTER_BOOTLOADER = [176, 7, 29, 90]; // Reset the board (or the slave) into its bootloader (0x7F0)
export const MAGIC_AUTHORIZE_DOWNGRADE = [208, 158, 18, 173]; // Allow one older, validly signed image (0x7FD)
export const MAGIC_ERASE_FRAM = [227, 165, 224, 255]; // Erase the recovered persisted state (0x192)
export const MAGIC_SOLDER_FEEDER_RESET = [82, 83, 80, 48]; // Reset the solder wire feeder position (ASCII RSP0) (0x131)

// --- registers of the expansion slave over the I2C link bus ---
export const SLAVE_BOOT_REG_STATUS = 0x00;
export const SLAVE_BOOT_REG_START_UPDATE = 0x01;
export const SLAVE_BOOT_REG_HMAC_EXPECTED = 0x02;
export const SLAVE_BOOT_REG_DATA = 0x03;
export const SLAVE_BOOT_REG_END_UPDATE = 0x04;
export const SLAVE_BOOT_REG_PROGRESS = 0x05;
export const SLAVE_BOOT_REG_QUERY_VERSION = 0x06;
export const SLAVE_BOOT_REG_VERIFY_FAIL_REASON = 0x07;
export const SLAVE_BOOT_REG_QUERY_VERSION_EXT = 0x08;
export const SLAVE_APP_REG_APP_STATUS = 0x00;
export const SLAVE_APP_REG_APP_VERSION = 0x01;
export const SLAVE_APP_REG_ENTER_BOOTLOADER = 0x02;
export const SLAVE_APP_REG_MLX_TRIGGER_CAPTURE = 0x10;
export const SLAVE_APP_REG_MLX_CAPTURE_STATUS = 0x11;
export const SLAVE_APP_REG_MLX_RAW_CHUNK = 0x12;
export const SLAVE_APP_REG_MLX_CALIBRATED_CHUNK = 0x13;
export const SLAVE_APP_REG_MLX_SENSOR_VARIANT = 0x14;
export const SLAVE_APP_REG_ADS_CONFIGURE = 0x20;
export const SLAVE_APP_REG_ADS_TRIGGER = 0x21;
export const SLAVE_APP_REG_ADS_READ = 0x22;
export const SLAVE_APP_REG_PWM_CONFIGURE = 0x30;
export const SLAVE_APP_REG_PWM_PULSE = 0x31;
export const SLAVE_APP_REG_PWM_STOP = 0x32;

// --- SLCAN ---
export const SLCAN_BITRATES: [string, string][] = [["10 kbit/s", "0"], ["20 kbit/s", "1"], ["50 kbit/s", "2"], ["100 kbit/s", "3"], ["125 kbit/s", "4"], ["250 kbit/s", "5"], ["500 kbit/s", "6"], ["800 kbit/s", "7"], ["1 Mbit/s", "8"]];
export const SLCAN_BITRATE_DEFAULT_CODE = '6';
export const SLCAN_RX_BUFFER_LIMIT = 4096;

// --- one record per identifier ---
export const MESSAGES: Record<number, { name: string; group: string; direction: string; handled_by: string; tools: number[] | null; gates?: Record<string, unknown>; timing?: Record<string, number> }> = {"149": {"name": "IMPACT_EVENT", "group": "impact", "direction": "board_to_host", "handled_by": "application", "tools": [11]}, "256": {"name": "GLOBAL_STATUS", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "272": {"name": "QUERY_ACTIVE_TOOL", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "273": {"name": "ACTIVE_TOOL_RESP", "group": "global", "direction": "board_to_host", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "288": {"name": "MOTION_CMD", "group": "motion", "direction": "host_to_board", "handled_by": "application", "tools": [0, 1, 2, 3, 6, 7, 12, 16], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "304": {"name": "SOLDER_SETPOINT", "group": "soldering", "direction": "host_to_board", "handled_by": "application", "tools": [0], "gates": {"blocked_by_critical_error": true}, "timing": {"watchdog_ms": 250}}, "305": {"name": "SOLDER_FEEDER_RESET", "group": "soldering", "direction": "host_to_board", "handled_by": "application", "tools": [0], "gates": {"blocked_by_critical_error": true, "needs_magic": "solder_feeder_reset"}}, "306": {"name": "SOLDER_FEEDER_POS", "group": "soldering", "direction": "both", "handled_by": "application", "tools": [0], "gates": {"blocked_by_critical_error": true}}, "309": {"name": "SOLDER_TELEMETRY", "group": "soldering", "direction": "board_to_host", "handled_by": "application", "tools": [0, 19], "timing": {"period_ms": 150}}, "320": {"name": "DRILL_CMD", "group": "drill", "direction": "host_to_board", "handled_by": "application", "tools": [5], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}, "timing": {"watchdog_ms": 250}}, "325": {"name": "VACUUM_TELEMETRY", "group": "vacuum", "direction": "board_to_host", "handled_by": "application", "tools": [4], "timing": {"period_ms": 150}}, "327": {"name": "DRILL_TELEMETRY", "group": "drill", "direction": "board_to_host", "handled_by": "application", "tools": [5], "timing": {"period_ms": 150}}, "336": {"name": "AOI_CMD", "group": "aoi", "direction": "host_to_board", "handled_by": "application", "tools": [8], "gates": {"blocked_by_critical_error": true}}, "341": {"name": "AOI_TELEMETRY", "group": "aoi", "direction": "board_to_host", "handled_by": "application", "tools": [8], "timing": {"period_ms": 150}}, "352": {"name": "LASER_CMD", "group": "laser", "direction": "host_to_board", "handled_by": "application", "tools": [9], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}, "timing": {"watchdog_ms": 250}}, "357": {"name": "LASER_TELEMETRY", "group": "laser", "direction": "board_to_host", "handled_by": "application", "tools": [9], "timing": {"period_ms": 150}}, "368": {"name": "PRINTER_THERMAL_MOTION", "group": "printer", "direction": "host_to_board", "handled_by": "application", "tools": [10], "gates": {"blocked_by_critical_error": true}, "timing": {"watchdog_ms": 250}}, "371": {"name": "PRINTER_LAYERFAN_CMD", "group": "printer", "direction": "host_to_board", "handled_by": "application", "tools": [10], "gates": {"blocked_by_critical_error": true}, "timing": {"watchdog_ms": 1000}}, "373": {"name": "PRINTER_HOTEND_TELEMETRY", "group": "printer", "direction": "board_to_host", "handled_by": "application", "tools": [10], "timing": {"period_ms": 150}}, "375": {"name": "PRINTER_LAYERFAN_RPM", "group": "printer", "direction": "board_to_host", "handled_by": "application", "tools": [10], "timing": {"period_ms": 150}}, "376": {"name": "PRINTER_HOTENDFAN_CMD", "group": "printer", "direction": "host_to_board", "handled_by": "application", "tools": [10], "gates": {"blocked_by_critical_error": true}}, "377": {"name": "PRINTER_HOTENDFAN_RPM", "group": "printer", "direction": "board_to_host", "handled_by": "application", "tools": [10], "timing": {"period_ms": 150}}, "384": {"name": "EXPANSION_SPI_REQ", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "385": {"name": "EXPANSION_SPI_RESP", "group": "global", "direction": "board_to_host", "handled_by": "application", "tools": null}, "386": {"name": "EXPANSION_DIAG0_REQ", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "387": {"name": "EXPANSION_DIAG0_RESP", "group": "global", "direction": "board_to_host", "handled_by": "application", "tools": null}, "400": {"name": "FRAM_QUERY", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "401": {"name": "FRAM_STATE_RESP", "group": "global", "direction": "board_to_host", "handled_by": "application", "tools": null}, "402": {"name": "ERASE_FRAM", "group": "global", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true, "needs_magic": "erase_fram"}}, "416": {"name": "SET_EXPANSION_TYPE", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "417": {"name": "EXPANSION_TYPE_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "418": {"name": "SET_FREE_TOOL", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "419": {"name": "FREE_TOOL_CONFIG_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "420": {"name": "SET_DEVICE_SERIAL", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "421": {"name": "PERIPHERAL_INFO_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "422": {"name": "SET_MLX_VARIANT", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "423": {"name": "MLX_VARIANT_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "424": {"name": "BLACKBOX_QUERY", "group": "diagnostics", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "425": {"name": "BLACKBOX_CHUNK", "group": "diagnostics", "direction": "board_to_host", "handled_by": "application", "tools": null}, "426": {"name": "THERMAL_STATS_QUERY", "group": "diagnostics", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}}, "427": {"name": "THERMAL_STATS_RESP", "group": "diagnostics", "direction": "board_to_host", "handled_by": "application", "tools": null}, "428": {"name": "SET_MULTINODE", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "429": {"name": "MULTINODE_CONFIG_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "430": {"name": "SET_FEATURES", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "431": {"name": "FEATURES_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "432": {"name": "ELECTROMAGNET_CMD", "group": "electromagnet", "direction": "host_to_board", "handled_by": "application", "tools": [13], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "440": {"name": "HEALTH_PROFILE", "group": "diagnostics", "direction": "board_to_host", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false}, "timing": {"period_ms": 1000}}, "441": {"name": "PID_CONFIG", "group": "configuration", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "442": {"name": "PID_STATE_RESP", "group": "configuration", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "448": {"name": "SPOT_WELD_CMD", "group": "welding", "direction": "host_to_board", "handled_by": "application", "tools": [14], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "464": {"name": "UV_CURING_CMD", "group": "uv", "direction": "host_to_board", "handled_by": "application", "tools": [18], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}, "timing": {"watchdog_ms": 250}}, "480": {"name": "HOTAIR_CMD", "group": "hotair", "direction": "host_to_board", "handled_by": "application", "tools": [19], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}, "timing": {"watchdog_ms": 250}}, "496": {"name": "CRIMPING_CMD", "group": "crimping", "direction": "host_to_board", "handled_by": "application", "tools": [21], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "512": {"name": "ULTRASONIC_WELD_CMD", "group": "welding", "direction": "host_to_board", "handled_by": "application", "tools": [24], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "528": {"name": "SLAVE_ENTER_BOOTLOADER", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true, "needs_magic": "enter_bootloader"}}, "529": {"name": "SLAVE_START_UPDATE", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "530": {"name": "SLAVE_HMAC_CHUNK", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "531": {"name": "SLAVE_DATA", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "532": {"name": "SLAVE_END_UPDATE", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "533": {"name": "SLAVE_STATUS", "group": "slave_bridge", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "534": {"name": "SLAVE_PROGRESS", "group": "slave_bridge", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "535": {"name": "SLAVE_VERSION_RESP_1", "group": "slave_bridge", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "536": {"name": "SLAVE_VERSION_RESP_2", "group": "slave_bridge", "direction": "board_to_host", "handled_by": "application", "tools": null}, "537": {"name": "SLAVE_VERIFY_FAIL_REASON", "group": "slave_bridge", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "544": {"name": "SLAVE_REG_WRITE", "group": "slave_bridge", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "545": {"name": "SLAVE_REG_READ", "group": "slave_bridge", "direction": "both", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": true}}, "560": {"name": "PASTE_JETTING_CONFIG", "group": "pastejetting", "direction": "host_to_board", "handled_by": "application", "tools": [23], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "561": {"name": "PASTE_JETTING_PULSE", "group": "pastejetting", "direction": "host_to_board", "handled_by": "application", "tools": [23], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "576": {"name": "ADS1115_CONFIG", "group": "functionaltest", "direction": "host_to_board", "handled_by": "application", "tools": [17], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "577": {"name": "ADS1115_TRIGGER", "group": "functionaltest", "direction": "host_to_board", "handled_by": "application", "tools": [17], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "578": {"name": "ADS1115_RESULT", "group": "functionaltest", "direction": "both", "handled_by": "application", "tools": [17], "gates": {"blocked_by_critical_error": true}}, "579": {"name": "FLYING_PROBE_BASIC", "group": "functionaltest", "direction": "board_to_host", "handled_by": "application", "tools": [17], "timing": {"period_ms": 150}}, "592": {"name": "THERMAL_TRIGGER", "group": "thermal", "direction": "host_to_board", "handled_by": "application", "tools": [22], "gates": {"blocked_by_critical_error": true, "blocked_during_boot_sequence": true}}, "593": {"name": "THERMAL_STATUS", "group": "thermal", "direction": "both", "handled_by": "application", "tools": [22], "gates": {"blocked_by_critical_error": true}}, "594": {"name": "THERMAL_RAW_CHUNK_REQ", "group": "thermal", "direction": "host_to_board", "handled_by": "application", "tools": [22], "gates": {"blocked_by_critical_error": true}}, "595": {"name": "THERMAL_RAW_CHUNK", "group": "thermal", "direction": "board_to_host", "handled_by": "application", "tools": [22]}, "596": {"name": "THERMAL_CAL_CHUNK_REQ", "group": "thermal", "direction": "host_to_board", "handled_by": "application", "tools": [22], "gates": {"blocked_by_critical_error": true}}, "597": {"name": "THERMAL_CAL_CHUNK", "group": "thermal", "direction": "board_to_host", "handled_by": "application", "tools": [22]}, "2025": {"name": "VERSION_PATCH_RESPONSE", "group": "bootloader", "direction": "board_to_host", "handled_by": "both", "tools": null}, "2032": {"name": "ENTER_BOOTLOADER", "group": "bootloader", "direction": "host_to_board", "handled_by": "application", "tools": null, "gates": {"blocked_by_critical_error": false, "needs_magic": "enter_bootloader"}}, "2033": {"name": "START_UPDATE", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null}, "2034": {"name": "DATA", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null}, "2035": {"name": "PAGE_ACK", "group": "bootloader", "direction": "board_to_host", "handled_by": "bootloader", "tools": null}, "2036": {"name": "END_UPDATE", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null}, "2037": {"name": "STATUS", "group": "bootloader", "direction": "board_to_host", "handled_by": "bootloader", "tools": null}, "2038": {"name": "HEARTBEAT", "group": "bootloader", "direction": "board_to_host", "handled_by": "bootloader", "tools": null, "timing": {"period_ms": 1000}}, "2039": {"name": "HMAC_CHUNK", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null}, "2040": {"name": "QUERY_VERSION", "group": "bootloader", "direction": "host_to_board", "handled_by": "both", "tools": null, "gates": {"blocked_by_critical_error": false}}, "2041": {"name": "VERSION_RESPONSE", "group": "bootloader", "direction": "board_to_host", "handled_by": "both", "tools": null}, "2042": {"name": "BOOTLOADER_VERSION_RESPONSE", "group": "bootloader", "direction": "board_to_host", "handled_by": "bootloader", "tools": null}, "2043": {"name": "QUERY_ERROR_COUNTERS", "group": "bootloader", "direction": "host_to_board", "handled_by": "both", "tools": null, "gates": {"blocked_by_critical_error": false}}, "2044": {"name": "ERROR_COUNTERS_RESPONSE", "group": "bootloader", "direction": "board_to_host", "handled_by": "both", "tools": null}, "2045": {"name": "AUTHORIZE_DOWNGRADE", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null, "gates": {"needs_magic": "authorize_downgrade"}}, "2046": {"name": "READBACK", "group": "bootloader", "direction": "both", "handled_by": "bootloader", "tools": null}, "2047": {"name": "READBACK_PAGE_ACK", "group": "bootloader", "direction": "host_to_board", "handled_by": "bootloader", "tools": null}};

// --- one record per layout (the data the encoder and the decoder run on) ---
export const LAYOUTS: Record<string, Layout> = {"impact_event": {"id": 149, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "event", "type": "u8", "offset": 0, "width": 1}]}, "global_status": {"id": 256, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "status_r", "type": "u8", "offset": 0, "width": 1}, {"name": "status_g", "type": "u8", "offset": 1, "width": 1}, {"name": "status_b", "type": "u8", "offset": 2, "width": 1}, {"name": "display_mode", "type": "u8", "offset": 3, "width": 1, "allowed": [0, 1, 15]}, {"name": "ring_r", "type": "u8", "offset": 4, "width": 1}, {"name": "ring_g", "type": "u8", "offset": 5, "width": 1}, {"name": "ring_b", "type": "u8", "offset": 6, "width": 1}, {"name": "ring_on", "type": "u8", "offset": 7, "width": 1, "range": [0, 1]}]}, "query_active_tool": {"id": 272, "role": "request", "dlc": {"any": true}, "fields": []}, "active_tool_resp": {"id": 273, "role": "response", "dlc": {"min": 4, "max": 6}, "fields": [{"name": "tool_id", "type": "u8", "offset": 0, "width": 1}, {"name": "system_error", "type": "u8", "offset": 1, "width": 1, "range": [0, 1]}, {"name": "can_error", "type": "u8", "offset": 2, "width": 1, "range": [0, 1]}, {"name": "booting", "type": "u8", "offset": 3, "width": 1, "range": [0, 1]}, {"name": "thermal_fault", "type": "u8", "offset": 4, "width": 1, "optional": true}, {"name": "reset_cause", "type": "u8", "offset": 5, "width": 1, "optional": true}]}, "motion_cmd": {"id": 288, "role": "request", "dlc": {"min": 5, "max": 8}, "fields": [{"name": "direction", "type": "u8", "offset": 0, "width": 1, "allowed": [1, 0]}, {"name": "steps", "type": "u32", "offset": 1, "width": 4}, {"name": "speed", "type": "u16", "offset": 5, "width": 2, "optional": true, "present_from_dlc": 8}, {"name": "profile", "type": "u8", "offset": 7, "width": 1, "optional": true, "present_from_dlc": 8}]}, "solder_setpoint": {"id": 304, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "setpoint_c", "type": "u16", "offset": 0, "width": 2, "range": [0, 445]}]}, "solder_feeder_reset": {"id": 305, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "52535030", "length": 4}]}, "solder_feeder_pos_request": {"id": 306, "role": "request", "dlc": {"any": true}, "fields": []}, "solder_feeder_pos_response": {"id": 306, "role": "response", "dlc": {"exact": 4}, "fields": [{"name": "position", "type": "i32", "offset": 0, "width": 4}]}, "solder_telemetry": {"id": 309, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "temperature_c", "type": "u16", "offset": 0, "width": 2}]}, "drill_cmd": {"id": 320, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "speed", "type": "u8", "offset": 0, "width": 1}, {"name": "direction", "type": "u8", "offset": 1, "width": 1, "allowed": [1, 0]}]}, "vacuum_telemetry": {"id": 325, "role": "response", "dlc": {"exact": 3}, "fields": [{"name": "adc", "type": "u16", "offset": 0, "width": 2, "range": [0, 4095]}, {"name": "detected", "type": "u8", "offset": 2, "width": 1, "range": [0, 1]}]}, "drill_telemetry": {"id": 327, "role": "response", "dlc": {"exact": 3}, "fields": [{"name": "rpm", "type": "u16", "offset": 0, "width": 2}, {"name": "endstop", "type": "u8", "offset": 2, "width": 1, "range": [0, 1]}]}, "aoi_cmd": {"id": 336, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "mode", "type": "u8", "offset": 0, "width": 1, "allowed": [0, 1, 2]}, {"name": "strobe_period_ms", "type": "u16", "offset": 1, "width": 2, "range": [1, 500]}]}, "aoi_telemetry": {"id": 341, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "endstop", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}]}, "laser_cmd": {"id": 352, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "power", "type": "u8", "offset": 0, "width": 1}, {"name": "interlock", "type": "u8", "offset": 1, "width": 1, "range": [0, 1]}]}, "laser_telemetry": {"id": 357, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "endstop", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}]}, "printer_thermal_motion": {"id": 368, "role": "request", "dlc": {"exact": 6}, "fields": [{"name": "nozzle_setpoint_c", "type": "u16", "offset": 0, "width": 2, "range": [0, 300]}, {"name": "extruder_direction", "type": "u8", "offset": 2, "width": 1, "allowed": [1, 0]}, {"name": "extruder_steps", "type": "u24", "offset": 3, "width": 3}]}, "printer_layerfan_cmd": {"id": 371, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "power", "type": "u8", "offset": 0, "width": 1}]}, "printer_hotend_telemetry": {"id": 373, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "temperature_c", "type": "u16", "offset": 0, "width": 2}]}, "printer_layerfan_rpm": {"id": 375, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "rpm", "type": "u16", "offset": 0, "width": 2}]}, "printer_hotendfan_cmd": {"id": 376, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "power", "type": "u8", "offset": 0, "width": 1}]}, "printer_hotendfan_rpm": {"id": 377, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "rpm", "type": "u16", "offset": 0, "width": 2}]}, "expansion_spi_req": {"id": 384, "role": "request", "dlc": {"min": 2, "max": 8}, "fields": [{"name": "count", "type": "u8", "offset": 0, "width": 1, "range": [1, 7]}, {"name": "data", "type": "bytes", "offset": 1, "rest": true, "length_field": "count"}]}, "expansion_spi_resp": {"id": 385, "role": "response", "dlc": {"min": 2, "max": 8}, "fields": [{"name": "count", "type": "u8", "offset": 0, "width": 1, "range": [1, 7]}, {"name": "data", "type": "bytes", "offset": 1, "rest": true, "length_field": "count"}]}, "expansion_diag0_req": {"id": 386, "role": "request", "dlc": {"any": true}, "fields": []}, "expansion_diag0_resp": {"id": 387, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "level", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}]}, "fram_query": {"id": 400, "role": "request", "dlc": {"any": true}, "fields": []}, "fram_state_resp": {"id": 401, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "valid", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}, {"name": "tool_id", "type": "u8", "offset": 1, "width": 1}, {"name": "had_error", "type": "u8", "offset": 2, "width": 1, "range": [0, 1]}, {"name": "setpoint_c", "type": "u16", "offset": 3, "width": 2}, {"name": "speed", "type": "u8", "offset": 5, "width": 1}, {"name": "dir_or_interlock", "type": "u8", "offset": 6, "width": 1, "range": [0, 1]}, {"name": "fan", "type": "u8", "offset": 7, "width": 1}]}, "erase_fram": {"id": 402, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "E3A5E0FF", "length": 4}]}, "set_expansion_type": {"id": 416, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "board_type", "type": "u8", "offset": 0, "width": 1, "allowed": [0, 1, 2, 3, 4, 5, 6]}]}, "expansion_type_resp_request": {"id": 417, "role": "request", "dlc": {"any": true}, "fields": []}, "expansion_type_resp_response": {"id": 417, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "board_type", "type": "u8", "offset": 0, "width": 1}]}, "set_free_tool": {"id": 418, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "selection", "type": "u8", "offset": 0, "width": 1, "range": [0, 25]}]}, "free_tool_config_resp_request": {"id": 419, "role": "request", "dlc": {"any": true}, "fields": []}, "free_tool_config_resp_response": {"id": 419, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "jumper_reading", "type": "u8", "offset": 0, "width": 1, "range": [0, 31]}, {"name": "selection", "type": "u8", "offset": 1, "width": 1, "range": [0, 25]}]}, "set_device_serial": {"id": 420, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "serial", "type": "u8", "offset": 0, "width": 1}]}, "peripheral_info_resp_request": {"id": 421, "role": "request", "dlc": {"any": true}, "fields": []}, "peripheral_info_resp_response": {"id": 421, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "peripheral_type", "type": "u8", "offset": 0, "width": 1}, {"name": "serial", "type": "u8", "offset": 1, "width": 1}]}, "set_mlx_variant": {"id": 422, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "variant", "type": "u8", "offset": 0, "width": 1, "allowed": [0, 1, 2, 3]}]}, "mlx_variant_resp_request": {"id": 423, "role": "request", "dlc": {"any": true}, "fields": []}, "mlx_variant_resp_response": {"id": 423, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "variant", "type": "u8", "offset": 0, "width": 1}]}, "blackbox_query": {"id": 424, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "chunk_index", "type": "u8", "offset": 0, "width": 1, "range": [0, 21]}]}, "blackbox_chunk": {"id": 425, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "length": 8}]}, "thermal_stats_query": {"id": 426, "role": "request", "dlc": {"any": true}, "fields": []}, "thermal_stats_resp": {"id": 427, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "fault_count", "type": "u16", "offset": 0, "width": 2}, {"name": "heater_on_seconds", "type": "u32", "offset": 2, "width": 4}, {"name": "last_fault", "type": "u8", "offset": 6, "width": 1}, {"name": "persisted", "type": "u8", "offset": 7, "width": 1, "range": [0, 1]}]}, "set_multinode": {"id": 428, "role": "request", "dlc": {"exact": 6}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "4D4E4F44", "length": 4}, {"name": "enable", "type": "u8", "offset": 4, "width": 1, "range": [0, 1]}, {"name": "instance", "type": "u8", "offset": 5, "width": 1}]}, "multinode_config_resp_request": {"id": 429, "role": "request", "dlc": {"any": true}, "fields": []}, "multinode_config_resp_response": {"id": 429, "role": "response", "dlc": {"exact": 4}, "fields": [{"name": "stored", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}, {"name": "running", "type": "u8", "offset": 1, "width": 1, "range": [0, 1]}, {"name": "instance", "type": "u8", "offset": 2, "width": 1}, {"name": "address", "type": "u8", "offset": 3, "width": 1, "range": [0, 31]}]}, "set_features": {"id": 430, "role": "request", "dlc": {"exact": 5}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "46454154", "length": 4}, {"name": "features", "type": "u8", "offset": 4, "width": 1, "range": [0, 15]}]}, "features_resp_request": {"id": 431, "role": "request", "dlc": {"any": true}, "fields": []}, "features_resp_response": {"id": 431, "role": "response", "dlc": {"exact": 3}, "fields": [{"name": "stored", "type": "u8", "offset": 0, "width": 1, "range": [0, 15]}, {"name": "running", "type": "u8", "offset": 1, "width": 1, "range": [0, 15]}, {"name": "supported", "type": "u8", "offset": 2, "width": 1, "range": [0, 15]}]}, "electromagnet_cmd": {"id": 432, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "coil", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}]}, "health_profile": {"id": 440, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "tec", "type": "u8", "offset": 0, "width": 1}, {"name": "rec", "type": "u8", "offset": 1, "width": 1}, {"name": "bus_off_count", "type": "u8", "offset": 2, "width": 1}, {"name": "hsi_trim", "type": "u8", "offset": 3, "width": 1}, {"name": "loop_max_ms", "type": "u8", "offset": 4, "width": 1}, {"name": "mcu_temp_plus_40", "type": "u8", "offset": 5, "width": 1}, {"name": "vdda_mv", "type": "u16", "offset": 6, "width": 2}]}, "pid_config": {"id": 441, "role": "request", "dlc": {"exact": 7}, "fields": [{"name": "kp_x100", "type": "u16", "offset": 0, "width": 2}, {"name": "ki_x100", "type": "u16", "offset": 2, "width": 2}, {"name": "kd_x100", "type": "u16", "offset": 4, "width": 2}, {"name": "action", "type": "u8", "offset": 6, "width": 1, "allowed": [0, 1, 2, 3]}]}, "pid_state_resp_request": {"id": 442, "role": "request", "dlc": {"any": true}, "fields": []}, "pid_state_resp_response": {"id": 442, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "kp_x100", "type": "u16", "offset": 0, "width": 2}, {"name": "ki_x100", "type": "u16", "offset": 2, "width": 2}, {"name": "kd_x100", "type": "u16", "offset": 4, "width": 2}, {"name": "state", "type": "u8", "offset": 6, "width": 1}, {"name": "duty_percent", "type": "u8", "offset": 7, "width": 1, "range": [0, 100]}]}, "spot_weld_cmd": {"id": 448, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "fire", "type": "u8", "offset": 0, "width": 1, "range": [1, 1]}, {"name": "duration_ms", "type": "u16", "offset": 1, "width": 2, "range": [1, 2000]}]}, "uv_curing_cmd": {"id": 464, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "duty", "type": "u8", "offset": 0, "width": 1}]}, "hotair_cmd": {"id": 480, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "setpoint_c", "type": "u16", "offset": 0, "width": 2, "range": [0, 445]}, {"name": "blower_duty", "type": "u8", "offset": 2, "width": 1}]}, "crimping_cmd": {"id": 496, "role": "request", "dlc": {"exact": 5}, "fields": [{"name": "direction", "type": "u8", "offset": 0, "width": 1, "allowed": [1, 0]}, {"name": "steps", "type": "u32", "offset": 1, "width": 4}]}, "ultrasonic_weld_cmd": {"id": 512, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "fire", "type": "u8", "offset": 0, "width": 1, "range": [1, 1]}, {"name": "duration_ms", "type": "u16", "offset": 1, "width": 2, "range": [1, 2000]}]}, "slave_enter_bootloader": {"id": 528, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "B0071D5A", "length": 4}]}, "slave_start_update": {"id": 529, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "total_size", "type": "u32", "offset": 0, "width": 4}, {"name": "hardware_id", "type": "u32", "offset": 4, "width": 4}]}, "slave_hmac_chunk": {"id": 530, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "hmac_part", "type": "bytes", "offset": 0, "length": 8}]}, "slave_data": {"id": 531, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "rest": true}]}, "slave_end_update": {"id": 532, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "crc32", "type": "u32", "offset": 0, "width": 4}, {"name": "version_major", "type": "u16", "offset": 4, "width": 2}, {"name": "version_minor_field", "type": "u16", "offset": 6, "width": 2}]}, "slave_status_request": {"id": 533, "role": "request", "dlc": {"any": true}, "fields": []}, "slave_status_response": {"id": 533, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "status", "type": "u8", "offset": 0, "width": 1}]}, "slave_progress_request": {"id": 534, "role": "request", "dlc": {"any": true}, "fields": []}, "slave_progress_response": {"id": 534, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "progress", "type": "u8", "offset": 0, "width": 1}]}, "slave_version_resp_1_request": {"id": 535, "role": "request", "dlc": {"any": true}, "fields": []}, "slave_version_resp_1_response": {"id": 535, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "responder", "type": "u8", "offset": 0, "width": 1}, {"name": "hardware_id", "type": "u32", "offset": 1, "width": 4}, {"name": "version_major", "type": "u16", "offset": 5, "width": 2}, {"name": "version_minor_high", "type": "u8", "offset": 7, "width": 1}]}, "slave_version_resp_2": {"id": 536, "role": "response", "dlc": {"one_of": [2, 5]}, "fields": [{"name": "version_minor_low", "type": "u8", "offset": 0, "width": 1}, {"name": "bootloader_major", "type": "u8", "offset": 1, "width": 1}, {"name": "app_patch", "type": "u8", "offset": 2, "width": 1, "optional": true, "present_from_dlc": 5}, {"name": "bootloader_minor", "type": "u8", "offset": 3, "width": 1, "optional": true, "present_from_dlc": 5}, {"name": "bootloader_patch", "type": "u8", "offset": 4, "width": 1, "optional": true, "present_from_dlc": 5}]}, "slave_verify_fail_reason_request": {"id": 537, "role": "request", "dlc": {"any": true}, "fields": []}, "slave_verify_fail_reason_response": {"id": 537, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "reason", "type": "u8", "offset": 0, "width": 1}]}, "slave_reg_write": {"id": 544, "role": "request", "dlc": {"min": 2, "max": 8}, "fields": [{"name": "register", "type": "u8", "offset": 0, "width": 1}, {"name": "payload", "type": "bytes", "offset": 1, "rest": true}]}, "slave_reg_read_request": {"id": 545, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "register", "type": "u8", "offset": 0, "width": 1}, {"name": "length", "type": "u8", "offset": 1, "width": 1, "range": [1, 8]}]}, "slave_reg_read_response": {"id": 545, "role": "response", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "rest": true}]}, "paste_jetting_config": {"id": 560, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "channel", "type": "u8", "offset": 0, "width": 1, "range": [0, 3]}, {"name": "frequency_hz", "type": "u16", "offset": 1, "width": 2, "range": [1, 65535]}]}, "paste_jetting_pulse": {"id": 561, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "channel", "type": "u8", "offset": 0, "width": 1, "range": [0, 3]}, {"name": "duty_percent", "type": "u8", "offset": 1, "width": 1, "range": [0, 100]}, {"name": "duration_ms", "type": "u8", "offset": 2, "width": 1, "range": [1, 255]}]}, "ads1115_config": {"id": 576, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "config", "type": "u16", "offset": 0, "width": 2}]}, "ads1115_trigger": {"id": 577, "role": "request", "dlc": {"any": true}, "fields": []}, "ads1115_result_request": {"id": 578, "role": "request", "dlc": {"any": true}, "fields": []}, "ads1115_result_response": {"id": 578, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "raw", "type": "i16", "offset": 0, "width": 2}]}, "flying_probe_basic": {"id": 579, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "adc", "type": "u16", "offset": 0, "width": 2, "range": [0, 4095]}]}, "thermal_trigger": {"id": 592, "role": "request", "dlc": {"any": true}, "fields": []}, "thermal_status_request": {"id": 593, "role": "request", "dlc": {"any": true}, "fields": []}, "thermal_status_response": {"id": 593, "role": "response", "dlc": {"exact": 1}, "fields": [{"name": "status", "type": "u8", "offset": 0, "width": 1}]}, "thermal_raw_chunk_req": {"id": 594, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "chunk", "type": "u8", "offset": 0, "width": 1, "range": [0, 47]}]}, "thermal_raw_chunk": {"id": 595, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "length": 8}]}, "thermal_cal_chunk_req": {"id": 596, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "chunk", "type": "u8", "offset": 0, "width": 1, "range": [0, 47]}]}, "thermal_cal_chunk": {"id": 597, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "length": 8}]}, "version_patch_response": {"id": 2025, "role": "response", "dlc": {"min": 3, "max": 8}, "fields": [{"name": "responder", "type": "u8", "offset": 0, "width": 1}, {"name": "patch", "type": "u8", "offset": 1, "width": 1}, {"name": "flags", "type": "u8", "offset": 2, "width": 1}]}, "enter_bootloader": {"id": 2032, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "B0071D5A", "length": 4}]}, "start_update": {"id": 2033, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "total_size", "type": "u32", "offset": 0, "width": 4}, {"name": "hardware_id", "type": "u32", "offset": 4, "width": 4}]}, "data": {"id": 2034, "role": "request", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "rest": true}]}, "page_ack": {"id": 2035, "role": "response", "dlc": {"exact": 4}, "fields": [{"name": "page_index", "type": "u32", "offset": 0, "width": 4}]}, "end_update": {"id": 2036, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "crc32", "type": "u32", "offset": 0, "width": 4}, {"name": "version_major", "type": "u16", "offset": 4, "width": 2}, {"name": "version_minor_field", "type": "u16", "offset": 6, "width": 2}]}, "status": {"id": 2037, "role": "response", "dlc": {"min": 1, "max": 2}, "fields": [{"name": "status", "type": "u8", "offset": 0, "width": 1}, {"name": "reason", "type": "u8", "offset": 1, "width": 1, "optional": true}]}, "heartbeat": {"id": 2038, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "status", "type": "u8", "offset": 0, "width": 1}, {"name": "progress", "type": "u8", "offset": 1, "width": 1}]}, "hmac_chunk": {"id": 2039, "role": "request", "dlc": {"exact": 8}, "fields": [{"name": "hmac_part", "type": "bytes", "offset": 0, "length": 8}]}, "query_version": {"id": 2040, "role": "request", "dlc": {"any": true}, "fields": []}, "version_response": {"id": 2041, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "responder", "type": "u8", "offset": 0, "width": 1}, {"name": "hardware_id", "type": "u32", "offset": 1, "width": 4}, {"name": "version_major", "type": "u16", "offset": 5, "width": 2}, {"name": "version_minor", "type": "u8", "offset": 7, "width": 1}]}, "bootloader_version_response": {"id": 2042, "role": "response", "dlc": {"exact": 3}, "fields": [{"name": "major", "type": "u8", "offset": 0, "width": 1}, {"name": "minor", "type": "u8", "offset": 1, "width": 1}, {"name": "patch", "type": "u8", "offset": 2, "width": 1}]}, "query_error_counters": {"id": 2043, "role": "request", "dlc": {"any": true}, "fields": []}, "error_counters_response": {"id": 2044, "role": "response", "dlc": {"exact": 2}, "fields": [{"name": "tec", "type": "u8", "offset": 0, "width": 1}, {"name": "rec", "type": "u8", "offset": 1, "width": 1}]}, "authorize_downgrade": {"id": 2045, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "magic", "type": "bytes", "offset": 0, "fixed": "D09E12AD", "length": 4}]}, "readback_request": {"id": 2046, "role": "request", "dlc": {"any": true}, "fields": []}, "readback_response_size": {"id": 2046, "role": "response", "dlc": {"exact": 4}, "fields": [{"name": "total_size", "type": "u32", "offset": 0, "width": 4}]}, "readback_response_data": {"id": 2046, "role": "response", "dlc": {"min": 1, "max": 8}, "fields": [{"name": "data", "type": "bytes", "offset": 0, "rest": true}]}, "readback_page_ack": {"id": 2047, "role": "request", "dlc": {"exact": 4}, "fields": [{"name": "page_index", "type": "u32", "offset": 0, "width": 4}]}, "mn_discover": {"id": 1024, "role": "request", "dlc": {"exact": 2}, "fields": [{"name": "mn_version", "type": "u8", "offset": 0, "width": 1}, {"name": "slot_ms", "type": "u8", "offset": 1, "width": 1, "range": [1, 50]}]}, "mn_select": {"id": 1025, "role": "request", "dlc": {"exact": 3}, "fields": [{"name": "action", "type": "u8", "offset": 0, "width": 1, "range": [0, 1]}, {"name": "node", "type": "u8", "offset": 1, "width": 1, "range": [0, 31]}, {"name": "seq", "type": "u8", "offset": 2, "width": 1}]}, "mn_safe_stop": {"id": 1026, "role": "request", "dlc": {"exact": 1}, "fields": [{"name": "reason", "type": "u8", "offset": 0, "width": 1}]}, "mn_node_info": {"id": 1056, "role": "response", "dlc": {"exact": 8}, "fields": [{"name": "tool", "type": "u8", "offset": 0, "width": 1}, {"name": "state", "type": "u8", "offset": 1, "width": 1}, {"name": "instance", "type": "u8", "offset": 2, "width": 1}, {"name": "mn_version", "type": "u8", "offset": 3, "width": 1}, {"name": "serial", "type": "u32", "offset": 4, "width": 4}]}, "mn_node_status": {"id": 1088, "role": "response", "dlc": {"exact": 4}, "fields": [{"name": "state", "type": "u8", "offset": 0, "width": 1}, {"name": "error", "type": "u8", "offset": 1, "width": 1}, {"name": "uptime_s", "type": "u16", "offset": 2, "width": 2}]}, "mn_node_cmd": {"id": 1120, "role": "request", "dlc": {"min": 2, "max": 8}, "fields": [{"name": "func", "type": "u16", "offset": 0, "width": 2}, {"name": "args", "type": "bytes", "offset": 2, "rest": true}]}, "mn_node_resp": {"id": 1152, "role": "response", "dlc": {"min": 2, "max": 8}, "fields": [{"name": "func", "type": "u16", "offset": 0, "width": 2}, {"name": "data", "type": "bytes", "offset": 2, "rest": true}]}};

// ---------------------------------------------------------------------------
// pure encoders and decoders (the runtime below is the same in every generated copy)
// ---------------------------------------------------------------------------
export interface LayoutField {
  name: string;
  type: string;
  offset: number;
  width?: number;
  range?: [number, number];
  optional?: boolean;
  present_from_dlc?: number;
  fixed?: string;
  length?: number;
  rest?: boolean;
  length_field?: string;
  allowed?: number[];
}
export interface Layout {
  id: number;
  role: string;
  dlc: { exact?: number; min?: number; max?: number; one_of?: number[]; any?: boolean };
  fields: LayoutField[];
}
export type FieldValue = number | number[] | null;
export type Fields = Record<string, FieldValue>;

const INT_LIMITS: Record<string, [number, number]> = {
  u8: [0, 0xff], u16: [0, 0xffff], u24: [0, 0xffffff], u32: [0, 0xffffffff],
  i16: [-0x8000, 0x7fff], i32: [-0x80000000, 0x7fffffff],
};
const WIDTHS: Record<string, number> = { u8: 1, u16: 2, u24: 3, u32: 4, i16: 2, i32: 4 };

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return out;
}

export function dlcAllows(rule: Layout['dlc'], length: number): boolean {
  if (rule.exact !== undefined) return length === rule.exact;
  if (rule.one_of !== undefined) return rule.one_of.includes(length);
  if (rule.min !== undefined && rule.max !== undefined) return length >= rule.min && length <= rule.max;
  return length >= 0 && length <= DLC_MAX;
}

function dlcFloor(rule: Layout['dlc']): number {
  if (rule.exact !== undefined) return rule.exact;
  if (rule.one_of !== undefined) return Math.min(...rule.one_of);
  return rule.min ?? 0;
}

function checkInt(field: LayoutField, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new TypeError(`${field.name} must be an integer`);
  const [low, high] = INT_LIMITS[field.type];
  if (value < low || value > high) throw new RangeError(`${field.name} ${value} does not fit ${field.type}`);
  if (field.range && (value < field.range[0] || value > field.range[1])) throw new RangeError(`${field.name} ${value} is outside ${field.range[0]}..${field.range[1]}`);
  if (field.allowed && !field.allowed.includes(value)) throw new RangeError(`${field.name} ${value} is not one of the defined values`);
  return value;
}

function checkBytes(name: string, value: unknown): number[] {
  if (!Array.isArray(value) && !(value instanceof Uint8Array)) throw new TypeError(`${name} must be a byte array`);
  const bytes = Array.from(value as ArrayLike<number>);
  if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) throw new RangeError(`${name} holds a value that is not a byte`);
  return bytes;
}

/** Build the frame for a layout. Throws on anything out of range instead of clamping it. */
export function encode(layout: string, values: Record<string, unknown> = {}): { id: number; data: number[] } {
  const spec = LAYOUTS[layout];
  const names = new Set(spec.fields.map((f) => f.name));
  for (const key of Object.keys(values)) if (!names.has(key)) throw new TypeError(`unknown field ${key} for ${layout}`);
  const derived = new Map<string, string>();
  for (const f of spec.fields) if (f.length_field) derived.set(f.length_field, f.name);
  const byteValues = new Map<string, number[]>();
  for (const f of spec.fields) {
    if (f.type !== 'bytes') continue;
    let raw: number[] | null = null;
    if (values[f.name] !== undefined && values[f.name] !== null) raw = checkBytes(f.name, values[f.name]);
    else if (f.fixed !== undefined) raw = hexToBytes(f.fixed);
    else if (!f.optional) throw new TypeError(`missing field ${f.name}`);
    if (raw !== null) {
      if (f.fixed !== undefined && raw.join(',') !== hexToBytes(f.fixed).join(',')) throw new RangeError(`${f.name} must be ${f.fixed}`);
      if (f.length !== undefined && raw.length !== f.length) throw new RangeError(`${f.name} must be ${f.length} bytes`);
      byteValues.set(f.name, raw);
    }
  }
  const out: number[] = [];
  let skipped = false;
  for (const f of spec.fields) {
    if (f.type === 'bytes') {
      const raw = byteValues.get(f.name);
      if (raw === undefined) { skipped = true; continue; }
      if (skipped) throw new RangeError(`${f.name} follows an omitted optional field`);
      out.push(...raw);
      continue;
    }
    let value: unknown;
    const source = derived.get(f.name);
    if (source !== undefined) {
      value = byteValues.get(source)!.length;
      if (values[f.name] !== undefined && values[f.name] !== value) throw new RangeError(`${f.name} must equal the length of ${source}`);
    } else if (values[f.name] !== undefined && values[f.name] !== null) value = values[f.name];
    else if (f.optional) { skipped = true; continue; }
    else throw new TypeError(`missing field ${f.name}`);
    if (skipped) throw new RangeError(`${f.name} follows an omitted optional field`);
    const n = checkInt(f, value);
    const width = WIDTHS[f.type];
    const unsigned = n < 0 ? n + 2 ** (8 * width) : n;
    for (let i = width - 1; i >= 0; i--) out.push(Math.floor(unsigned / 2 ** (8 * i)) % 256);
  }
  if (!dlcAllows(spec.dlc, out.length)) throw new RangeError(`${layout}: a payload of ${out.length} bytes does not satisfy the length rule`);
  return { id: spec.id, data: out };
}

/** Read a payload; null when it is too short (or, with strict, does not satisfy the length rule). Missing optional fields are null. */
export function decode(layout: string, data: ArrayLike<number>, strict = false): Fields | null {
  const spec = LAYOUTS[layout];
  const bytes = Array.from(data);
  const length = bytes.length;
  if (strict && !dlcAllows(spec.dlc, length)) return null;
  if (length < dlcFloor(spec.dlc)) return null;
  const result: Fields = {};
  for (const f of spec.fields) {
    const offset = f.offset;
    if (f.type === 'bytes') {
      if (f.length_field) {
        const size = result[f.length_field] as number;
        if (length - offset < size) return null;
        result[f.name] = bytes.slice(offset, offset + size);
      } else if (f.length !== undefined) {
        if (length < offset + f.length) {
          if (f.optional) { result[f.name] = null; continue; }
          return null;
        }
        result[f.name] = bytes.slice(offset, offset + f.length);
      } else result[f.name] = bytes.slice(offset);
      continue;
    }
    const width = WIDTHS[f.type];
    const needed = f.present_from_dlc ?? offset + width;
    if (length < needed || length < offset + width) {
      if (f.optional) { result[f.name] = null; continue; }
      return null;
    }
    let value = 0;
    for (let i = 0; i < width; i++) value = value * 256 + bytes[offset + i];
    if (f.type.startsWith('i') && value >= 2 ** (8 * width - 1)) value -= 2 ** (8 * width);
    result[f.name] = value;
  }
  return result;
}

/** The 16-bit minor field of the end-of-update frame: legacy, or 0x80 | patch in the high byte. */
export function minorFieldPack(minor: number, patch: number | null = null): number {
  if (patch === null || patch === PATCH_UNKNOWN || patch < 0 || patch > PATCH_MAX) return minor;
  return ((PATCH_FLAG | patch) << 8) | (minor & 0xff);
}
export function minorFieldMinor(field: number): number {
  return field & 0xff;
}
/** The patch carried by a minor field, or null for a legacy field. */
export function minorFieldPatch(field: number): number | null {
  const high = (field >> 8) & 0xff;
  return high & PATCH_FLAG ? high & PATCH_MAX : null;
}
/** 1 when the candidate is newer, 0 when equal, -1 when older; the patch decides only when both carry one. */
export function versionCompare(installed: [number, number, number | null], candidate: [number, number, number | null]): number {
  for (let i = 0; i < 2; i++) {
    const have = installed[i] as number;
    const want = candidate[i] as number;
    if (want !== have) return want > have ? 1 : -1;
  }
  const havePatch = installed[2];
  const wantPatch = candidate[2];
  if (havePatch === null || wantPatch === null) return 0;
  if (wantPatch !== havePatch) return wantPatch > havePatch ? 1 : -1;
  return 0;
}

// ---------------------------------------------------------------------------
// one builder and one parser per layout
// ---------------------------------------------------------------------------
/** Impact register (touch probe, maximum priority) (0x095, response). */
export function encodeImpactEvent(event: number): { id: number; data: number[] } {
  return encode('impact_event', { event: event });
}
/** Fields of 0x095, or null when the payload is too short. */
export function decodeImpactEvent(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('impact_event', data, strict);
}

/** Status LED, ring LED and OLED mode (0x100, request). */
export function encodeGlobalStatus(statusR: number, statusG: number, statusB: number, displayMode: number, ringR: number, ringG: number, ringB: number, ringOn: number): { id: number; data: number[] } {
  return encode('global_status', { status_r: statusR, status_g: statusG, status_b: statusB, display_mode: displayMode, ring_r: ringR, ring_g: ringG, ring_b: ringB, ring_on: ringOn });
}
/** Fields of 0x100, or null when the payload is too short. */
export function decodeGlobalStatus(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('global_status', data, strict);
}

/** Query the active tool and the quick state (0x110, request). */
export function encodeQueryActiveTool(): { id: number; data: number[] } {
  return encode('query_active_tool');
}
/** Fields of 0x110, or null when the payload is too short. */
export function decodeQueryActiveTool(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('query_active_tool', data, strict);
}

/** Active tool and quick state (0x111, response). */
export function encodeActiveToolResp(toolId: number, systemError: number, canError: number, booting: number, thermalFault?: number, resetCause?: number): { id: number; data: number[] } {
  return encode('active_tool_resp', { tool_id: toolId, system_error: systemError, can_error: canError, booting: booting, thermal_fault: thermalFault, reset_cause: resetCause });
}
/** Fields of 0x111, or null when the payload is too short. */
export function decodeActiveToolResp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('active_tool_resp', data, strict);
}

/** Plain stepper move (direction and step count) (0x120, request). */
export function encodeMotionCmd(direction: number, steps: number, speed?: number, profile?: number): { id: number; data: number[] } {
  return encode('motion_cmd', { direction: direction, steps: steps, speed: speed, profile: profile });
}
/** Fields of 0x120, or null when the payload is too short. */
export function decodeMotionCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('motion_cmd', data, strict);
}

/** T12 setpoint temperature (0x130, request). */
export function encodeSolderSetpoint(setpointC: number): { id: number; data: number[] } {
  return encode('solder_setpoint', { setpoint_c: setpointC });
}
/** Fields of 0x130, or null when the payload is too short. */
export function decodeSolderSetpoint(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('solder_setpoint', data, strict);
}

/** Reset the solder wire feeder position (0x131, request). */
export function encodeSolderFeederReset(magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('solder_feeder_reset', { magic: magic });
}
/** Fields of 0x131, or null when the payload is too short. */
export function decodeSolderFeederReset(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('solder_feeder_reset', data, strict);
}

/** Solder wire feeder position (0x132, request). */
export function encodeSolderFeederPosRequest(): { id: number; data: number[] } {
  return encode('solder_feeder_pos_request');
}
/** Fields of 0x132, or null when the payload is too short. */
export function decodeSolderFeederPosRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('solder_feeder_pos_request', data, strict);
}

/** Solder wire feeder position (0x132, response). */
export function encodeSolderFeederPosResponse(position: number): { id: number; data: number[] } {
  return encode('solder_feeder_pos_response', { position: position });
}
/** Fields of 0x132, or null when the payload is too short. */
export function decodeSolderFeederPosResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('solder_feeder_pos_response', data, strict);
}

/** T12 temperature telemetry (0x135, response). */
export function encodeSolderTelemetry(temperatureC: number): { id: number; data: number[] } {
  return encode('solder_telemetry', { temperature_c: temperatureC });
}
/** Fields of 0x135, or null when the payload is too short. */
export function decodeSolderTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('solder_telemetry', data, strict);
}

/** Drill speed and direction (0x140, request). */
export function encodeDrillCmd(speed: number, direction: number): { id: number; data: number[] } {
  return encode('drill_cmd', { speed: speed, direction: direction });
}
/** Fields of 0x140, or null when the payload is too short. */
export function decodeDrillCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('drill_cmd', data, strict);
}

/** Vacuum pickup telemetry (0x145, response). */
export function encodeVacuumTelemetry(adc: number, detected: number): { id: number; data: number[] } {
  return encode('vacuum_telemetry', { adc: adc, detected: detected });
}
/** Fields of 0x145, or null when the payload is too short. */
export function decodeVacuumTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('vacuum_telemetry', data, strict);
}

/** Drill RPM and endstop telemetry (0x147, response). */
export function encodeDrillTelemetry(rpm: number, endstop: number): { id: number; data: number[] } {
  return encode('drill_telemetry', { rpm: rpm, endstop: endstop });
}
/** Fields of 0x147, or null when the payload is too short. */
export function decodeDrillTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('drill_telemetry', data, strict);
}

/** AOI ring light mode and strobe period (0x150, request). */
export function encodeAoiCmd(mode: number, strobePeriodMs: number): { id: number; data: number[] } {
  return encode('aoi_cmd', { mode: mode, strobe_period_ms: strobePeriodMs });
}
/** Fields of 0x150, or null when the payload is too short. */
export function decodeAoiCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('aoi_cmd', data, strict);
}

/** AOI endstop telemetry (0x155, response). */
export function encodeAoiTelemetry(endstop: number): { id: number; data: number[] } {
  return encode('aoi_telemetry', { endstop: endstop });
}
/** Fields of 0x155, or null when the payload is too short. */
export function decodeAoiTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('aoi_telemetry', data, strict);
}

/** Laser power and interlock (0x160, request). */
export function encodeLaserCmd(power: number, interlock: number): { id: number; data: number[] } {
  return encode('laser_cmd', { power: power, interlock: interlock });
}
/** Fields of 0x160, or null when the payload is too short. */
export function decodeLaserCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('laser_cmd', data, strict);
}

/** Laser endstop telemetry (0x165, response). */
export function encodeLaserTelemetry(endstop: number): { id: number; data: number[] } {
  return encode('laser_telemetry', { endstop: endstop });
}
/** Fields of 0x165, or null when the payload is too short. */
export function decodeLaserTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('laser_telemetry', data, strict);
}

/** Nozzle setpoint and extruder motion (0x170, request). */
export function encodePrinterThermalMotion(nozzleSetpointC: number, extruderDirection: number, extruderSteps: number): { id: number; data: number[] } {
  return encode('printer_thermal_motion', { nozzle_setpoint_c: nozzleSetpointC, extruder_direction: extruderDirection, extruder_steps: extruderSteps });
}
/** Fields of 0x170, or null when the payload is too short. */
export function decodePrinterThermalMotion(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_thermal_motion', data, strict);
}

/** Layer fan power (0x173, request). */
export function encodePrinterLayerfanCmd(power: number): { id: number; data: number[] } {
  return encode('printer_layerfan_cmd', { power: power });
}
/** Fields of 0x173, or null when the payload is too short. */
export function decodePrinterLayerfanCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_layerfan_cmd', data, strict);
}

/** Hotend temperature telemetry (0x175, response). */
export function encodePrinterHotendTelemetry(temperatureC: number): { id: number; data: number[] } {
  return encode('printer_hotend_telemetry', { temperature_c: temperatureC });
}
/** Fields of 0x175, or null when the payload is too short. */
export function decodePrinterHotendTelemetry(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_hotend_telemetry', data, strict);
}

/** Layer fan RPM telemetry (0x177, response). */
export function encodePrinterLayerfanRpm(rpm: number): { id: number; data: number[] } {
  return encode('printer_layerfan_rpm', { rpm: rpm });
}
/** Fields of 0x177, or null when the payload is too short. */
export function decodePrinterLayerfanRpm(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_layerfan_rpm', data, strict);
}

/** Hotend fan power (0x178, request). */
export function encodePrinterHotendfanCmd(power: number): { id: number; data: number[] } {
  return encode('printer_hotendfan_cmd', { power: power });
}
/** Fields of 0x178, or null when the payload is too short. */
export function decodePrinterHotendfanCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_hotendfan_cmd', data, strict);
}

/** Hotend fan RPM telemetry (0x179, response). */
export function encodePrinterHotendfanRpm(rpm: number): { id: number; data: number[] } {
  return encode('printer_hotendfan_rpm', { rpm: rpm });
}
/** Fields of 0x179, or null when the payload is too short. */
export function decodePrinterHotendfanRpm(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('printer_hotendfan_rpm', data, strict);
}

/** Expansion SPI passthrough request (0x180, request). */
export function encodeExpansionSpiReq(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('expansion_spi_req', { data: data });
}
/** Fields of 0x180, or null when the payload is too short. */
export function decodeExpansionSpiReq(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_spi_req', data, strict);
}

/** Expansion SPI passthrough response (0x181, response). */
export function encodeExpansionSpiResp(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('expansion_spi_resp', { data: data });
}
/** Fields of 0x181, or null when the payload is too short. */
export function decodeExpansionSpiResp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_spi_resp', data, strict);
}

/** Query the TMC_DIAG0 level (0x182, request). */
export function encodeExpansionDiag0Req(): { id: number; data: number[] } {
  return encode('expansion_diag0_req');
}
/** Fields of 0x182, or null when the payload is too short. */
export function decodeExpansionDiag0Req(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_diag0_req', data, strict);
}

/** TMC_DIAG0 level (0x183, response). */
export function encodeExpansionDiag0Resp(level: number): { id: number; data: number[] } {
  return encode('expansion_diag0_resp', { level: level });
}
/** Fields of 0x183, or null when the payload is too short. */
export function decodeExpansionDiag0Resp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_diag0_resp', data, strict);
}

/** Query the recovered persisted state (0x190, request). */
export function encodeFramQuery(): { id: number; data: number[] } {
  return encode('fram_query');
}
/** Fields of 0x190, or null when the payload is too short. */
export function decodeFramQuery(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('fram_query', data, strict);
}

/** Recovered persisted state (0x191, response). */
export function encodeFramStateResp(valid: number, toolId: number, hadError: number, setpointC: number, speed: number, dirOrInterlock: number, fan: number): { id: number; data: number[] } {
  return encode('fram_state_resp', { valid: valid, tool_id: toolId, had_error: hadError, setpoint_c: setpointC, speed: speed, dir_or_interlock: dirOrInterlock, fan: fan });
}
/** Fields of 0x191, or null when the payload is too short. */
export function decodeFramStateResp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('fram_state_resp', data, strict);
}

/** Erase the recovered persisted state (0x192, request). */
export function encodeEraseFram(magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('erase_fram', { magic: magic });
}
/** Fields of 0x192, or null when the payload is too short. */
export function decodeEraseFram(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('erase_fram', data, strict);
}

/** Set the expansion board type (0x1A0, request). */
export function encodeSetExpansionType(boardType: number): { id: number; data: number[] } {
  return encode('set_expansion_type', { board_type: boardType });
}
/** Fields of 0x1A0, or null when the payload is too short. */
export function decodeSetExpansionType(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_expansion_type', data, strict);
}

/** Expansion board type (query and response) (0x1A1, request). */
export function encodeExpansionTypeRespRequest(): { id: number; data: number[] } {
  return encode('expansion_type_resp_request');
}
/** Fields of 0x1A1, or null when the payload is too short. */
export function decodeExpansionTypeRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_type_resp_request', data, strict);
}

/** Expansion board type (query and response) (0x1A1, response). */
export function encodeExpansionTypeRespResponse(boardType: number): { id: number; data: number[] } {
  return encode('expansion_type_resp_response', { board_type: boardType });
}
/** Fields of 0x1A1, or null when the payload is too short. */
export function decodeExpansionTypeRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('expansion_type_resp_response', data, strict);
}

/** Set the free tool configuration (0x1A2, request). */
export function encodeSetFreeTool(selection: number): { id: number; data: number[] } {
  return encode('set_free_tool', { selection: selection });
}
/** Fields of 0x1A2, or null when the payload is too short. */
export function decodeSetFreeTool(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_free_tool', data, strict);
}

/** Raw jumper reading and free tool configuration (0x1A3, request). */
export function encodeFreeToolConfigRespRequest(): { id: number; data: number[] } {
  return encode('free_tool_config_resp_request');
}
/** Fields of 0x1A3, or null when the payload is too short. */
export function decodeFreeToolConfigRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('free_tool_config_resp_request', data, strict);
}

/** Raw jumper reading and free tool configuration (0x1A3, response). */
export function encodeFreeToolConfigRespResponse(jumperReading: number, selection: number): { id: number; data: number[] } {
  return encode('free_tool_config_resp_response', { jumper_reading: jumperReading, selection: selection });
}
/** Fields of 0x1A3, or null when the payload is too short. */
export function decodeFreeToolConfigRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('free_tool_config_resp_response', data, strict);
}

/** Set the device serial number (0x1A4, request). */
export function encodeSetDeviceSerial(serial: number): { id: number; data: number[] } {
  return encode('set_device_serial', { serial: serial });
}
/** Fields of 0x1A4, or null when the payload is too short. */
export function decodeSetDeviceSerial(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_device_serial', data, strict);
}

/** Peripheral type and device serial (0x1A5, request). */
export function encodePeripheralInfoRespRequest(): { id: number; data: number[] } {
  return encode('peripheral_info_resp_request');
}
/** Fields of 0x1A5, or null when the payload is too short. */
export function decodePeripheralInfoRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('peripheral_info_resp_request', data, strict);
}

/** Peripheral type and device serial (0x1A5, response). */
export function encodePeripheralInfoRespResponse(peripheralType: number, serial: number): { id: number; data: number[] } {
  return encode('peripheral_info_resp_response', { peripheral_type: peripheralType, serial: serial });
}
/** Fields of 0x1A5, or null when the payload is too short. */
export function decodePeripheralInfoRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('peripheral_info_resp_response', data, strict);
}

/** Set the MLX9064x sensor variant (0x1A6, request). */
export function encodeSetMlxVariant(variant: number): { id: number; data: number[] } {
  return encode('set_mlx_variant', { variant: variant });
}
/** Fields of 0x1A6, or null when the payload is too short. */
export function decodeSetMlxVariant(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_mlx_variant', data, strict);
}

/** MLX9064x sensor variant (query and response) (0x1A7, request). */
export function encodeMlxVariantRespRequest(): { id: number; data: number[] } {
  return encode('mlx_variant_resp_request');
}
/** Fields of 0x1A7, or null when the payload is too short. */
export function decodeMlxVariantRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mlx_variant_resp_request', data, strict);
}

/** MLX9064x sensor variant (query and response) (0x1A7, response). */
export function encodeMlxVariantRespResponse(variant: number): { id: number; data: number[] } {
  return encode('mlx_variant_resp_response', { variant: variant });
}
/** Fields of 0x1A7, or null when the payload is too short. */
export function decodeMlxVariantRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mlx_variant_resp_response', data, strict);
}

/** Request one chunk of the fault recorder (0x1A8, request). */
export function encodeBlackboxQuery(chunkIndex: number): { id: number; data: number[] } {
  return encode('blackbox_query', { chunk_index: chunkIndex });
}
/** Fields of 0x1A8, or null when the payload is too short. */
export function decodeBlackboxQuery(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('blackbox_query', data, strict);
}

/** One chunk of the fault recorder (0x1A9, response). */
export function encodeBlackboxChunk(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('blackbox_chunk', { data: data });
}
/** Fields of 0x1A9, or null when the payload is too short. */
export function decodeBlackboxChunk(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('blackbox_chunk', data, strict);
}

/** Query the lifetime thermal counters (0x1AA, request). */
export function encodeThermalStatsQuery(): { id: number; data: number[] } {
  return encode('thermal_stats_query');
}
/** Fields of 0x1AA, or null when the payload is too short. */
export function decodeThermalStatsQuery(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_stats_query', data, strict);
}

/** Lifetime thermal counters (0x1AB, response). */
export function encodeThermalStatsResp(faultCount: number, heaterOnSeconds: number, lastFault: number, persisted: number): { id: number; data: number[] } {
  return encode('thermal_stats_resp', { fault_count: faultCount, heater_on_seconds: heaterOnSeconds, last_fault: lastFault, persisted: persisted });
}
/** Fields of 0x1AB, or null when the payload is too short. */
export function decodeThermalStatsResp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_stats_resp', data, strict);
}

/** Switch the multinode extension on or off (persistent, acts after the next power-up) (0x1AC, request). */
export function encodeSetMultinode(enable: number, instance: number, magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('set_multinode', { magic: magic, enable: enable, instance: instance });
}
/** Fields of 0x1AC, or null when the payload is too short. */
export function decodeSetMultinode(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_multinode', data, strict);
}

/** The multinode switch: stored value, value in force, instance and node address (0x1AD, request). */
export function encodeMultinodeConfigRespRequest(): { id: number; data: number[] } {
  return encode('multinode_config_resp_request');
}
/** Fields of 0x1AD, or null when the payload is too short. */
export function decodeMultinodeConfigRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('multinode_config_resp_request', data, strict);
}

/** The multinode switch: stored value, value in force, instance and node address (0x1AD, response). */
export function encodeMultinodeConfigRespResponse(stored: number, running: number, instance: number, address: number): { id: number; data: number[] } {
  return encode('multinode_config_resp_response', { stored: stored, running: running, instance: instance, address: address });
}
/** Fields of 0x1AD, or null when the payload is too short. */
export function decodeMultinodeConfigRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('multinode_config_resp_response', data, strict);
}

/** Switch the optional firmware features on or off (persistent, acts after the next power-up) (0x1AE, request). */
export function encodeSetFeatures(features: number, magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('set_features', { magic: magic, features: features });
}
/** Fields of 0x1AE, or null when the payload is too short. */
export function decodeSetFeatures(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('set_features', data, strict);
}

/** The optional firmware features: stored mask, mask in force and supported mask (0x1AF, request). */
export function encodeFeaturesRespRequest(): { id: number; data: number[] } {
  return encode('features_resp_request');
}
/** Fields of 0x1AF, or null when the payload is too short. */
export function decodeFeaturesRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('features_resp_request', data, strict);
}

/** The optional firmware features: stored mask, mask in force and supported mask (0x1AF, response). */
export function encodeFeaturesRespResponse(stored: number, running: number, supported: number): { id: number; data: number[] } {
  return encode('features_resp_response', { stored: stored, running: running, supported: supported });
}
/** Fields of 0x1AF, or null when the payload is too short. */
export function decodeFeaturesRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('features_resp_response', data, strict);
}

/** Electromagnet coil (0x1B0, request). */
export function encodeElectromagnetCmd(coil: number): { id: number; data: number[] } {
  return encode('electromagnet_cmd', { coil: coil });
}
/** Fields of 0x1B0, or null when the payload is too short. */
export function decodeElectromagnetCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('electromagnet_cmd', data, strict);
}

/** Periodic health frame of the board (only while the health feature runs) (0x1B8, response). */
export function encodeHealthProfile(tec: number, rec: number, busOffCount: number, hsiTrim: number, loopMaxMs: number, mcuTempPlus40: number, vddaMv: number): { id: number; data: number[] } {
  return encode('health_profile', { tec: tec, rec: rec, bus_off_count: busOffCount, hsi_trim: hsiTrim, loop_max_ms: loopMaxMs, mcu_temp_plus_40: mcuTempPlus40, vdda_mv: vddaMv });
}
/** Fields of 0x1B8, or null when the payload is too short. */
export function decodeHealthProfile(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('health_profile', data, strict);
}

/** Gains of the heater PID and start of its relay autotune (0x1B9, request). */
export function encodePidConfig(kpX100: number, kiX100: number, kdX100: number, action: number): { id: number; data: number[] } {
  return encode('pid_config', { kp_x100: kpX100, ki_x100: kiX100, kd_x100: kdX100, action: action });
}
/** Fields of 0x1B9, or null when the payload is too short. */
export function decodePidConfig(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('pid_config', data, strict);
}

/** The heater PID: gains in force, state and output (0x1BA, request). */
export function encodePidStateRespRequest(): { id: number; data: number[] } {
  return encode('pid_state_resp_request');
}
/** Fields of 0x1BA, or null when the payload is too short. */
export function decodePidStateRespRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('pid_state_resp_request', data, strict);
}

/** The heater PID: gains in force, state and output (0x1BA, response). */
export function encodePidStateRespResponse(kpX100: number, kiX100: number, kdX100: number, state: number, dutyPercent: number): { id: number; data: number[] } {
  return encode('pid_state_resp_response', { kp_x100: kpX100, ki_x100: kiX100, kd_x100: kdX100, state: state, duty_percent: dutyPercent });
}
/** Fields of 0x1BA, or null when the payload is too short. */
export function decodePidStateRespResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('pid_state_resp_response', data, strict);
}

/** Spot welder timed pulse (0x1C0, request). */
export function encodeSpotWeldCmd(fire: number, durationMs: number): { id: number; data: number[] } {
  return encode('spot_weld_cmd', { fire: fire, duration_ms: durationMs });
}
/** Fields of 0x1C0, or null when the payload is too short. */
export function decodeSpotWeldCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('spot_weld_cmd', data, strict);
}

/** UV curing LED duty (0x1D0, request). */
export function encodeUvCuringCmd(duty: number): { id: number; data: number[] } {
  return encode('uv_curing_cmd', { duty: duty });
}
/** Fields of 0x1D0, or null when the payload is too short. */
export function decodeUvCuringCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('uv_curing_cmd', data, strict);
}

/** Hot-air nozzle setpoint and blower duty (0x1E0, request). */
export function encodeHotairCmd(setpointC: number, blowerDuty: number): { id: number; data: number[] } {
  return encode('hotair_cmd', { setpoint_c: setpointC, blower_duty: blowerDuty });
}
/** Fields of 0x1E0, or null when the payload is too short. */
export function decodeHotairCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('hotair_cmd', data, strict);
}

/** Crimping actuator motor (0x1F0, request). */
export function encodeCrimpingCmd(direction: number, steps: number): { id: number; data: number[] } {
  return encode('crimping_cmd', { direction: direction, steps: steps });
}
/** Fields of 0x1F0, or null when the payload is too short. */
export function decodeCrimpingCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('crimping_cmd', data, strict);
}

/** Ultrasonic welder timed pulse (0x200, request). */
export function encodeUltrasonicWeldCmd(fire: number, durationMs: number): { id: number; data: number[] } {
  return encode('ultrasonic_weld_cmd', { fire: fire, duration_ms: durationMs });
}
/** Fields of 0x200, or null when the payload is too short. */
export function decodeUltrasonicWeldCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('ultrasonic_weld_cmd', data, strict);
}

/** Enter the expansion slave's bootloader (0x210, request). */
export function encodeSlaveEnterBootloader(magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('slave_enter_bootloader', { magic: magic });
}
/** Fields of 0x210, or null when the payload is too short. */
export function decodeSlaveEnterBootloader(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_enter_bootloader', data, strict);
}

/** Start the slave firmware update (0x211, request). */
export function encodeSlaveStartUpdate(totalSize: number, hardwareId: number): { id: number; data: number[] } {
  return encode('slave_start_update', { total_size: totalSize, hardware_id: hardwareId });
}
/** Fields of 0x211, or null when the payload is too short. */
export function decodeSlaveStartUpdate(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_start_update', data, strict);
}

/** Slave HMAC-SHA256 signature chunk (0x212, request). */
export function encodeSlaveHmacChunk(hmacPart: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('slave_hmac_chunk', { hmac_part: hmacPart });
}
/** Fields of 0x212, or null when the payload is too short. */
export function decodeSlaveHmacChunk(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_hmac_chunk', data, strict);
}

/** Slave firmware data (0x213, request). */
export function encodeSlaveData(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('slave_data', { data: data });
}
/** Fields of 0x213, or null when the payload is too short. */
export function decodeSlaveData(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_data', data, strict);
}

/** End the slave update and verify (0x214, request). */
export function encodeSlaveEndUpdate(crc32: number, versionMajor: number, versionMinorField: number): { id: number; data: number[] } {
  return encode('slave_end_update', { crc32: crc32, version_major: versionMajor, version_minor_field: versionMinorField });
}
/** Fields of 0x214, or null when the payload is too short. */
export function decodeSlaveEndUpdate(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_end_update', data, strict);
}

/** Slave bootloader status (0x215, request). */
export function encodeSlaveStatusRequest(): { id: number; data: number[] } {
  return encode('slave_status_request');
}
/** Fields of 0x215, or null when the payload is too short. */
export function decodeSlaveStatusRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_status_request', data, strict);
}

/** Slave bootloader status (0x215, response). */
export function encodeSlaveStatusResponse(status: number): { id: number; data: number[] } {
  return encode('slave_status_response', { status: status });
}
/** Fields of 0x215, or null when the payload is too short. */
export function decodeSlaveStatusResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_status_response', data, strict);
}

/** Slave update progress (0x216, request). */
export function encodeSlaveProgressRequest(): { id: number; data: number[] } {
  return encode('slave_progress_request');
}
/** Fields of 0x216, or null when the payload is too short. */
export function decodeSlaveProgressRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_progress_request', data, strict);
}

/** Slave update progress (0x216, response). */
export function encodeSlaveProgressResponse(progress: number): { id: number; data: number[] } {
  return encode('slave_progress_response', { progress: progress });
}
/** Fields of 0x216, or null when the payload is too short. */
export function decodeSlaveProgressResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_progress_response', data, strict);
}

/** Slave bootloader version, part 1 (0x217, request). */
export function encodeSlaveVersionResp1Request(): { id: number; data: number[] } {
  return encode('slave_version_resp_1_request');
}
/** Fields of 0x217, or null when the payload is too short. */
export function decodeSlaveVersionResp1Request(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_version_resp_1_request', data, strict);
}

/** Slave bootloader version, part 1 (0x217, response). */
export function encodeSlaveVersionResp1Response(responder: number, hardwareId: number, versionMajor: number, versionMinorHigh: number): { id: number; data: number[] } {
  return encode('slave_version_resp_1_response', { responder: responder, hardware_id: hardwareId, version_major: versionMajor, version_minor_high: versionMinorHigh });
}
/** Fields of 0x217, or null when the payload is too short. */
export function decodeSlaveVersionResp1Response(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_version_resp_1_response', data, strict);
}

/** Slave bootloader version, part 2 (0x218, response). */
export function encodeSlaveVersionResp2(versionMinorLow: number, bootloaderMajor: number, appPatch?: number, bootloaderMinor?: number, bootloaderPatch?: number): { id: number; data: number[] } {
  return encode('slave_version_resp_2', { version_minor_low: versionMinorLow, bootloader_major: bootloaderMajor, app_patch: appPatch, bootloader_minor: bootloaderMinor, bootloader_patch: bootloaderPatch });
}
/** Fields of 0x218, or null when the payload is too short. */
export function decodeSlaveVersionResp2(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_version_resp_2', data, strict);
}

/** Slave verify-fail reason (0x219, request). */
export function encodeSlaveVerifyFailReasonRequest(): { id: number; data: number[] } {
  return encode('slave_verify_fail_reason_request');
}
/** Fields of 0x219, or null when the payload is too short. */
export function decodeSlaveVerifyFailReasonRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_verify_fail_reason_request', data, strict);
}

/** Slave verify-fail reason (0x219, response). */
export function encodeSlaveVerifyFailReasonResponse(reason: number): { id: number; data: number[] } {
  return encode('slave_verify_fail_reason_response', { reason: reason });
}
/** Fields of 0x219, or null when the payload is too short. */
export function decodeSlaveVerifyFailReasonResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_verify_fail_reason_response', data, strict);
}

/** Write a slave application register (generic) (0x220, request). */
export function encodeSlaveRegWrite(register: number, payload: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('slave_reg_write', { register: register, payload: payload });
}
/** Fields of 0x220, or null when the payload is too short. */
export function decodeSlaveRegWrite(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_reg_write', data, strict);
}

/** Read a slave application register (generic) (0x221, request). */
export function encodeSlaveRegReadRequest(register: number, length: number): { id: number; data: number[] } {
  return encode('slave_reg_read_request', { register: register, length: length });
}
/** Fields of 0x221, or null when the payload is too short. */
export function decodeSlaveRegReadRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_reg_read_request', data, strict);
}

/** Read a slave application register (generic) (0x221, response). */
export function encodeSlaveRegReadResponse(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('slave_reg_read_response', { data: data });
}
/** Fields of 0x221, or null when the payload is too short. */
export function decodeSlaveRegReadResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('slave_reg_read_response', data, strict);
}

/** Local PWM configuration (0x230, request). */
export function encodePasteJettingConfig(channel: number, frequencyHz: number): { id: number; data: number[] } {
  return encode('paste_jetting_config', { channel: channel, frequency_hz: frequencyHz });
}
/** Fields of 0x230, or null when the payload is too short. */
export function decodePasteJettingConfig(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('paste_jetting_config', data, strict);
}

/** Local PWM pulse (0x231, request). */
export function encodePasteJettingPulse(channel: number, dutyPercent: number, durationMs: number): { id: number; data: number[] } {
  return encode('paste_jetting_pulse', { channel: channel, duty_percent: dutyPercent, duration_ms: durationMs });
}
/** Fields of 0x231, or null when the payload is too short. */
export function decodePasteJettingPulse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('paste_jetting_pulse', data, strict);
}

/** ADS1115 configuration (0x240, request). */
export function encodeAds1115Config(config: number): { id: number; data: number[] } {
  return encode('ads1115_config', { config: config });
}
/** Fields of 0x240, or null when the payload is too short. */
export function decodeAds1115Config(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('ads1115_config', data, strict);
}

/** ADS1115 trigger a conversion (0x241, request). */
export function encodeAds1115Trigger(): { id: number; data: number[] } {
  return encode('ads1115_trigger');
}
/** Fields of 0x241, or null when the payload is too short. */
export function decodeAds1115Trigger(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('ads1115_trigger', data, strict);
}

/** ADS1115 conversion result (query and response) (0x242, request). */
export function encodeAds1115ResultRequest(): { id: number; data: number[] } {
  return encode('ads1115_result_request');
}
/** Fields of 0x242, or null when the payload is too short. */
export function decodeAds1115ResultRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('ads1115_result_request', data, strict);
}

/** ADS1115 conversion result (query and response) (0x242, response). */
export function encodeAds1115ResultResponse(raw: number): { id: number; data: number[] } {
  return encode('ads1115_result_response', { raw: raw });
}
/** Fields of 0x242, or null when the payload is too short. */
export function decodeAds1115ResultResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('ads1115_result_response', data, strict);
}

/** Basic-mode onboard ADC reading (0x243, response). */
export function encodeFlyingProbeBasic(adc: number): { id: number; data: number[] } {
  return encode('flying_probe_basic', { adc: adc });
}
/** Fields of 0x243, or null when the payload is too short. */
export function decodeFlyingProbeBasic(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('flying_probe_basic', data, strict);
}

/** Trigger a thermal capture (0x250, request). */
export function encodeThermalTrigger(): { id: number; data: number[] } {
  return encode('thermal_trigger');
}
/** Fields of 0x250, or null when the payload is too short. */
export function decodeThermalTrigger(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_trigger', data, strict);
}

/** Thermal capture status (query and response) (0x251, request). */
export function encodeThermalStatusRequest(): { id: number; data: number[] } {
  return encode('thermal_status_request');
}
/** Fields of 0x251, or null when the payload is too short. */
export function decodeThermalStatusRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_status_request', data, strict);
}

/** Thermal capture status (query and response) (0x251, response). */
export function encodeThermalStatusResponse(status: number): { id: number; data: number[] } {
  return encode('thermal_status_response', { status: status });
}
/** Fields of 0x251, or null when the payload is too short. */
export function decodeThermalStatusResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_status_response', data, strict);
}

/** Request a raw pixel chunk (0x252, request). */
export function encodeThermalRawChunkReq(chunk: number): { id: number; data: number[] } {
  return encode('thermal_raw_chunk_req', { chunk: chunk });
}
/** Fields of 0x252, or null when the payload is too short. */
export function decodeThermalRawChunkReq(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_raw_chunk_req', data, strict);
}

/** Raw pixel chunk data (0x253, response). */
export function encodeThermalRawChunk(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('thermal_raw_chunk', { data: data });
}
/** Fields of 0x253, or null when the payload is too short. */
export function decodeThermalRawChunk(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_raw_chunk', data, strict);
}

/** Request a calibrated temperature chunk (0x254, request). */
export function encodeThermalCalChunkReq(chunk: number): { id: number; data: number[] } {
  return encode('thermal_cal_chunk_req', { chunk: chunk });
}
/** Fields of 0x254, or null when the payload is too short. */
export function decodeThermalCalChunkReq(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_cal_chunk_req', data, strict);
}

/** Calibrated temperature chunk data (0x255, response). */
export function encodeThermalCalChunk(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('thermal_cal_chunk', { data: data });
}
/** Fields of 0x255, or null when the payload is too short. */
export function decodeThermalCalChunk(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('thermal_cal_chunk', data, strict);
}

/** Version patch response (0x7E9, response). */
export function encodeVersionPatchResponse(responder: number, patch: number, flags: number): { id: number; data: number[] } {
  return encode('version_patch_response', { responder: responder, patch: patch, flags: flags });
}
/** Fields of 0x7E9, or null when the payload is too short. */
export function decodeVersionPatchResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('version_patch_response', data, strict);
}

/** Enter the bootloader (0x7F0, request). */
export function encodeEnterBootloader(magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('enter_bootloader', { magic: magic });
}
/** Fields of 0x7F0, or null when the payload is too short. */
export function decodeEnterBootloader(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('enter_bootloader', data, strict);
}

/** Start the firmware update (0x7F1, request). */
export function encodeStartUpdate(totalSize: number, hardwareId: number): { id: number; data: number[] } {
  return encode('start_update', { total_size: totalSize, hardware_id: hardwareId });
}
/** Fields of 0x7F1, or null when the payload is too short. */
export function decodeStartUpdate(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('start_update', data, strict);
}

/** Firmware data (0x7F2, request). */
export function encodeData(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('data', { data: data });
}
/** Fields of 0x7F2, or null when the payload is too short. */
export function decodeData(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('data', data, strict);
}

/** Page written acknowledgement (0x7F3, response). */
export function encodePageAck(pageIndex: number): { id: number; data: number[] } {
  return encode('page_ack', { page_index: pageIndex });
}
/** Fields of 0x7F3, or null when the payload is too short. */
export function decodePageAck(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('page_ack', data, strict);
}

/** End the update and verify (0x7F4, request). */
export function encodeEndUpdate(crc32: number, versionMajor: number, versionMinorField: number): { id: number; data: number[] } {
  return encode('end_update', { crc32: crc32, version_major: versionMajor, version_minor_field: versionMinorField });
}
/** Fields of 0x7F4, or null when the payload is too short. */
export function decodeEndUpdate(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('end_update', data, strict);
}

/** Bootloader status (0x7F5, response). */
export function encodeStatus(status: number, reason?: number): { id: number; data: number[] } {
  return encode('status', { status: status, reason: reason });
}
/** Fields of 0x7F5, or null when the payload is too short. */
export function decodeStatus(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('status', data, strict);
}

/** Bootloader heartbeat (0x7F6, response). */
export function encodeHeartbeat(status: number, progress: number): { id: number; data: number[] } {
  return encode('heartbeat', { status: status, progress: progress });
}
/** Fields of 0x7F6, or null when the payload is too short. */
export function decodeHeartbeat(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('heartbeat', data, strict);
}

/** HMAC-SHA256 signature chunk (0x7F7, request). */
export function encodeHmacChunk(hmacPart: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('hmac_chunk', { hmac_part: hmacPart });
}
/** Fields of 0x7F7, or null when the payload is too short. */
export function decodeHmacChunk(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('hmac_chunk', data, strict);
}

/** Query the version (0x7F8, request). */
export function encodeQueryVersion(): { id: number; data: number[] } {
  return encode('query_version');
}
/** Fields of 0x7F8, or null when the payload is too short. */
export function decodeQueryVersion(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('query_version', data, strict);
}

/** Version response (0x7F9, response). */
export function encodeVersionResponse(responder: number, hardwareId: number, versionMajor: number, versionMinor: number): { id: number; data: number[] } {
  return encode('version_response', { responder: responder, hardware_id: hardwareId, version_major: versionMajor, version_minor: versionMinor });
}
/** Fields of 0x7F9, or null when the payload is too short. */
export function decodeVersionResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('version_response', data, strict);
}

/** Bootloader's own version (0x7FA, response). */
export function encodeBootloaderVersionResponse(major: number, minor: number, patch: number): { id: number; data: number[] } {
  return encode('bootloader_version_response', { major: major, minor: minor, patch: patch });
}
/** Fields of 0x7FA, or null when the payload is too short. */
export function decodeBootloaderVersionResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('bootloader_version_response', data, strict);
}

/** Query the CAN error counters (0x7FB, request). */
export function encodeQueryErrorCounters(): { id: number; data: number[] } {
  return encode('query_error_counters');
}
/** Fields of 0x7FB, or null when the payload is too short. */
export function decodeQueryErrorCounters(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('query_error_counters', data, strict);
}

/** CAN error counters (0x7FC, response). */
export function encodeErrorCountersResponse(tec: number, rec: number): { id: number; data: number[] } {
  return encode('error_counters_response', { tec: tec, rec: rec });
}
/** Fields of 0x7FC, or null when the payload is too short. */
export function decodeErrorCountersResponse(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('error_counters_response', data, strict);
}

/** Authorise a downgrade for the current update (0x7FD, request). */
export function encodeAuthorizeDowngrade(magic?: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('authorize_downgrade', { magic: magic });
}
/** Fields of 0x7FD, or null when the payload is too short. */
export function decodeAuthorizeDowngrade(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('authorize_downgrade', data, strict);
}

/** Read back the installed application (0x7FE, request). */
export function encodeReadbackRequest(): { id: number; data: number[] } {
  return encode('readback_request');
}
/** Fields of 0x7FE, or null when the payload is too short. */
export function decodeReadbackRequest(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('readback_request', data, strict);
}

/** Read back the installed application (0x7FE, response, size). */
export function encodeReadbackResponseSize(totalSize: number): { id: number; data: number[] } {
  return encode('readback_response_size', { total_size: totalSize });
}
/** Fields of 0x7FE, or null when the payload is too short. */
export function decodeReadbackResponseSize(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('readback_response_size', data, strict);
}

/** Read back the installed application (0x7FE, response, data). */
export function encodeReadbackResponseData(data: number[] | Uint8Array): { id: number; data: number[] } {
  return encode('readback_response_data', { data: data });
}
/** Fields of 0x7FE, or null when the payload is too short. */
export function decodeReadbackResponseData(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('readback_response_data', data, strict);
}

/** Read-back page acknowledgement (0x7FF, request). */
export function encodeReadbackPageAck(pageIndex: number): { id: number; data: number[] } {
  return encode('readback_page_ack', { page_index: pageIndex });
}
/** Fields of 0x7FF, or null when the payload is too short. */
export function decodeReadbackPageAck(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('readback_page_ack', data, strict);
}

// ---------------------------------------------------------------------------
// multinode extension (implemented in the firmware behind a switch that is off by default, tested on the host only): see docs/MULTINODE.md
// ---------------------------------------------------------------------------
export const MN_VERSION = 1; // Multinode extension version carried by the discovery frames
export const MN_ADDRESS_BITS = 5; // Bits of the node address
export const MN_ADDRESS_MASK = 0x1F; // Mask of the node address
export const MN_NODE_MAX = 0x20; // Highest number of nodes on one bus
export const MN_STATUS_PERIOD_MS = 0x3E8; // Period of the per-node status frame (ms)
export const MN_DISCOVER_SLOT_MS = 2; // Default spacing of the discovery answers: a node answers after its address times this (ms)
export const MN_NODE_TIMEOUT_MS = 0xDAC; // A node that sent no status frame for this long is treated as gone (ms)
export const MN_SELECT_TIMEOUT_MS = 0x7D0; // A selection lapses unless the host repeats it within this time (ms)
export const MN_LEGACY_LISTEN_MS = 0x5DC; // A node listens this long after start for other nodes before it behaves as the one head on the bus (ms)
export const MN_CMD_ARGS_MAX = 6; // Argument bytes that fit in a node-addressed command (bytes)
export const MN_STATE_SELECTED = 0x01; // This node is the selected (active) node
export const MN_STATE_FAULT = 0x02; // A fault is latched on this node
export const MN_STATE_CONFLICT = 0x04; // Another node answered with the same address: this node ignores commands
export const MN_STATE_BOOTLOADER = 0x08; // The node runs its bootloader
export const MN_SELECT_DESELECT_ALL = 0; // No node is selected
export const MN_SELECT_SELECT = 1; // Select one node
export const MN_ID_DISCOVER = 0x400; // Ask every node to announce itself
export const MN_ID_SELECT = 0x401; // Select the one node that the single-head frames address
export const MN_ID_SAFE_STOP = 0x402; // Ask every node to enter its safe state
export const MN_ID_NODE_INFO_BASE = 0x420; // A node announces itself (identifier plus the node address) (+ node address, 32 identifiers)
export const MN_ID_NODE_STATUS_BASE = 0x440; // Periodic status of one node (+ node address, 32 identifiers)
export const MN_ID_NODE_CMD_BASE = 0x460; // One command to one node without selecting it (+ node address, 32 identifiers)
export const MN_ID_NODE_RESP_BASE = 0x480; // The answer of one node to NODE_CMD (+ node address, 32 identifiers)
export const MN_RANGES: Record<number, number> = {"1024": 1, "1025": 1, "1026": 1, "1056": 32, "1088": 32, "1120": 32, "1152": 32};
export const MN_NAMES: Record<number, string> = {"1024": "DISCOVER", "1025": "SELECT", "1026": "SAFE_STOP", "1056": "NODE_INFO", "1088": "NODE_STATUS", "1120": "NODE_CMD", "1152": "NODE_RESP"};

/** The identifier of a node-addressed frame: the base of its range plus the node address. */
export function mnNodeId(base: number, node: number): number {
  if ((MN_RANGES[base] ?? 1) === 1) throw new Error(`0x${base.toString(16)} is not the base of an addressed range`);
  if (!Number.isInteger(node) || node < 0 || node > MN_ADDRESS_MASK) throw new Error(`node address ${node} is outside 0..${MN_ADDRESS_MASK}`);
  return base + node;
}

/** [name, node] for an identifier of the extension (node is null for a broadcast frame), or null for any other identifier. */
export function mnSplitId(canId: number): [string, number | null] | null {
  for (const [key, span] of Object.entries(MN_RANGES)) {
    const base = Number(key);
    if (canId >= base && canId < base + span) return [MN_NAMES[base], span > 1 ? canId - base : null];
  }
  return null;
}

/** Ask every node to announce itself (0x400, request). */
export function encodeMnDiscover(mnVersion: number, slotMs: number): { id: number; data: number[] } {
  const frame = encode('mn_discover', { mn_version: mnVersion, slot_ms: slotMs });
  return frame;
}
/** Fields of 0x400, or null when the payload is too short. */
export function decodeMnDiscover(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_discover', data, strict);
}

/** Select the one node that the single-head frames address (0x401, request). */
export function encodeMnSelect(action: number, node: number, seq: number): { id: number; data: number[] } {
  const frame = encode('mn_select', { action: action, node: node, seq: seq });
  return frame;
}
/** Fields of 0x401, or null when the payload is too short. */
export function decodeMnSelect(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_select', data, strict);
}

/** Ask every node to enter its safe state (0x402, request). */
export function encodeMnSafeStop(reason: number): { id: number; data: number[] } {
  const frame = encode('mn_safe_stop', { reason: reason });
  return frame;
}
/** Fields of 0x402, or null when the payload is too short. */
export function decodeMnSafeStop(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_safe_stop', data, strict);
}

/** A node announces itself (identifier plus the node address) (0x420 + node, response). */
export function encodeMnNodeInfo(node: number, tool: number, state: number, instance: number, mnVersion: number, serial: number): { id: number; data: number[] } {
  const frame = encode('mn_node_info', { tool: tool, state: state, instance: instance, mn_version: mnVersion, serial: serial });
  return { id: mnNodeId(frame.id, node), data: frame.data };
}
/** Fields of 0x420, or null when the payload is too short. */
export function decodeMnNodeInfo(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_node_info', data, strict);
}

/** Periodic status of one node (0x440 + node, response). */
export function encodeMnNodeStatus(node: number, state: number, error: number, uptimeS: number): { id: number; data: number[] } {
  const frame = encode('mn_node_status', { state: state, error: error, uptime_s: uptimeS });
  return { id: mnNodeId(frame.id, node), data: frame.data };
}
/** Fields of 0x440, or null when the payload is too short. */
export function decodeMnNodeStatus(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_node_status', data, strict);
}

/** One command to one node without selecting it (0x460 + node, request). */
export function encodeMnNodeCmd(node: number, func: number, args: number[] | Uint8Array): { id: number; data: number[] } {
  const frame = encode('mn_node_cmd', { func: func, args: args });
  return { id: mnNodeId(frame.id, node), data: frame.data };
}
/** Fields of 0x460, or null when the payload is too short. */
export function decodeMnNodeCmd(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_node_cmd', data, strict);
}

/** The answer of one node to NODE_CMD (0x480 + node, response). */
export function encodeMnNodeResp(node: number, func: number, data: number[] | Uint8Array): { id: number; data: number[] } {
  const frame = encode('mn_node_resp', { func: func, data: data });
  return { id: mnNodeId(frame.id, node), data: frame.data };
}
/** Fields of 0x480, or null when the payload is too short. */
export function decodeMnNodeResp(data: ArrayLike<number>, strict = false): Fields | null {
  return decode('mn_node_resp', data, strict);
}
