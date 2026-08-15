import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Thermometer, Zap, AlertTriangle, RefreshCw, Eye } from 'lucide-react';

export const ThermalCameraViewer: React.FC = () => {
  const { t } = useTranslation();
  const [palette, setPalette] = useState<'ironbow' | 'rainbow' | 'mono'>('ironbow');
  const [hasShort, setHasShort] = useState<boolean>(true);
  const [hoverTemp, setHoverTemp] = useState<{ x: number; y: number; temp: number } | null>(null);

  // Generate 32x24 matrix of temperatures (°C)
  const cols = 32;
  const rows = 24;

  const [grid, setGrid] = useState<number[][]>([]);

  useEffect(() => {
    // Generate initial grid with background ~25°C and hot spot ~85°C if hasShort is true
    const newGrid: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        // Base ambient temp with slight noise
        let t = 24 + Math.random() * 2;

        // If shorted component is active, simulate a hot FET at col 18, row 10
        if (hasShort) {
          const dx = c - 18;
          const dy = r - 10;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6) {
            t += (85 - t) * Math.exp(-dist * 0.4);
          }
        }

        // IC chip 1 at col 8, row 6
        const dx1 = c - 8;
        const dy1 = r - 6;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        if (dist1 < 4) {
          t += (45 - t) * Math.exp(-dist1 * 0.5);
        }

        row.push(t);
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
  }, [hasShort]);

  // Color mapping helper
  const getCellColor = (temp: number): string => {
    // Normalization between 20°C and 90°C
    const min = 20;
    const max = 90;
    const ratio = Math.max(0, Math.min(1, (temp - min) / (max - min)));

    if (palette === 'mono') {
      const v = Math.floor(ratio * 255);
      return `rgb(${v},${v},${v})`;
    } else if (palette === 'rainbow') {
      const h = (1 - ratio) * 240; // 240 is blue, 0 is red
      return `hsl(${h}, 100%, 50%)`;
    } else {
      // Ironbow
      if (ratio < 0.33) {
        const r = Math.floor((ratio / 0.33) * 128);
        return `rgb(${r}, 0, ${Math.floor(ratio * 255)})`;
      } else if (ratio < 0.66) {
        const r = Math.floor(128 + ((ratio - 0.33) / 0.33) * 127);
        const g = Math.floor(((ratio - 0.33) / 0.33) * 200);
        return `rgb(${r}, ${g}, 0)`;
      } else {
        const g = Math.floor(200 + ((ratio - 0.66) / 0.34) * 55);
        return `rgb(255, ${g}, ${Math.floor(((ratio - 0.66) / 0.34) * 255)})`;
      }
    }
  };

  // Find max temp location
  let maxTemp = 0;
  let maxCoords = { r: 0, c: 0 };
  grid.forEach((row, r) => {
    row.forEach((t, c) => {
      if (t > maxTemp) {
        maxTemp = t;
        maxCoords = { r, c };
      }
    });
  });

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-amber-400" />
              {t('thermal.title', 'MLX90640 32x24 Thermal Infrared Camera Array')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('thermal.subtitle', 'Advanced Expansion Board (STM32F303CB Slave) • Short Circuit Thermal Inspection')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Palette Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setPalette('ironbow')}
                className={`px-2.5 py-1 rounded ${palette === 'ironbow' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'}`}
              >
                {t('thermal.palette_ironbow', 'Ironbow')}
              </button>
              <button
                onClick={() => setPalette('rainbow')}
                className={`px-2.5 py-1 rounded ${palette === 'rainbow' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'}`}
              >
                {t('thermal.palette_rainbow', 'Rainbow')}
              </button>
              <button
                onClick={() => setPalette('mono')}
                className={`px-2.5 py-1 rounded ${palette === 'mono' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'}`}
              >
                {t('thermal.palette_mono', 'Monochrome')}
              </button>
            </div>

            <button
              onClick={() => setHasShort(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                hasShort
                  ? 'bg-red-500/20 text-red-300 border-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {hasShort ? t('thermal.short_simulated', '🔥 Short Circuit Simulated (85°C)') : t('thermal.normal_flow', '✅ Normal PCB Thermal Flow')}
            </button>
          </div>
        </div>

        {/* Thermal Canvas Display */}
        <div className="relative mx-auto max-w-2xl bg-slate-950 p-4 border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
            <span>{t('thermal.frame_label', 'MLX90640 IR FRAME (32 × 24 = 768 PIXELS)')}</span>
            <span className="text-amber-400 font-bold">
              {t('thermal.max_temp', 'MAX TEMP: {{temp}}°C', { temp: maxTemp.toFixed(1) })} {hasShort && t('thermal.short_detected', '⚠️ SHORT DETECTED')}
            </span>
          </div>

          {/* Grid Render */}
          <div
            className="grid gap-[1px] bg-slate-900 border border-slate-800 rounded overflow-hidden cursor-crosshair"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`
            }}
          >
            {grid.map((row, r) =>
              row.map((t, c) => {
                const isHotSpot = r === maxCoords.r && c === maxCoords.c && hasShort;

                return (
                  <div
                    key={`${r}-${c}`}
                    onMouseEnter={() => setHoverTemp({ x: c, y: r, temp: t })}
                    onMouseLeave={() => setHoverTemp(null)}
                    className="aspect-square relative transition-opacity hover:opacity-80"
                    style={{ backgroundColor: getCellColor(t) }}
                  >
                    {isHotSpot && (
                      <span className="absolute inset-0 border-2 border-red-500 animate-ping rounded-full" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Thermal Legend Bar */}
          <div className="mt-3 flex items-center gap-3 font-mono text-xs">
            <span className="text-slate-400">{t('thermal.legend_min', '20°C')}</span>
            <div
              className="flex-1 h-3 rounded border border-slate-800"
              style={{
                background:
                  palette === 'mono'
                    ? 'linear-gradient(to right, rgb(0,0,0), rgb(255,255,255))'
                    : palette === 'rainbow'
                    ? 'linear-gradient(to right, hsl(240,100%,50%), hsl(120,100%,50%), hsl(0,100%,50%))'
                    : 'linear-gradient(to right, rgb(0,0,0), rgb(128,0,255), rgb(255,128,0), rgb(255,255,255))'
              }}
            />
            <span className="text-amber-400 font-bold">{t('thermal.legend_max', '90°C')}</span>
          </div>

          {/* Hover Crosshair Info */}
          <div className="mt-2 text-[11px] font-mono text-slate-400 flex justify-between">
            <span>
              {hoverTemp ? t('thermal.hover_probe', 'PROBE POS: [X:{{x}}, Y:{{y}}] = {{temp}}°C', { x: hoverTemp.x, y: hoverTemp.y, temp: hoverTemp.temp.toFixed(1) }) : t('thermal.hover_prompt', 'Hover over grid to probe temperature')}
            </span>
            <span>{t('thermal.mode_label', 'Reflow/Short Inspection Mode')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
