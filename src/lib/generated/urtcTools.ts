// GENERATED from spec/tools.json by tools/generate_tools.py - do not edit by hand.
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE

export type UrtcToolKind = 'motion' | 'telemetry' | 'external' | 'actuator';
export type UrtcExpansionNeed = 'none' | 'recommended' | 'required';

/** A text of a panel: an existing translated text (key and its English default), or a plain one that is not translated. */
export type UrtcPanelText = { key: string; default: string; param?: string } | { text: string };

export type UrtcPanelControl =
  | { id: string; type: 'range' | 'number'; label: UrtcPanelText; min: number; max: number; default: number }
  | { id: string; type: 'select'; label: UrtcPanelText; default: string | number; options: { value: string | number; label: UrtcPanelText }[] }
  | { id: string; type: 'checkbox'; label: UrtcPanelText; default: boolean };

export interface UrtcPanelReading {
  id: string; label: UrtcPanelText; message: string; canId: number; offset: number; width: 1 | 2;
  format?: 'yes_no'; unit?: string; graph_max?: number;
}

export interface UrtcPanelAction {
  type: 'keepalive' | 'send' | 'stop' | 'latched';
  message: string; canId: number; encoder: string; args?: string[]; description?: string;
  label?: UrtcPanelText; confirm?: string; confirm_value?: string;
  off_encoder?: string; off_description?: string; watchdog_ms?: number; reset?: string[];
  description_on?: string; description_off?: string;
}

export interface UrtcPanelSection {
  title: UrtcPanelText; subtitle?: UrtcPanelText; notice?: UrtcPanelText;
  controls?: UrtcPanelControl[]; telemetry?: UrtcPanelReading[]; actions?: UrtcPanelAction[];
}

export interface UrtcToolPanel { sections: UrtcPanelSection[] }

export interface UrtcToolProfile {
  id: number;
  name: string;
  category: 'Shipped (v0.0)' | 'Expansion (v0.1)';
  description: string;
  heroMetricLabel: string;
  heroMetricUnit: string;
  defaultSetpoint: number;
  minVal: number;
  maxVal: number;
  watchdogMs?: number;
  pinsUsed: string[];
  features: string[];
  iconFrames: string[];
  kind: UrtcToolKind;
  shortName: string;
  expansionBoard: UrtcExpansionNeed;
  panel?: UrtcToolPanel;
}

