const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  // Preset triggers
  const handleTriggerPreset = (presetId: string) => {
    switch (presetId) {
      case '0x110':
        logCanFrame('0x110', '00 00 00 00 00 00 00 00', 'Host Query Active Tool Profile', 'Tx');
        setTimeout(() => {
          logCanFrame('0x111', \`0\${activeToolId.toString(16)} 00 00 00 00 00 00 00\`, \`URTC Response: Active Tool #\${activeToolId} (\${activeTool.name})\`, 'Rx');
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
        logCanFrame(presetId, '00 00 00 00 00 00 00 00', \`Generic predefined command \${presetId}\`, 'Tx');
        break;
    }
  };`;

const regex = /  \/\/ Preset triggers\s+const handleTriggerPreset =.*?\}\s*;\s*$/m;
code = code.replace(/  \/\/ Preset triggers[\s\S]*?    \}\n  \};\n/g, replacement + '\n');
fs.writeFileSync('src/App.tsx', code);
