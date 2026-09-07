import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RotateCcw, Moon, Sun, Monitor, AlertOctagon } from 'lucide-react';
import { ToolProfile, HardwareState } from '../types';

interface OledDisplayProps {
  activeTool: ToolProfile | undefined;
  setpoint: number;
  liveReading: number;
  hardwareState: HardwareState;
  invalidToolId: boolean;
  onResetSplash: () => void;
  firmwareVersion?: string;
}

export const OledDisplay: React.FC<OledDisplayProps> = ({
  activeTool,
  setpoint,
  liveReading,
  hardwareState,
  invalidToolId,
  onResetSplash,
  firmwareVersion = '0.1.0'
}) => {
  const { t } = useTranslation();
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [canDot, setCanDot] = useState<boolean>(true);
  const [splashFrame, setSplashFrame] = useState<number>(0);

  const isFirmware10 = firmwareVersion.startsWith('0.0');
  const isToolSupported = !activeTool || activeTool.id < 12 || !isFirmware10;

  // Animate 4-frame tool icon every 250ms
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % 4);
      setCanDot(prev => !prev);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Splash screen animation timer
  useEffect(() => {
    if (hardwareState.oledShowSplash) {
      const splashTimer = setInterval(() => {
        setSplashFrame(prev => (prev + 1) % 8);
      }, 150);
      return () => clearInterval(splashTimer);
    }
  }, [hardwareState.oledShowSplash]);

  const isInverted = hardwareState.oledInverted;
  const isNight = hardwareState.oledNightMode;

  // Background and Text colors based on physical two-tone display
  const containerBg = isNight ? 'bg-slate-950/90' : 'bg-black';
  const yellowText = isInverted ? 'bg-amber-400 text-black' : 'text-amber-400';
  const blueText = isInverted ? 'bg-cyan-400 text-black' : 'text-cyan-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-amber-400" />
            {t('oled.title', 'SSD1306 / SSD1315 OLED (128x64 Two-Tone)')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('oled.subtitle', 'Hardware I2C2 Bus (PA9/PA10) • Top 16px Yellow / Bottom 48px Blue')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onResetSplash}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
            title={t('oled.replay_splash_title', 'Replay boot splash animation')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('oled.replay_splash', 'Replay Splash')}</span>
          </button>
        </div>
      </div>

      {/* Realistic OLED Bezel Container */}
      <div className="relative mx-auto max-w-lg p-3 bg-slate-950 border-4 border-slate-800 rounded-2xl shadow-2xl">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono tracking-widest text-slate-600">
          {t('oled.bezel_label', 'SSD1306/1315 0.96" OLED')}
        </div>

        {/* OLED Screen Area (128x64 Ratio box) */}
        <div
          className={`w-full aspect-[2/1] ${containerBg} border border-slate-800 rounded-lg overflow-hidden p-2 font-mono select-none transition-opacity ${
            isNight ? 'opacity-70' : 'opacity-100'
          }`}
          style={{
            boxShadow: 'inset 0 0 12px rgba(0,0,0,0.9)'
          }}
        >
          {/* Top 16px: YELLOW ZONE */}
          <div className={`h-[25%] border-b border-amber-500/20 px-2 flex items-center justify-between text-xs font-bold tracking-tight ${yellowText}`}>
            {hardwareState.oledShowSplash ? (
              <span className="text-[11px]">{t('oled.booting', 'URTC BOOTING... v{{version}}', { version: firmwareVersion })}</span>
            ) : invalidToolId ? (
              <span className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertOctagon className="w-3 h-3" /> {t('oled.unassigned_id', 'UNASSIGNED JUMPER ID')}
              </span>
            ) : !isToolSupported ? (
              <span className="text-[11px] text-amber-400 flex items-center gap-1 animate-pulse">
                <AlertOctagon className="w-3 h-3 text-amber-400" /> {t('oled.unsupported_err', 'ERR: FW 1.0 UNSUPPORTED ID')}
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2 truncate max-w-[75%]">
                  <span className="truncate">{activeTool?.heroMetricLabel || t('oled.system_ready', 'SYSTEM READY')}</span>
                  <span className="text-white bg-amber-500/30 px-1 rounded text-[10px]">
                    {liveReading.toFixed(1)} {activeTool?.heroMetricUnit}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-amber-300/80">{t('oled.can_label', 'CAN')}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      canDot ? 'bg-amber-400 shadow-amber-400 shadow-sm' : 'bg-slate-700'
                    }`}
                  />
                </div>
              </>
            )}
          </div>

          {/* Bottom 48px: BLUE ZONE */}
          <div className={`h-[75%] px-2 py-1 flex flex-col justify-between ${blueText}`}>
            {hardwareState.oledShowSplash ? (
              /* Animated Boot Splash Screen */
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="text-base font-bold tracking-widest text-cyan-300 animate-pulse">
                  {t('oled.boot_os_name', 'JuanenBOT OS')}
                </div>
                <div className="text-[10px] text-cyan-500 mt-1 font-mono">
                  [ { '█'.repeat((splashFrame % 8) + 1) }{ '░'.repeat(7 - (splashFrame % 8)) } ]
                </div>
                <div className="text-[9px] text-slate-400 mt-1">
                  {t('oled.boot_chip', 'STM32F303CC • FW v{{version}}', { version: firmwareVersion })}
                </div>
              </div>
            ) : invalidToolId ? (
              /* Invalid Tool ID / Unassigned Warning Frame */
              <div className="h-full flex flex-col items-center justify-center text-center text-red-400">
                <div className="text-lg font-extrabold tracking-widest animate-bounce">
                  ⚠️ {t('oled.error_banner', 'ERROR')} ⚠️
                </div>
                <div className="text-[10px] text-red-300 font-semibold mt-1">
                  {t('oled.unassigned_title', 'JUMPER ID NOT ASSIGNED')}
                </div>
                <div className="text-[9px] text-slate-400">
                  {t('oled.unassigned_body', 'Select 0..24 or 31 (Free Config)')}
                </div>
              </div>
            ) : !isToolSupported ? (
              /* Unsupported Tool ID in Firmware v0.0.0 */
              <div className="h-full flex flex-col items-center justify-center text-center text-amber-300">
                <div className="text-base font-extrabold tracking-tight text-amber-400">
                  {t('oled.locked_title', 'TOOL #{{id}} LOCKED 🔒', { id: activeTool?.id })}
                </div>
                <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                  {t('oled.locked_requires', 'REQUIRES FIRMWARE v0.1.0')}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {t('oled.locked_supports', 'FW 1.0 supports Tools 0..11')}
                </div>
              </div>
            ) : (
              /* Active Tool Telemetry & Animated Icon */
              <div className="h-full flex items-center justify-between gap-2">
                {/* 4-Frame Animated Tool Graphic Representation */}
                <div className="w-16 h-12 bg-cyan-950/40 border border-cyan-500/30 rounded flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Visual Pixel Graphic */}
                  <div className="text-2xl transition-transform duration-200">
                    {frameIndex % 2 === 0 ? '⚡' : '⚙️'}
                  </div>
                  <div className="text-[9px] font-bold text-cyan-300 mt-0.5">
                    {t('oled.frame_label', 'FRAME {{n}}/4', { n: frameIndex + 1 })}
                  </div>
                </div>

                {/* Telemetry Numbers */}
                <div className="flex-1 flex flex-col justify-center text-right font-mono text-xs">
                  <div className="text-slate-400 text-[10px]">{t('oled.setpoint_label', 'SETPOINT')}</div>
                  <div className="text-sm font-bold text-cyan-200">
                    {setpoint.toFixed(1)} <span className="text-[10px]">{activeTool?.heroMetricUnit}</span>
                  </div>
                  <div className="text-slate-400 text-[10px] mt-1">{t('oled.target_diff_label', 'TARGET DIFF')}</div>
                  <div className="text-xs text-cyan-400 font-semibold">
                    {(liveReading - setpoint).toFixed(1)} {activeTool?.heroMetricUnit}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OLED Pinout Silkscreen Note */}
        <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-500">
          <span>{t('oled.pinout1', 'PA9 (SCK) • PA10 (SDA)')}</span>
          <span>{t('oled.pinout2', '+3V3B • GND')}</span>
        </div>
      </div>
    </div>
  );
};
