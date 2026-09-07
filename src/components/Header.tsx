import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, AlertTriangle, Usb, Globe } from 'lucide-react';
import { HardwareState } from '../types';
import urtcLogoTester from '../../images/urtc_custom_icon.svg';

const LANGUAGE_STORAGE_KEY = 'urtc-web-studio-language';

interface HeaderProps {
  hardwareState: HardwareState;
  activeToolName: string;
  firmwareVersion: string;
  onSetFirmwareVersion: (ver: string) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  portName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  hardwareState,
  activeToolName,
  firmwareVersion,
  onSetFirmwareVersion,
  isConnected,
  onConnect,
  onDisconnect,
  portName
}) => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable (e.g. privacy mode) - ignore
    }
  };

  // Determine Status LED visual color
  let ledColorBg = 'bg-emerald-500 shadow-emerald-500/50';
  let ledText = t('header.led_idle', 'IDLE (GREEN)');

  if (hardwareState.systemError) {
    ledColorBg = 'bg-red-500 shadow-red-500/50 animate-pulse';
    ledText = t('header.led_fault', 'FAULT (RED)');
  } else if (hardwareState.ledMode === 'override') {
    const { r, g, b } = hardwareState.ledOverrideColor;
    ledColorBg = 'shadow-lg';
    ledText = t('header.led_custom', 'CUSTOM RGB ({{r}},{{g}},{{b}})', { r, g, b });
  } else if (hardwareState.canActive) {
    ledColorBg = 'bg-blue-500 shadow-blue-500/50 animate-pulse';
    ledText = t('header.led_can_active', 'CAN BUS ACTIVE (BLUE)');
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 md:px-4 py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src={urtcLogoTester} alt={t('header.logo_alt', 'URTC Tester Logo')} className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">{t('header.title', 'URTC Web Studio')}</h1>
                <button
                  onClick={() => onSetFirmwareVersion(firmwareVersion.startsWith('0.0') ? '0.1.0' : '0.0.0')}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-all flex items-center gap-1 ${
                    firmwareVersion.startsWith('0.0')
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  title={t('header.fw_toggle_title', 'Click to toggle simulated firmware version (v0.0.0 vs v0.1.0)')}
                >
                  <span>FW v{firmwareVersion}</span>
                  <span className="text-[10px] opacity-75">
                    ({firmwareVersion.startsWith('0.0') ? t('header.tools_count_10', '12 Tools') : t('header.tools_count_11', '25 Tools')})
                  </span>
                </button>
              </div>
              <p className="text-xs text-slate-400">{t('header.subtitle', 'Universal Robot Tool Controller • Open Hardware Studio')}</p>
            </div>
          </div>

          {/* Real-time Hardware Indicators */}
          <div className="flex items-center gap-2 md:gap-4 text-xs font-mono flex-wrap justify-end">
            {/* Language Switcher */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={i18n.language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
              >
                <option value="en" className="bg-slate-800">{t('config.language_en', 'English')}</option>
                <option value="es" className="bg-slate-800">{t('config.language_es', 'Español')}</option>
                <option value="it" className="bg-slate-800">{t('config.language_it', 'Italiano')}</option>
                <option value="fr" className="bg-slate-800">{t('config.language_fr', 'Français')}</option>
                <option value="de" className="bg-slate-800">{t('config.language_de', 'Deutsch')}</option>
                <option value="zh" className="bg-slate-800">{t('config.language_zh', '简体中文')}</option>
                <option value="ja" className="bg-slate-800">{t('config.language_ja', '日本語')}</option>
              </select>
            </div>

            {/* Active Tool Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">{t('header.tool_label', 'Tool:')}</span>
              <span className="text-amber-300 font-semibold">{activeToolName}</span>
            </div>

            {/* Status LED Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <span
                className={`w-2.5 h-2.5 rounded-full shadow-sm ${ledColorBg}`}
                style={
                  hardwareState.ledMode === 'override'
                    ? {
                        backgroundColor: `rgb(${hardwareState.ledOverrideColor.r},${hardwareState.ledOverrideColor.g},${hardwareState.ledOverrideColor.b})`,
                        boxShadow: `0 0 8px rgb(${hardwareState.ledOverrideColor.r},${hardwareState.ledOverrideColor.g},${hardwareState.ledOverrideColor.b})`
                      }
                    : undefined
                }
              />
              <span className="text-slate-300 font-medium">{ledText}</span>
            </div>

            {/* Connect Button */}
            {isConnected ? (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900/50 transition-colors"
                title={t('header.disconnect_title', 'Disconnect from USB CAN')}
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{portName || t('header.connected_fallback', 'Connected')}</span>
              </button>
            ) : (
              <button
                onClick={onConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                title={t('header.connect_title', 'Connect USB CAN adapter via Web Serial')}
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{t('header.connect_button', 'Connect Hardware')}</span>
              </button>
            )}

            {/* System Error Indicator */}
            {hardwareState.systemError && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/80 text-red-400 border border-red-800/80 font-medium animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>{t('header.fault_badge', 'FAULT')}</span>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
