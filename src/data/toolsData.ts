import { ToolProfile } from '../types';
import { URTC_TOOL_PROFILES } from '../lib/generated/urtcTools';

// The tool profiles are data: spec/tools.json of URTC-COMMON, generated into src/lib/generated/urtcTools.ts.
export const TOOL_PROFILES: ToolProfile[] = URTC_TOOL_PROFILES;

export const BOM_ITEMS = [
  { ref: "U1", part: "STM32F303CCT6", desc: "Main MCU, 32-bit ARM Cortex-M4, 256KB Flash, 40KB SRAM, LQFP48", category: "Microcontroller" },
  { ref: "U2", part: "TMC2209-LA", desc: "Stepper Motor Driver, 2.0A RMS, StealthChop2, SpreadCycle, QFN28", category: "Motor Driver" },
  { ref: "U3", part: "FM24CL64B-G", desc: "64Kb Ferroelectric RAM (F-RAM), I2C, SOIC-8 (Setpoints persistence)", category: "Memory" },
  { ref: "U4", part: "TJA1057GT/3", desc: "High-Speed CAN Transceiver with Standby Mode, SOIC-8", category: "Interface" },
  { ref: "U5", part: "AP2112K-3.3TRG1", desc: "3.3V 600mA Low Dropout Linear Voltage Regulator, SOT23-5", category: "Power" },
  { ref: "Q1, Q2", part: "AOD4184A", desc: "40V 50A N-Channel Power MOSFET, TO-252 (Heater/High Current Output)", category: "Power FET" },
  { ref: "LCD1 / CONN_OLED2", part: "SSD1306 / SSD1315", desc: "128x64 Two-Tone (Yellow top / Blue bottom) 0.96 inch I2C OLED display", category: "Display" },
  { ref: "EXPANSION", part: "20-Pin Header 2x10", desc: "Expansion header (24V, 5V, 3.3V, bit-bang I2C, STEP/DIR/EN, SPI, DIAG0, EXTI)", category: "Connector" },
  { ref: "EXP_ADVANCED_SLAVE", part: "STM32F303CBT6", desc: "Advanced Expansion Slave MCU (128KB Flash, 32KB SRAM, I2C link)", category: "Slave MCU" },
  { ref: "EXP_THERMAL", part: "MLX90640ESF-BAB", desc: "32x24 IR Array Thermal Sensor (Advanced Expansion Board)", category: "Sensor" },
  { ref: "EXP_ADC", part: "ADS1115IDGSR", desc: "16-bit 4-channel ADC with PGA, I2C (Advanced Expansion Board)", category: "Sensor" }
];
