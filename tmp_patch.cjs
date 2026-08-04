const fs = require('fs');
let code = fs.readFileSync('src/components/CanBusAnalyzer.tsx', 'utf8');

const replacement = `        {/* Preset Command Triggers */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="text-xs font-semibold text-slate-300 mb-3">Predefined URTC Protocol Messages (docs/CANBUS.TXT):</div>
          
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">System & Configuration</div>
              <div className="flex flex-wrap gap-2">
                {[
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
                  { label: '0x1A5 Query Device Serial', id: '0x1A5' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-amber-500" />{p.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Tool-Specific Control & Telemetry</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '0x095 Touch Probe Impact', id: '0x095' },
                  { label: '0x120 Stepper Control', id: '0x120' },
                  { label: '0x130 T12 Setpoint (Iron)', id: '0x130' },
                  { label: '0x140 BL4260 Speed (Drill)', id: '0x140' },
                  { label: '0x150 Ring Control (AOI)', id: '0x150' },
                  { label: '0x160 Laser Power (Engraver)', id: '0x160' },
                  { label: '0x170 Thermal+Extruder (3D)', id: '0x170' },
                  { label: '0x173 Delta Fan PWM (3D)', id: '0x173' },
                  { label: '0x178 Hotend Fan PWM (3D)', id: '0x178' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-cyan-500" />{p.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono text-slate-500 mb-1.5 uppercase tracking-wider">Bootloader (CAN-OTA)</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '0x7F0 Enter Bootloader', id: '0x7F0' },
                  { label: '0x7F1 Start Update', id: '0x7F1' },
                  { label: '0x7F4 End Update / Verify', id: '0x7F4' },
                  { label: '0x7F8 Query Version', id: '0x7F8' }
                ].map((p) => (
                  <button key={p.id} onClick={() => onTriggerPreset(p.id)} className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 text-[10px] font-mono transition flex items-center gap-1"><Play className="w-2.5 h-2.5 text-emerald-500" />{p.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>`;

const regex = /\{\/\* Preset Command Triggers \*\/\}.*?<\/button>\s*\}\)\}\s*<\/div>\s*<\/div>/s;
if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('src/components/CanBusAnalyzer.tsx', code);
} else {
  console.log("Could not find regex match!");
}
