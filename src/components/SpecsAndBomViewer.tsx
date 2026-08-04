import React, { useState } from 'react';
import { BOM_ITEMS } from '../data/toolsData';
import { FileText, Cpu, Layers, HardDrive, Search, CheckCircle2 } from 'lucide-react';

export const SpecsAndBomViewer: React.FC = () => {
  const [bomFilter, setBomFilter] = useState<string>('All');
  const [bomSearch, setBomSearch] = useState<string>('');

  const categories = ['All', 'Microcontroller', 'Motor Driver', 'Memory', 'Interface', 'Power', 'Display', 'Sensor', 'Connector'];

  const filteredBom = BOM_ITEMS.filter(item => {
    const matchesCat = bomFilter === 'All' || item.category === bomFilter;
    const matchesSearch = item.part.toLowerCase().includes(bomSearch.toLowerCase()) ||
                          item.desc.toLowerCase().includes(bomSearch.toLowerCase()) ||
                          item.ref.toLowerCase().includes(bomSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              MCU
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">STM32F303CCT6</div>
              <div className="text-[11px] text-slate-400">72MHz Cortex-M4 • 256KB Flash • 40KB SRAM</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
              EXP
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">20-Pin Expansion Connector</div>
              <div className="text-[11px] text-slate-400">24V/5V/3.3V • SPI • I2C • STEP/DIR • DIAG0</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
              MEM
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">FM24CL64B Ferroelectric RAM</div>
              <div className="text-[11px] text-slate-400">64Kb Non-Volatile Persistence (10¹⁴ Cycles)</div>
            </div>
          </div>
        </div>
      </div>

      {/* 20-Pin Expansion Connector Pinout Reference Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-amber-400" />
          URTC 20-Pin Expansion Connector Pinout (Header 2x10)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <div className="text-amber-400 font-bold border-b border-slate-800 pb-1">POWER & MOTION PINS</div>
            <div className="text-slate-300">Pins 1, 2, 3, 4: <span className="text-amber-300">24V Power Supply (4 Pins)</span></div>
            <div className="text-slate-300">Pin 5: <span className="text-emerald-400">3.3V Logic Supply</span></div>
            <div className="text-slate-300">Pin 6: <span className="text-cyan-400">5V Peripheral Power</span></div>
            <div className="text-slate-300">Pins 7, 8, 9: <span className="text-slate-400">GND Return (3 Pins)</span></div>
            <div className="text-slate-300">Pins 10, 11, 12: <span className="text-purple-400">STEP / DIR / EN Universal Stepper</span></div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <div className="text-amber-400 font-bold border-b border-slate-800 pb-1">COMMUNICATION & SENSORS</div>
            <div className="text-slate-300">Pins 13, 14: <span className="text-amber-300">Bit-banged I2C Bus (PB10 SCL / PB11 SDA)</span></div>
            <div className="text-slate-300">Pins 15, 16, 17, 18: <span className="text-cyan-300">Bit-banged SPI (CS/SCK/MISO/MOSI)</span></div>
            <div className="text-slate-300">Pin 19: <span className="text-emerald-300">General Purpose EXTI GPIO Interrupt</span></div>
            <div className="text-slate-300">Pin 20: <span className="text-red-400">TMC5160 DIAG0 Stall/Fault Line</span></div>
          </div>
        </div>
      </div>

      {/* Bill of Materials (BOM) Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Bill of Materials (BOM) & Key Components
            </h3>
            <p className="text-xs text-slate-400">
              URTC v1.1 Master Board & Advanced Expansion Slave
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search BOM..."
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <select
              value={bomFilter}
              onChange={(e) => setBomFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">DESIGNATOR</th>
                <th className="py-2.5 px-4">PART NUMBER</th>
                <th className="py-2.5 px-4">CATEGORY</th>
                <th className="py-2.5 px-4">DESCRIPTION & SPECS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredBom.map((item, i) => (
                <tr key={i} className="hover:bg-slate-850 transition">
                  <td className="py-2.5 px-4 font-bold text-amber-400">{item.ref}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-100">{item.part}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 font-sans">{item.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
