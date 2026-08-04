import React from 'react';
import { Cpu, Tv, Radio, RefreshCw, Thermometer, FileText, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activeTab: 'control' | 'oled' | 'can' | 'flasher' | 'thermal' | 'specs' | 'tester';
  setActiveTab: (tab: 'control' | 'oled' | 'can' | 'flasher' | 'thermal' | 'specs' | 'tester') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 hidden md:block">
      <nav className="flex flex-col gap-1 p-4 sticky top-[80px]">
        <button
          onClick={() => setActiveTab('control')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'control'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cpu className="w-5 h-5" />
          <span>Tool Matrix & Control</span>
        </button>

        <button
          onClick={() => setActiveTab('oled')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'oled'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span>OLED & Hardware Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab('can')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'can'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Radio className="w-5 h-5" />
          <span>CAN Bus Protocol Analyzer</span>
        </button>

        <button
          onClick={() => setActiveTab('flasher')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'flasher'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <RefreshCw className="w-5 h-5" />
          <span>Firmware OTA / Flasher</span>
        </button>

        <button
          onClick={() => setActiveTab('thermal')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'thermal'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Thermometer className="w-5 h-5" />
          <span>Thermal IR Inspection</span>
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'specs'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>BOM & Hardware Pinouts</span>
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'tester'
              ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span>Tester Diagnostics</span>
        </button>
      </nav>
    </aside>
  );
};
