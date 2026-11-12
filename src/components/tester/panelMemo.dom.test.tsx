// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { panelOf } from '../../lib/toolPanelView';
import { GeneratedToolPanel } from './GeneratedToolPanel';
import type { ToolCtx } from './ToolPanels';

// Every draw of the panel asks for the translation function once, so the number of calls is the number of draws.
const draws = vi.hoisted(() => ({ count: 0 }));
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return { ...actual, useTranslation: (...args: Parameters<typeof actual.useTranslation>) => { draws.count++; return actual.useTranslation(...args); } };
});

i18n.use(initReactI18next).init({ lng: 'en', resources: {}, interpolation: { escapeValue: false } });

afterEach(cleanup);

function makeCtx(): ToolCtx {
  return {
    sendFrame: vi.fn(async () => undefined),
    waitForFrame: vi.fn(async () => null),
    request: vi.fn(async () => null),
    flushFrames: vi.fn(),
    subscribe: () => () => undefined,
    isConnected: false,
  } as unknown as ToolCtx;
}

// The page draws again on every frame that reaches it. The panels are memoized so that only the ones whose own state or props changed are drawn again.
describe('a panel of the tester page', () => {
  it('is not drawn again when the page draws again with the same context, and is when the context changes', () => {
    const panel = panelOf(0)!;
    const ctx = makeCtx();
    const Page: React.FC<{ frame: number; context: ToolCtx }> = ({ frame, context }) => (
      <div data-frame={frame}><GeneratedToolPanel ctx={context} panel={panel} toolName="Tool" /></div>
    );
    const { rerender } = render(<Page frame={1} context={ctx} />);
    const afterFirstDraw = draws.count;
    expect(afterFirstDraw).toBeGreaterThan(0);
    for (let frame = 2; frame < 8; frame++) rerender(<Page frame={frame} context={ctx} />);
    expect(draws.count).toBe(afterFirstDraw);
    rerender(<Page frame={9} context={makeCtx()} />);
    expect(draws.count).toBeGreaterThan(afterFirstDraw);
  });

  it('is drawn again when a prop that is not the context changes', () => {
    const panel = panelOf(0)!;
    const ctx = makeCtx();
    const { rerender } = render(<GeneratedToolPanel ctx={ctx} panel={panel} toolName="First" />);
    const first = draws.count;
    rerender(<GeneratedToolPanel ctx={ctx} panel={panel} toolName="First" />);
    expect(draws.count).toBe(first);
    rerender(<GeneratedToolPanel ctx={ctx} panel={panel} toolName="Second" />);
    expect(draws.count).toBeGreaterThan(first);
  });
});