export const URTC_TOOL_PROFILES: UrtcToolProfile[] = [
  {
    "id": 0,
    "name": "T12 Soldering Station",
    "category": "Shipped (v0.0)",
    "description": "PID temperature control with direct ADC feedback for standard T12 soldering tips. Safety timeout watchdog protects tip from oxidation.",
    "heroMetricLabel": "TIP TEMP",
    "heroMetricUnit": "°C",
    "defaultSetpoint": 320,
    "minVal": 150,
    "maxVal": 445,
    "watchdogMs": 250,
    "pinsUsed": [
      "PA0 (ADC1_IN1)",
      "PB0 (TIM3_CH3 MOSFET)",
      "PA4 (EXTI Limit/Endstop)"
    ],
    "features": [
      "PID Auto-Tune",
      "ADC Thermocouple Reader",
      "Sleep Mode Detection",
      "Watchdog Safety Cutoff"
    ],
    "iconFrames": [
      "IRON_1",
      "IRON_2",
      "IRON_3",
      "IRON_4"
    ],
    "kind": "motion",
    "shortName": "Soldering Iron",
    "expansionBoard": "none"
  },
  {
    "id": 1,
    "name": "SMT Solder Paste Dispenser",
    "category": "Shipped (v0.0)",
    "description": "Millimetric syringe feed control powered by TMC2209 stepper driver for high-precision SMT solder paste deposition on PCBs.",
    "heroMetricLabel": "DISPENSE RATE",
    "heroMetricUnit": "mm/s",
    "defaultSetpoint": 1.5,
    "minVal": 0.1,
    "maxVal": 10,
    "pinsUsed": [
      "STEP/DIR/EN (TMC2209)",
      "PB1 (Pressure Sense)",
      "PA4 (Endstop)"
    ],
    "features": [
      "Micro-step Feed Control",
      "Retract Pulse",
      "Volumetric Calibration",
      "Solder Syringe Pressure Shield"
    ],
    "iconFrames": [
      "PASTE_1",
      "PASTE_2",
      "PASTE_3",
      "PASTE_4"
    ],
    "kind": "motion",
    "shortName": "Paste Dispenser",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 2,
    "name": "Thermal Paste / Liquid Dispenser",
    "category": "Shipped (v0.0)",
    "description": "Viscosity-adapted liquid dispenser for high-viscosity thermal pastes, conformal gels, and UV adhesives.",
    "heroMetricLabel": "FLOW RATE",
    "heroMetricUnit": "µL/s",
    "defaultSetpoint": 5,
    "minVal": 0.5,
    "maxVal": 50,
    "pinsUsed": [
      "STEP/DIR/EN (TMC2209)",
      "PA1 (Fluid Temp NTC)",
      "PB5 (Valve Solenoid)"
    ],
    "features": [
      "Anti-Drip Retraction",
      "Fluid Viscosity Profile",
      "Pneumatic Assist"
    ],
    "iconFrames": [
      "LIQUID_1",
      "LIQUID_2",
      "LIQUID_3",
      "LIQUID_4"
    ],
    "kind": "motion",
    "shortName": "Liquid Dispenser",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 3,
    "name": "Smart Electric Screwdriver",
    "category": "Shipped (v0.0)",
    "description": "Precision rotation and torque-limiting screwdriver for automatic M2-M4 electronics assembly.",
    "heroMetricLabel": "TORQUE LIMIT",
    "heroMetricUnit": "N·cm",
    "defaultSetpoint": 12,
    "minVal": 1,
    "maxVal": 35,
    "pinsUsed": [
      "PB8/PB9 (I2C1 Current Sense)",
      "PB0 (PWM Motor)",
      "PA4 (Bit Limit Switch)"
    ],
    "features": [
      "Dynamic Stall Detection",
      "Screw Depth Sensing",
      "Reversible Drive",
      "Torque Ramp Control"
    ],
    "iconFrames": [
      "SCREW_1",
      "SCREW_2",
      "SCREW_3",
      "SCREW_4"
    ],
    "kind": "motion",
    "shortName": "Screwdriver",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 4,
    "name": "Vacuum / Pneumatic Gripper",
    "category": "Shipped (v0.0)",
    "description": "High-speed vacuum pick-and-place head with real-time pressure feedback for IC and passive component handling.",
    "heroMetricLabel": "VACUUM LEVEL",
    "heroMetricUnit": "kPa",
    "defaultSetpoint": -65,
    "minVal": -90,
    "maxVal": 0,
    "pinsUsed": [
      "PB4 (Pump PWM)",
      "PA1 (Pressure Sensor ADC)",
      "PB5 (Blow-off Solenoid)"
    ],
    "features": [
      "Part Detect Feedback",
      "Quick Blow-Off Release",
      "Vacuum Pump PWM Control"
    ],
    "iconFrames": [
      "VACUUM_1",
      "VACUUM_2",
      "VACUUM_3",
      "VACUUM_4"
    ],
    "kind": "telemetry",
    "shortName": "Vacuum Pickup",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.vacuum_title",
            "default": "Vacuum Pickup (0x145, telemetry only)"
          },
          "subtitle": {
            "key": "testertool.vacuum_subtitle",
            "default": "Passively pushed by the firmware - no command to send."
          },
          "telemetry": [
            {
              "id": "adc",
              "label": {
                "key": "testertool.adc_label",
                "default": "ADC:"
              },
              "message": "VACUUM_TELEMETRY",
              "canId": 325,
              "offset": 0,
              "width": 2
            },
            {
              "id": "part",
              "label": {
                "key": "testertool.part_detected_label",
                "default": "Part detected:"
              },
              "message": "VACUUM_TELEMETRY",
              "canId": 325,
              "offset": 2,
              "width": 1,
              "format": "yes_no"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 5,
    "name": "Drill / PCB Spindle (BL4260)",
    "category": "Shipped (v0.0)",
    "description": "High-RPM BLDC spindle with closed-loop tachometer feedback, dynamic electric braking, and direction control.",
    "heroMetricLabel": "SPINDLE SPEED",
    "heroMetricUnit": "RPM",
    "defaultSetpoint": 12000,
    "minVal": 1000,
    "maxVal": 24000,
    "watchdogMs": 250,
    "pinsUsed": [
      "PA8 (PWM Speed)",
      "PA3 (FGIN Tachometer Input)",
      "PA4 (FRIN Direction)",
      "PB9 (DRILL_BRAKE)"
    ],
    "features": [
      "Dynamic Braking",
      "Optical Tachometer Reading",
      "Direction Switch",
      "Dedicated Enable Line"
    ],
    "iconFrames": [
      "DRILL_1",
      "DRILL_2",
      "DRILL_3",
      "DRILL_4"
    ],
    "kind": "actuator",
    "shortName": "Drill",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.drill_title",
            "default": "Drill (0x140 / telemetry 0x147)"
          },
          "subtitle": {
            "key": "testertool.drill_subtitle",
            "default": "The command is resent while Active is checked; the board stops the drill 250 ms after the last one."
          },
          "controls": [
            {
              "id": "speed",
              "type": "range",
              "label": {
                "key": "testertool.speed_label",
                "default": "Speed ({{speed}})",
                "param": "speed"
              },
              "min": 0,
              "max": 255,
              "default": 0
            },
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "cw",
              "options": [
                {
                  "value": "cw",
                  "label": {
                    "key": "testertool.clockwise",
                    "default": "Clockwise"
                  }
                },
                {
                  "value": "ccw",
                  "label": {
                    "key": "testertool.counter_clockwise",
                    "default": "Counter-clockwise"
                  }
                }
              ]
            }
          ],
          "actions": [
            {
              "type": "keepalive",
              "message": "DRILL_CMD",
              "canId": 320,
              "encoder": "drillCommand",
              "args": [
                "speed",
                "dir"
              ],
              "off_encoder": "drillStop",
              "description": "Drill command",
              "off_description": "Drill stop",
              "confirm": "drill",
              "watchdog_ms": 250
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "DRILL_CMD",
              "canId": 320,
              "encoder": "drillStop",
              "description": "Drill stop",
              "reset": [
                "speed"
              ]
            }
          ],
          "telemetry": [
            {
              "id": "rpm",
              "label": {
                "key": "testertool.rpm_label",
                "default": "RPM:"
              },
              "message": "DRILL_TELEMETRY",
              "canId": 327,
              "offset": 0,
              "width": 2
            },
            {
              "id": "endstop",
              "label": {
                "key": "testertool.endstop_label",
                "default": "Endstop:"
              },
              "message": "DRILL_TELEMETRY",
              "canId": 327,
              "offset": 2,
              "width": 1
            }
          ]
        }
      ]
    }
  },
  {
    "id": 6,
    "name": "Gimbal Gripper",
    "category": "Shipped (v0.0)",
    "description": "High-sensitivity 3-phase BLDC gimbal motor gripper for delicate object compliance and soft-touch gripping.",
    "heroMetricLabel": "GRIP FORCE",
    "heroMetricUnit": "N",
    "defaultSetpoint": 3.5,
    "minVal": 0.2,
    "maxVal": 15,
    "pinsUsed": [
      "PA8/PA9/PA10 (TIM1 3-Phase)",
      "PA0 (Angle Sensor Encoder)"
    ],
    "features": [
      "FOC Compliance Control",
      "Soft Touch Detection",
      "Position/Torque Dual Mode"
    ],
    "iconFrames": [
      "GIMBAL_1",
      "GIMBAL_2",
      "GIMBAL_3",
      "GIMBAL_4"
    ],
    "kind": "motion",
    "shortName": "Gripper (Gimbal)",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 7,
    "name": "NEMA Heavy-Duty Gripper",
    "category": "Shipped (v0.0)",
    "description": "High-force mechanical jaw driven by TMC2209 stepper for heavy payload handling and rigid mechanical clamping.",
    "heroMetricLabel": "CLAMP POSITION",
    "heroMetricUnit": "%",
    "defaultSetpoint": 80,
    "minVal": 0,
    "maxVal": 100,
    "pinsUsed": [
      "STEP/DIR/EN (TMC2209)",
      "PA4 (Homing Switch)",
      "PA1 (Current Sense)"
    ],
    "features": [
      "StallGuard Load Detection",
      "Variable Current Hold",
      "Auto-Homing Sequence"
    ],
    "iconFrames": [
      "NEMA_1",
      "NEMA_2",
      "NEMA_3",
      "NEMA_4"
    ],
    "kind": "motion",
    "shortName": "Gripper (NEMA)",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 8,
    "name": "AOI Camera Inspection Ring",
    "category": "Shipped (v0.0)",
    "description": "Automated Optical Inspection lighting controller with stroboscopic ring LED flash and camera shutter synchronization.",
    "heroMetricLabel": "FLASH POWER",
    "heroMetricUnit": "%",
    "defaultSetpoint": 100,
    "minVal": 0,
    "maxVal": 100,
    "pinsUsed": [
      "PB6 (WS2812B Ring Data)",
      "PA4 (Cam Shutter Sync In)",
      "PB7 (Strobe Trigger)"
    ],
    "features": [
      "Stroboscopic Pulse (10µs)",
      "RGB Color Matrix",
      "Camera Trigger Out"
    ],
    "iconFrames": [
      "AOI_1",
      "AOI_2",
      "AOI_3",
      "AOI_4"
    ],
    "kind": "telemetry",
    "shortName": "AOI Inspection",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.aoi_title",
            "default": "AOI Inspection (0x150 / telemetry 0x155)"
          },
          "subtitle": {
            "key": "testertool.aoi_subtitle",
            "default": "Ring color comes from the global 0x100 command - this only sets mode/strobe."
          },
          "controls": [
            {
              "id": "mode",
              "type": "select",
              "label": {
                "key": "testertool.ring_mode_label",
                "default": "Ring Mode"
              },
              "default": 0,
              "options": [
                {
                  "value": 0,
                  "label": {
                    "key": "testertool.mode_off",
                    "default": "Off"
                  }
                },
                {
                  "value": 1,
                  "label": {
                    "key": "testertool.mode_sync",
                    "default": "Synchronous strobe"
                  }
                },
                {
                  "value": 2,
                  "label": {
                    "key": "testertool.mode_fixed",
                    "default": "Fixed continuous"
                  }
                }
              ]
            },
            {
              "id": "period",
              "type": "number",
              "label": {
                "key": "testertool.strobe_period_label",
                "default": "Strobe period (ms)"
              },
              "min": 1,
              "max": 500,
              "default": 100
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.send",
                "default": "Send"
              },
              "message": "AOI_CMD",
              "canId": 336,
              "encoder": "aoiRingCommand",
              "args": [
                "mode",
                "period"
              ],
              "description": "AOI ring command"
            }
          ],
          "telemetry": [
            {
              "id": "endstop",
              "label": {
                "key": "testertool.endstop_label",
                "default": "Endstop:"
              },
              "message": "AOI_TELEMETRY",
              "canId": 341,
              "offset": 0,
              "width": 1
            }
          ]
        }
      ]
    }
  },
  {
    "id": 9,
    "name": "Engraving Laser Diode (10W)",
    "category": "Shipped (v0.0)",
    "description": "High-power 10W optical laser engraver/cutter with hardware interlock loop and 250ms CAN heartbeat watchdog shutdown.",
    "heroMetricLabel": "LASER POWER",
    "heroMetricUnit": "%",
    "defaultSetpoint": 0,
    "minVal": 0,
    "maxVal": 100,
    "watchdogMs": 250,
    "pinsUsed": [
      "PA8 (PWM Laser Modulation)",
      "PA4 (Safety Interlock Door)",
      "PA1 (Diode Temp)"
    ],
    "features": [
      "Hardware Watchdog Lockdown",
      "PWM Power Scale",
      "Safety Interlock Loop",
      "Air Assist Solenoid"
    ],
    "iconFrames": [
      "LASER_1",
      "LASER_2",
      "LASER_3",
      "LASER_4"
    ],
    "kind": "actuator",
    "shortName": "Laser Engraver",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.laser_title",
            "default": "Laser Engraver (0x160 / telemetry 0x165)"
          },
          "notice": {
            "key": "testertool.laser_interlock_notice",
            "default": "Interlock must be armed for power to actually do anything (firmware-side gate)."
          },
          "controls": [
            {
              "id": "power",
              "type": "range",
              "label": {
                "key": "testertool.power_label",
                "default": "Power ({{power}})",
                "param": "power"
              },
              "min": 0,
              "max": 255,
              "default": 0
            },
            {
              "id": "interlock",
              "type": "checkbox",
              "label": {
                "key": "testertool.interlock_armed",
                "default": "Interlock Armed"
              },
              "default": false
            }
          ],
          "actions": [
            {
              "type": "keepalive",
              "message": "LASER_CMD",
              "canId": 352,
              "encoder": "laserCommand",
              "args": [
                "power",
                "interlock"
              ],
              "off_encoder": "laserOff",
              "description": "Laser power command",
              "off_description": "Laser off",
              "confirm": "laser",
              "watchdog_ms": 250
            }
          ],
          "telemetry": [
            {
              "id": "endstop",
              "label": {
                "key": "testertool.endstop_label",
                "default": "Endstop:"
              },
              "message": "LASER_TELEMETRY",
              "canId": 357,
              "offset": 0,
              "width": 1
            }
          ]
        }
      ]
    }
  },
  {
    "id": 10,
    "name": "3D Printing Hotend",
    "category": "Shipped (v0.0)",
    "description": "Full FDM hotend controller with PID heater, thermistor reader, extruder motor, and 25kHz tachometer-feedback cooling fan.",
    "heroMetricLabel": "NOZZLE TEMP",
    "heroMetricUnit": "°C",
    "defaultSetpoint": 215,
    "minVal": 20,
    "maxVal": 300,
    "watchdogMs": 250,
    "pinsUsed": [
      "PA0 (NTC Thermistor)",
      "PB0 (Heater MOSFET)",
      "PA8 (25kHz Fan PWM)",
      "PA11 (Fan Tach Input)"
    ],
    "features": [
      "PID Nozzle Control",
      "25kHz 4-Wire Fan Control",
      "Extruder Stepper Integration",
      "Thermal Runaway Protection"
    ],
    "iconFrames": [
      "PRINT_1",
      "PRINT_2",
      "PRINT_3",
      "PRINT_4"
    ],
    "kind": "actuator",
    "shortName": "3D Printer",
    "expansionBoard": "none"
  },
  {
    "id": 11,
    "name": "3D Scanner Contact Probe",
    "category": "Shipped (v0.0)",
    "description": "Ultra-fast hardware interrupt digitizing probe (EXTI) for surface height mapping and point cloud generation.",
    "heroMetricLabel": "TRIGGER COUNT",
    "heroMetricUnit": "pts",
    "defaultSetpoint": 0,
    "minVal": 0,
    "maxVal": 99999,
    "pinsUsed": [
      "PA4 (EXTI High Priority Probe)",
      "PB6 (Ring LED Status)"
    ],
    "features": [
      "Sub-microsecond Trigger Latency",
      "Hardware Debounce Filter",
      "Surface Point Digitizer"
    ],
    "iconFrames": [
      "PROBE_1",
      "PROBE_2",
      "PROBE_3",
      "PROBE_4"
    ],
    "kind": "telemetry",
    "shortName": "Scan Probe",
    "expansionBoard": "none"
  },
  {
    "id": 12,
    "name": "SMT Pick & Place Head",
    "category": "Expansion (v0.1)",
    "description": "Rotary A-axis alignment motor for rotating SMT components precisely before placement onto PCB pads.",
    "heroMetricLabel": "A-AXIS ANGLE",
    "heroMetricUnit": "°",
    "defaultSetpoint": 0,
    "minVal": -180,
    "maxVal": 180,
    "pinsUsed": [
      "STEP/DIR/EN (TMC2209)",
      "PA4 (Homing Switch)",
      "Expansion I2C (Vacuum)"
    ],
    "features": [
      "360° Continuous Rotation",
      "Micro-degree Accuracy",
      "Vacuum Link Integration"
    ],
    "iconFrames": [
      "PNP_1",
      "PNP_2",
      "PNP_3",
      "PNP_4"
    ],
    "kind": "motion",
    "shortName": "SMT Pick & Place",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 13,
    "name": "Heavy-Duty Electromagnet",
    "category": "Expansion (v0.1)",
    "description": "PWM-driven electromagnetic pickup for ferromagnetic component handling and fast magnetic release.",
    "heroMetricLabel": "COIL CURRENT",
    "heroMetricUnit": "%",
    "defaultSetpoint": 50,
    "minVal": 0,
    "maxVal": 100,
    "pinsUsed": [
      "PB0 (High-Current MOSFET)",
      "PA1 (Coil Temp Sense)"
    ],
    "features": [
      "Reverse Demagnetization Pulse",
      "Duty Cycle Power Saver",
      "Thermal Protection"
    ],
    "iconFrames": [
      "MAG_1",
      "MAG_2",
      "MAG_3",
      "MAG_4"
    ],
    "kind": "actuator",
    "shortName": "Electromagnet",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.electromagnet_title",
            "default": "Electromagnet (0x1B0)"
          },
          "subtitle": {
            "key": "testertool.electromagnet_subtitle",
            "default": "Latched digital command - no comms watchdog by design (see CANBUS.TXT note on 0x1B0)."
          },
          "actions": [
            {
              "type": "latched",
              "label": {
                "key": "testertool.energize",
                "default": "Energize"
              },
              "message": "ELECTROMAGNET_CMD",
              "canId": 432,
              "encoder": "electromagnetCommand",
              "description_on": "Electromagnet ON",
              "description_off": "Electromagnet OFF"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 14,
    "name": "Spot Welder Head",
    "category": "Expansion (v0.1)",
    "description": "Millisecond-precise dual pulse spot welder controller for battery pack nickel tab fabrication with contact sensing.",
    "heroMetricLabel": "PULSE TIME",
    "heroMetricUnit": "ms",
    "defaultSetpoint": 15,
    "minVal": 1,
    "maxVal": 100,
    "pinsUsed": [
      "PB0 (Gate Driver Trigger)",
      "PA4 (Contact Pressure Switch)"
    ],
    "features": [
      "Pre-weld Cleanup Pulse",
      "Contact Safety Gating",
      "Energy Monitor"
    ],
    "iconFrames": [
      "WELD_1",
      "WELD_2",
      "WELD_3",
      "WELD_4"
    ],
    "kind": "actuator",
    "shortName": "Spot Welder",
    "expansionBoard": "recommended",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "Spot Welder (0x1C0)"
          },
          "subtitle": {
            "key": "testertool.weld_subtitle_gated",
            "default": "Requires the contact sensor to be satisfied (firmware-side gate)."
          },
          "controls": [
            {
              "id": "ms",
              "type": "number",
              "label": {
                "key": "testertool.pulse_duration_label",
                "default": "Pulse duration (1-{{max}} ms)"
              },
              "min": 1,
              "max": 2000,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.fire_pulse",
                "default": "Fire Pulse"
              },
              "message": "SPOT_WELD_CMD",
              "canId": 448,
              "encoder": "weldFire",
              "args": [
                "ms"
              ],
              "description": "Spot Welder (0x1C0) fire",
              "confirm": "weld"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 15,
    "name": "Conformal Coating Airbrush",
    "category": "Expansion (v0.1)",
    "description": "Automated airbrush and spray valve for applying protective conformal acrylic/silicone coating to finished PCBs.",
    "heroMetricLabel": "ATOMIZER AIR",
    "heroMetricUnit": "PSI",
    "defaultSetpoint": 25,
    "minVal": 5,
    "maxVal": 60,
    "pinsUsed": [
      "PB4 (Air Pressure Valve)",
      "PB5 (Fluid Needle Stepper)"
    ],
    "features": [
      "Fan Pattern Adjustment",
      "Solvent Purge Cycle",
      "Anti-Clog Pulsing"
    ],
    "iconFrames": [
      "AIR_1",
      "AIR_2",
      "AIR_3",
      "AIR_4"
    ],
    "kind": "external",
    "shortName": "Conformal Coating",
    "expansionBoard": "none"
  },
  {
    "id": 16,
    "name": "Large Vacuum Suction Array",
    "category": "Expansion (v0.1)",
    "description": "Multi-cup suction array controller for unpopulated FR4 panel loader and large metal sheet handling.",
    "heroMetricLabel": "PANEL VACUUM",
    "heroMetricUnit": "kPa",
    "defaultSetpoint": -80,
    "minVal": -95,
    "maxVal": 0,
    "pinsUsed": [
      "PB4 (Master Vacuum Valve)",
      "PA1 (Array Pressure sensor)",
      "Expansion GPIO"
    ],
    "features": [
      "4-Zone Selective Vacuum",
      "Panel Seating Sensor",
      "Emergency Blow-Off"
    ],
    "iconFrames": [
      "VACARRAY_1",
      "VACARRAY_2",
      "VACARRAY_3",
      "VACARRAY_4"
    ],
    "kind": "motion",
    "shortName": "Vacuum Gripper (LG)",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x120)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "MOTION_CMD",
              "canId": 288,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 17,
    "name": "Functional Flying-Probe Tester",
    "category": "Expansion (v0.1)",
    "description": "High-precision electrical probe testing with 16-bit ADS1115 ADC reading on Advanced Expansion Board for board testing.",
    "heroMetricLabel": "MEASURED VOLT",
    "heroMetricUnit": "V",
    "defaultSetpoint": 3.3,
    "minVal": 0,
    "maxVal": 36,
    "pinsUsed": [
      "Advanced Expansion I2C (ADS1115 16-bit ADC)",
      "PA4 (Probe Contact)"
    ],
    "features": [
      "16-bit ADC Resolution",
      "Resistance / Voltage Mode",
      "Kelvin 4-Wire Measurement"
    ],
    "iconFrames": [
      "TESTER_1",
      "TESTER_2",
      "TESTER_3",
      "TESTER_4"
    ],
    "kind": "telemetry",
    "shortName": "Flying Probe",
    "expansionBoard": "none"
  },
  {
    "id": 18,
    "name": "UV Curing Lamp Head",
    "category": "Expansion (v0.1)",
    "description": "High-power 365nm/395nm UV LED arrays for rapid 2-second curing of optical adhesives and solder mask touchups.",
    "heroMetricLabel": "UV INTENSITY",
    "heroMetricUnit": "%",
    "defaultSetpoint": 80,
    "minVal": 0,
    "maxVal": 100,
    "watchdogMs": 250,
    "pinsUsed": [
      "PB0 (UV Driver MOSFET)",
      "PA1 (Heatsink NTC)",
      "PA4 (Safety Shield Switch)"
    ],
    "features": [
      "Dual Wavelength Control",
      "Exposure Timer",
      "Over-Temp Thermal Throttle"
    ],
    "iconFrames": [
      "UV_1",
      "UV_2",
      "UV_3",
      "UV_4"
    ],
    "kind": "actuator",
    "shortName": "UV Curing",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.uv_curing_title",
            "default": "UV Curing (0x1D0)"
          },
          "subtitle": {
            "key": "testertool.uv_curing_subtitle",
            "default": "Shares TIM1_CH1 with the laser - same 250ms watchdog."
          },
          "controls": [
            {
              "id": "power",
              "type": "range",
              "label": {
                "key": "testertool.power_label",
                "default": "Power ({{power}})",
                "param": "power"
              },
              "min": 0,
              "max": 255,
              "default": 0
            }
          ],
          "actions": [
            {
              "type": "keepalive",
              "message": "UV_CURING_CMD",
              "canId": 464,
              "encoder": "powerByte",
              "args": [
                "power"
              ],
              "off_encoder": "powerOff",
              "description": "UV curing power",
              "off_description": "UV curing off",
              "confirm": "uv",
              "watchdog_ms": 250
            }
          ]
        }
      ]
    }
  },
  {
    "id": 19,
    "name": "Hot Air Rework Nozzle",
    "category": "Expansion (v0.1)",
    "description": "Full hot-air SMD reflow nozzle with high-temperature ceramic heater PID and turbine blower control.",
    "heroMetricLabel": "AIR TEMP",
    "heroMetricUnit": "°C",
    "defaultSetpoint": 350,
    "minVal": 100,
    "maxVal": 445,
    "watchdogMs": 250,
    "pinsUsed": [
      "PA0 (K-Type Thermocouple Amplifier)",
      "PB0 (Heater PWM)",
      "PA8 (Blower Fan PWM)"
    ],
    "features": [
      "Auto Cool-Down Standby",
      "Airflow Rate Regulation",
      "PID Temperature Hold"
    ],
    "iconFrames": [
      "HOTAIR_1",
      "HOTAIR_2",
      "HOTAIR_3",
      "HOTAIR_4"
    ],
    "kind": "actuator",
    "shortName": "Hot Air Rework",
    "expansionBoard": "none",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.hotair_title",
            "default": "Hot Air Rework (0x1E0, telemetry shared with 0x135)"
          },
          "controls": [
            {
              "id": "temp",
              "type": "number",
              "label": {
                "key": "testertool.setpoint_0_445",
                "default": "Setpoint (0-445 C)"
              },
              "min": 0,
              "max": 445,
              "default": 200
            },
            {
              "id": "blower",
              "type": "range",
              "label": {
                "key": "testertool.blower_label",
                "default": "Blower ({{power}})",
                "param": "power"
              },
              "min": 0,
              "max": 255,
              "default": 0
            }
          ],
          "actions": [
            {
              "type": "keepalive",
              "message": "HOTAIR_CMD",
              "canId": 480,
              "encoder": "hotAirCommand",
              "args": [
                "temp",
                "blower"
              ],
              "off_encoder": "hotAirOff",
              "description": "Hot air rework command",
              "off_description": "Hot air rework off",
              "confirm": "heater",
              "confirm_value": "temp",
              "watchdog_ms": 250
            }
          ],
          "telemetry": [
            {
              "id": "live",
              "label": {
                "key": "testertool.live_label",
                "default": "Live:"
              },
              "message": "SOLDER_TELEMETRY",
              "canId": 309,
              "offset": 0,
              "width": 2,
              "unit": "C",
              "graph_max": 450
            }
          ]
        }
      ]
    }
  },
  {
    "id": 20,
    "name": "Pneumatic Press-Fit Inserter",
    "category": "Expansion (v0.1)",
    "description": "Linear press cylinder for seating heavy press-fit connectors, headers, and mechanical standoffs onto PCBs.",
    "heroMetricLabel": "PRESS FORCE",
    "heroMetricUnit": "N",
    "defaultSetpoint": 250,
    "minVal": 10,
    "maxVal": 1000,
    "pinsUsed": [
      "PB4 (Press Solenoid)",
      "PA1 (Load Cell Strain Gauge)",
      "PA4 (Bottom Limit)"
    ],
    "features": [
      "Load Cell Force Profile",
      "Depth Limit Stop",
      "Double-Tap Seating"
    ],
    "iconFrames": [
      "PRESS_1",
      "PRESS_2",
      "PRESS_3",
      "PRESS_4"
    ],
    "kind": "external",
    "shortName": "Press-Fit Inserter",
    "expansionBoard": "none"
  },
  {
    "id": 21,
    "name": "Wire Stripper & Crimper",
    "category": "Expansion (v0.1)",
    "description": "High-torque crimping actuator driven via expansion TMC5160A 10A stepper driver for automated wiring harness assembly.",
    "heroMetricLabel": "CRIMP CYCLE",
    "heroMetricUnit": "mm",
    "defaultSetpoint": 4.2,
    "minVal": 0.5,
    "maxVal": 8,
    "pinsUsed": [
      "Expansion SPI (TMC5160A 10A Driver)",
      "Expansion DIAG0 (StallGuard)"
    ],
    "features": [
      "TMC5160 10A High Current Mode",
      "StallGuard Force Peak",
      "Strip Length Control"
    ],
    "iconFrames": [
      "CRIMP_1",
      "CRIMP_2",
      "CRIMP_3",
      "CRIMP_4"
    ],
    "kind": "motion",
    "shortName": "Crimping Actuator",
    "expansionBoard": "required",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "{tool} (0x1F0)"
          },
          "subtitle": {
            "key": "testertool.motion_subtitle",
            "default": "One-shot move, no telemetry, no comms watchdog."
          },
          "controls": [
            {
              "id": "dir",
              "type": "select",
              "label": {
                "key": "testertool.direction_label",
                "default": "Direction"
              },
              "default": "fwd",
              "options": [
                {
                  "value": "fwd",
                  "label": {
                    "key": "testertool.forward",
                    "default": "Forward"
                  }
                },
                {
                  "value": "rev",
                  "label": {
                    "key": "testertool.reverse",
                    "default": "Reverse"
                  }
                }
              ]
            },
            {
              "id": "steps",
              "type": "number",
              "label": {
                "key": "testertool.steps_label",
                "default": "Steps"
              },
              "min": 1,
              "max": 4294967295,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.move",
                "default": "Move"
              },
              "message": "CRIMPING_CMD",
              "canId": 496,
              "encoder": "motionMove",
              "args": [
                "dir",
                "steps"
              ],
              "description": "Move",
              "confirm": "motion"
            },
            {
              "type": "stop",
              "label": {
                "key": "testertool.stop",
                "default": "Stop"
              },
              "message": "CRIMPING_CMD",
              "canId": 496,
              "encoder": "motionStop",
              "args": [
                "dir"
              ],
              "description": "Stop"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 22,
    "name": "PCB Thermal Inspection (MLX90640)",
    "category": "Expansion (v0.1)",
    "description": "32x24 pixel IR thermal imaging camera (MLX90640) on Advanced Expansion Board for identifying shorted PCB components.",
    "heroMetricLabel": "MAX BOARD TEMP",
    "heroMetricUnit": "°C",
    "defaultSetpoint": 45,
    "minVal": 15,
    "maxVal": 150,
    "pinsUsed": [
      "Advanced Expansion Slave (STM32F303CB)",
      "I2C2 MLX90640 Thermal Sensor"
    ],
    "features": [
      "32x24 IR Matrix Heatmap",
      "Short Circuit Auto-Detect",
      "Over-temperature Alarm"
    ],
    "iconFrames": [
      "THERM_1",
      "THERM_2",
      "THERM_3",
      "THERM_4"
    ],
    "kind": "telemetry",
    "shortName": "Thermal Inspection",
    "expansionBoard": "required"
  },
  {
    "id": 23,
    "name": "Solder Paste Jetting Valve",
    "category": "Expansion (v0.1)",
    "description": "Piezoelectric droplet dispenser for jetting sub-milligram solder paste droplets onto 0201 passives and fine-pitch QFN pads.",
    "heroMetricLabel": "JET FREQ",
    "heroMetricUnit": "Hz",
    "defaultSetpoint": 150,
    "minVal": 10,
    "maxVal": 500,
    "pinsUsed": [
      "Advanced Expansion Slave TIM1 PWM (Sub-ms precision)",
      "PB1 (Heated Nozzle)"
    ],
    "features": [
      "Sub-millisecond Local PWM",
      "Viscosity Thermal Control",
      "Droplet Count Profiler"
    ],
    "iconFrames": [
      "JET_1",
      "JET_2",
      "JET_3",
      "JET_4"
    ],
    "kind": "actuator",
    "shortName": "Paste Jetting",
    "expansionBoard": "required",
    "panel": {
      "sections": [
        {
          "title": {
            "key": "testertool.paste_pwm_title",
            "default": "PWM Config (0x230)"
          },
          "controls": [
            {
              "id": "channel",
              "type": "number",
              "label": {
                "key": "testertool.channel_label",
                "default": "Channel (0-3)"
              },
              "min": 0,
              "max": 3,
              "default": 0
            },
            {
              "id": "freq",
              "type": "number",
              "label": {
                "key": "testertool.frequency_label",
                "default": "Frequency (Hz)"
              },
              "min": 1,
              "max": 65535,
              "default": 1000
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.configure",
                "default": "Configure"
              },
              "message": "PASTE_JETTING_CONFIG",
              "canId": 560,
              "encoder": "pasteJettingConfig",
              "args": [
                "channel",
                "freq"
              ],
              "description": "Paste jetting config"
            }
          ]
        },
        {
          "title": {
            "key": "testertool.paste_fire_title",
            "default": "Fire Pulse (0x231)"
          },
          "subtitle": {
            "key": "testertool.paste_fire_subtitle",
            "default": "Reuses the last-configured channel."
          },
          "controls": [
            {
              "id": "duty",
              "type": "number",
              "label": {
                "key": "testertool.duty_label",
                "default": "Duty (%)"
              },
              "min": 0,
              "max": 100,
              "default": 50
            },
            {
              "id": "pulse",
              "type": "number",
              "label": {
                "key": "testertool.duration_ms_label",
                "default": "Duration (ms)"
              },
              "min": 1,
              "max": 255,
              "default": 50
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.fire_pulse",
                "default": "Fire Pulse"
              },
              "message": "PASTE_JETTING_PULSE",
              "canId": 561,
              "encoder": "pasteJettingPulse",
              "args": [
                "channel",
                "duty",
                "pulse"
              ],
              "description": "Paste jetting pulse",
              "confirm": "paste"
            }
          ]
        }
      ]
    }
  },
  {
    "id": 24,
    "name": "Ultrasonic Plastic Welder",
    "category": "Expansion (v0.1)",
    "description": "28kHz high-frequency ultrasonic transducer driver for sealing plastic enclosures and staking mechanical pins.",
    "heroMetricLabel": "WELD TIME",
    "heroMetricUnit": "ms",
    "defaultSetpoint": 400,
    "minVal": 50,
    "maxVal": 2000,
    "pinsUsed": [
      "PB0 (Ultrasonic Generator Enable)",
      "PA1 (Acoustic Amplitude ADC)"
    ],
    "features": [
      "Resonance Frequency Lock",
      "Weld Energy Integration",
      "Solidification Hold Time"
    ],
    "iconFrames": [
      "SONIC_1",
      "SONIC_2",
      "SONIC_3",
      "SONIC_4"
    ],
    "kind": "actuator",
    "shortName": "Ultrasonic Welder",
    "expansionBoard": "recommended",
    "panel": {
      "sections": [
        {
          "title": {
            "text": "Ultrasonic Welder (0x200)"
          },
          "subtitle": {
            "key": "testertool.weld_subtitle_ungated",
            "default": "No contact-sensor gate."
          },
          "controls": [
            {
              "id": "ms",
              "type": "number",
              "label": {
                "key": "testertool.pulse_duration_label",
                "default": "Pulse duration (1-{{max}} ms)"
              },
              "min": 1,
              "max": 2000,
              "default": 200
            }
          ],
          "actions": [
            {
              "type": "send",
              "label": {
                "key": "testertool.fire_pulse",
                "default": "Fire Pulse"
              },
              "message": "ULTRASONIC_WELD_CMD",
              "canId": 512,
              "encoder": "weldFire",
              "args": [
                "ms"
              ],
              "description": "Ultrasonic Welder (0x200) fire",
              "confirm": "weld"
            }
          ]
        }
      ]
    }
  }
];
