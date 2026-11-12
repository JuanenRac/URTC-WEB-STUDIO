import React from 'react';
import { useTranslation } from 'react-i18next';
import { URTC_TOOL_PROFILES } from '../../lib/generated/urtcTools';
import { rangeText, toolProfileView } from '../../lib/toolProfileView';
import { Section } from './shared';

// The summary of the tool the board reports, written from its profile in URTC-COMMON (limits, watchdog, pins, features): the same data
// the Tool Catalog shows, so a change of profile reaches this panel without editing it. The wording reuses the Tool Catalog texts.
const ToolProfilePanelBody: React.FC<{ toolId: number }> = ({ toolId }) => {
  const { t } = useTranslation();
  const profile = URTC_TOOL_PROFILES.find(p => p.id === toolId);
  if (!profile) return null;
  const view = toolProfileView(profile);
  return (
    <Section title={`#${view.id} ${view.title}`} subtitle={view.description}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono" data-testid="tool-profile">
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-500">{view.heroLabel}</div>
          <div className="text-slate-200" data-testid="tool-profile-range">{rangeText(view)}</div>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-500">{t('toolcatalog.watchdog_label', 'WATCHDOG')}</div>
          <div className="text-slate-200">{view.watchdogMs !== null ? `${view.watchdogMs}ms ${t('toolcatalog.watchdog_active', 'ACTIVE')}` : t('toolcatalog.watchdog_none', 'NO TIMEOUT')}</div>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800 col-span-2">
          <div className="text-slate-500">{t('toolcatalog.pin_mapping_title', 'Hardware Pin Mapping & Signals')}</div>
          <div className="text-slate-300">{view.pins.join(' | ')}</div>
        </div>
        <div className="p-2 rounded bg-slate-950 border border-slate-800 col-span-2 md:col-span-4">
          <div className="text-slate-500">{t('toolcatalog.capabilities_title', 'Firmware Capabilities')}</div>
          <div className="text-slate-300">{view.features.join(' | ')}</div>
        </div>
      </div>
    </Section>
  );
};

// Memoized: the page draws again on every frame that reaches it, and the context it hands down is one stable object, so a panel is drawn again only when its own state or props change.
export const ToolProfilePanel = React.memo(ToolProfilePanelBody);
