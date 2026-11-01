// =============================================================================
// URTC Web Studio - what a tool profile says about its own panel
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// The summary panel of a tool is written from its profile (spec/tools.json of URTC-COMMON, generated into generated/urtcTools.ts) and
// from nothing else: a profile that changes there changes the panel here, with no screen to edit by hand.
import type { UrtcToolProfile } from './generated/urtcTools';

export interface ToolProfileView {
  id: number;
  title: string;
  description: string;
  heroLabel: string;
  unit: string;
  minVal: number;
  maxVal: number;
  defaultSetpoint: number;
  watchdogMs: number | null;
  pins: string[];
  features: string[];
  expansionBoard: UrtcToolProfile['expansionBoard'];
}

export function toolProfileView(profile: UrtcToolProfile): ToolProfileView {
  return {
    id: profile.id,
    title: profile.shortName,
    description: profile.description,
    heroLabel: profile.heroMetricLabel,
    unit: profile.heroMetricUnit,
    minVal: profile.minVal,
    maxVal: profile.maxVal,
    defaultSetpoint: profile.defaultSetpoint,
    watchdogMs: profile.watchdogMs ?? null,
    pins: [...profile.pinsUsed],
    features: [...profile.features],
    expansionBoard: profile.expansionBoard,
  };
}

/** "min to max unit" of the hero metric, the way the panel shows its range. */
export function rangeText(view: Pick<ToolProfileView, 'minVal' | 'maxVal' | 'unit'>): string {
  return `${view.minVal} ... ${view.maxVal}${view.unit ? ` ${view.unit}` : ''}`;
}
