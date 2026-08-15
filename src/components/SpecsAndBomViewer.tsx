import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOM_ITEMS } from '../data/toolsData';
import { FileText, Cpu, Layers, HardDrive, Search, CheckCircle2 } from 'lucide-react';

const CATEGORY_KEYS: Record<string, string> = {
  'All': 'specs.cat_all',
  'Microcontroller': 'specs.cat_microcontroller',
  'Motor Driver': 'specs.cat_motor_driver',
  'Memory': 'specs.cat_memory',
  'Interface': 'specs.cat_interface',
  'Power': 'specs.cat_power',
  'Display': 'specs.cat_display',
  'Sensor': 'specs.cat_sensor',
  'Connector': 'specs.cat_connector'
};

export const SpecsAndBomViewer: React.FC = () => {
  const { t } = useTranslation();
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
              {t('specs.mcu_badge', 'MCU')}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{t('specs.mcu_name', 'STM32F303CCT6')}</div>
              <div className="text-[11px] text-slate-400">{t('specs.mcu_desc', '72MHz Cortex-M4 • 256KB Flash • 40KB SRAM')}</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
              {t('specs.exp_badge', 'EXP')}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{t('specs.exp_name', '20-Pin Expansion Connector')}</div>
              <div className="text-[11px] text-slate-400">{t('specs.exp_desc', '24V/5V/3.3V • SPI • I2C • STEP/DIR • DIAG0')}</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
              {t('specs.mem_badge', 'MEM')}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{t('specs.mem_name', 'FM24CL64B Ferroelectric RAM')}</div>
              <div className="text-[11px] text-slate-400">{t('specs.mem_desc', '64Kb Non-Volatile Persistence (10¹⁴ Cycles)')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 20-Pin Expansion Connector Pinout Reference Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-amber-400" />
          {t('specs.pinout_title', 'URTC 20-Pin Expansion Connector Pinout (Header 2x10)')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <div className="text-amber-400 font-bold border-b border-slate-800 pb-1">{t('specs.power_title', 'POWER & MOTION PINS')}</div>
            <div className="text-slate-300">{t('specs.power_pins1234', 'Pins 1, 2, 3, 4:')} <span className="text-amber-300">{t('specs.power_pins1234_val', '24V Power Supply (4 Pins)')}</span></div>
            <div className="text-slate-300">{t('specs.power_pin5', 'Pin 5:')} <span className="text-emerald-400">{t('specs.power_pin5_val', '3.3V Logic Supply')}</span></div>
            <div className="text-slate-300">{t('specs.power_pin6', 'Pin 6:')} <span className="text-cyan-400">{t('specs.power_pin6_val', '5V Peripheral Power')}</span></div>
            <div className="text-slate-300">{t('specs.power_pins789', 'Pins 7, 8, 9:')} <span className="text-slate-400">{t('specs.power_pins789_val', 'GND Return (3 Pins)')}</span></div>
            <div className="text-slate-300">{t('specs.power_pins101112', 'Pins 10, 11, 12:')} <span className="text-purple-400">{t('specs.power_pins101112_val', 'STEP / DIR / EN Universal Stepper')}</span></div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <div className="text-amber-400 font-bold border-b border-slate-800 pb-1">{t('specs.comm_title', 'COMMUNICATION & SENSORS')}</div>
            <div className="text-slate-300">{t('specs.comm_pins1314', 'Pins 13, 14:')} <span className="text-amber-300">{t('specs.comm_pins1314_val', 'Bit-banged I2C Bus (PB10 SCL / PB11 SDA)')}</span></div>
            <div className="text-slate-300">{t('specs.comm_pins15to18', 'Pins 15, 16, 17, 18:')} <span className="text-cyan-300">{t('specs.comm_pins15to18_val', 'Bit-banged SPI (CS/SCK/MISO/MOSI)')}</span></div>
            <div className="text-slate-300">{t('specs.comm_pin19', 'Pin 19:')} <span className="text-emerald-300">{t('specs.comm_pin19_val', 'General Purpose EXTI GPIO Interrupt')}</span></div>
            <div className="text-slate-300">{t('specs.comm_pin20', 'Pin 20:')} <span className="text-red-400">{t('specs.comm_pin20_val', 'TMC5160 DIAG0 Stall/Fault Line')}</span></div>
          </div>
        </div>
      </div>

      {/* Bill of Materials (BOM) Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              {t('specs.bom_title', 'Bill of Materials (BOM) & Key Components')}
            </h3>
            <p className="text-xs text-slate-400">
              {t('specs.bom_subtitle', 'URTC v1.1 Master Board & Advanced Expansion Slave')}
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder={t('specs.search_placeholder', 'Search BOM...')}
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
                <option key={c} value={c}>{t(CATEGORY_KEYS[c], c)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">{t('specs.th_designator', 'DESIGNATOR')}</th>
                <th className="py-2.5 px-4">{t('specs.th_part_number', 'PART NUMBER')}</th>
                <th className="py-2.5 px-4">{t('specs.th_category', 'CATEGORY')}</th>
                <th className="py-2.5 px-4">{t('specs.th_description', 'DESCRIPTION & SPECS')}</th>
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
