import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '../../lib/download';
import {
  DEFAULT_TRACE_SETTINGS, MAX_TRACE_BYTES, MAX_TRACE_ROWS, TRACE_ANOMALIES, TRACE_RESULTS, TRACE_TYPES, filterRows, parseIdList,
  sortRows, summarizeRows, timelineBuckets, traceCsv, traceJson,
  type TraceAnomaly, type TraceDirection, type TraceFilter, type TraceResult, type TraceRow, type TraceSortKey, type TraceType,
} from '../../lib/canTrace';
import { LIST_KEYS, moveActive, rowWindow, scrollTopToShow, type ListKey } from '../../lib/traceWindow';
import { useTraceLoad } from '../../hooks/useTraceLoad';
import { Field, Section, btnCls, inputCls } from './shared';

/** The table draws only the rows in view (plus a few more above and below), so a file of 200,000 frames does not freeze the page. Every row has this height. */
const ROW_HEIGHT = 24;
/** Height of the scrolling box of the table, and of its header row, in pixels. */
const VIEW_HEIGHT = 384;
const HEAD_HEIGHT = 28;
/** Width of each column in pixels (a fixed layout: the columns do not move while the rows change as the table scrolls). */
const COLUMNS = [64, 104, 56, 64, 48, 180, 210, 90, 56, 90, 130, 420];
const TABLE_WIDTH = COLUMNS.reduce((sum, width) => sum + width, 0);
const TIMELINE_BUCKETS = 60;

const rowClass = (r: TraceRow): string =>
  r.result === 'refused' || r.result === 'fault' ? 'text-red-400' : r.result === 'malformed' || r.anomalies.length > 0 ? 'text-amber-300' : '';

/** Loads a .trc / .asc recording and lists its frames named by the specification, with filters, marks, a timeline and a CSV or JSON download. Read in this page: nothing is uploaded. */
const TraceViewerPanelBody: React.FC = () => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [tooBig, setTooBig] = useState('');
  const [gapMs, setGapMs] = useState(String(DEFAULT_TRACE_SETTINGS.gapMs));
  const [dupMs, setDupMs] = useState(String(DEFAULT_TRACE_SETTINGS.duplicateWindowMs));
  const [rackIds, setRackIds] = useState('');
  const [ids, setIds] = useState('');
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const [result, setResult] = useState('');
  const [node, setNode] = useState('');
  const [mark, setMark] = useState('');
  const [fromMs, setFromMs] = useState('');
  const [toMs, setToMs] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<TraceSortKey>('index');
  const [descending, setDescending] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  const number = (value: string, fallback: number) => (value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback);
  const settings = useMemo(() => ({
    gapMs: number(gapMs, DEFAULT_TRACE_SETTINGS.gapMs),
    duplicateWindowMs: number(dupMs, DEFAULT_TRACE_SETTINGS.duplicateWindowMs),
    rackReplyIds: parseIdList(rackIds).ids,
  }), [gapMs, dupMs, rackIds]);
  const { load, parsing } = useTraceLoad(text, settings);

  const parsedIds = parseIdList(ids);
  const filter: TraceFilter = {
    ids,
    types: type ? [type as TraceType] : undefined,
    results: result ? [result as TraceResult] : undefined,
    directions: direction ? [direction as TraceDirection] : undefined,
    node: node === '' ? undefined : node === 'none' ? null : Number(node),
    anomaly: mark ? (mark as TraceAnomaly | 'any') : undefined,
    fromMs: fromMs.trim() === '' ? undefined : Number(fromMs),
    toMs: toMs.trim() === '' ? undefined : Number(toMs),
    text: search,
  };
  const selected = useMemo(
    () => sortRows(filterRows(load.rows, filter), sortKey, descending),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load.rows, ids, type, direction, result, node, mark, fromMs, toMs, search, sortKey, descending],
  );
  const summary = useMemo(() => summarizeRows(load.rows), [load.rows]);
  const buckets = useMemo(() => timelineBuckets(selected, TIMELINE_BUCKETS), [selected]);
  const nodes = useMemo(() => [...new Set(load.rows.map((r) => r.node).filter((n): n is number => n !== null))].sort((a, b) => a - b), [load.rows]);
  const peak = buckets.reduce((most, b) => Math.max(most, b.count), 1);
  // a new selection starts at the top, with no row chosen
  useEffect(() => {
    setActive(-1);
    setScrollTop(0);
    if (box.current) box.current.scrollTop = 0;
  }, [selected]);
  const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_TRACE_BYTES) {
      setText('');
      setTooBig(t('traceview.too_big', '{{name}} is bigger than {{limit}} MB and was not read.', { name: file.name, limit: MAX_TRACE_BYTES / (1024 * 1024) }));
      return;
    }
    setTooBig('');
    setText(await file.text());
  };

  const sortBy = (key: TraceSortKey) => {
    if (key === sortKey) setDescending(!descending); else { setSortKey(key); setDescending(false); }
  };
  const head = (key: TraceSortKey, label: string) => (
    <th role="columnheader" className="pr-3 select-none" aria-sort={sortKey === key ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="font-mono text-left hover:text-slate-300 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-400" onClick={() => sortBy(key)} aria-label={t('traceview.sort_by', 'Sort by {{column}}', { column: label })}>
        {label}{sortKey === key ? (descending ? ' v' : ' ^') : ''}
      </button>
    </th>
  );
  const plainHead = (label: string) => <th role="columnheader" className="pr-3">{label}</th>;

  const reset = () => { setIds(''); setType(''); setDirection(''); setResult(''); setNode(''); setMark(''); setFromMs(''); setToMs(''); setSearch(''); };
  const all = t('traceview.all', 'all');
  const win = rowWindow(selected.length, scrollTop, VIEW_HEIGHT, ROW_HEIGHT);
  const shown = selected.slice(win.start, win.end);
  const pageRows = Math.max(1, Math.floor((VIEW_HEIGHT - HEAD_HEIGHT) / ROW_HEIGHT) - 1);

  const choose = (index: number) => {
    setActive(index);
    const el = box.current;
    if (el && index >= 0) {
      const next = scrollTopToShow(index, el.scrollTop, VIEW_HEIGHT - HEAD_HEIGHT, ROW_HEIGHT);
      if (next !== el.scrollTop) { el.scrollTop = next; setScrollTop(next); }
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(LIST_KEYS as readonly string[]).includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    choose(moveActive(active, e.key as ListKey, selected.length, pageRows));
  };

  return (
    <Section className={parsing ? 'opacity-60' : undefined} title={t('traceview.title', 'CAN traces')} subtitle={t('traceview.subtitle', 'Open a recorded trace (.trc or .asc): every frame is named with the specification, refusals and odd frames are marked, and the selection can be saved as CSV or JSON. The file is read in this page and nothing is uploaded; nothing in it is run.')}>
      <div data-testid="trace-viewer">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Field label={t('traceview.choose', 'Choose a trace file (.trc, .asc)')}>
            <input type="file" accept=".trc,.asc,.log,.jsonl,.json,text/plain,application/json" className={inputCls} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </Field>
          <Field label={t('traceview.gap_ms', 'Mark a silence longer than (ms)')}><input type="number" min={0} value={gapMs} onChange={(e) => setGapMs(e.target.value)} className={inputCls} /></Field>
          <Field label={t('traceview.dup_ms', 'Duplicate window (ms)')}><input type="number" min={0} value={dupMs} onChange={(e) => setDupMs(e.target.value)} className={inputCls} /></Field>
        </div>
        <details className="mb-3 text-xs" data-testid="trace-advanced">
          <summary className="cursor-pointer text-slate-400">{t('traceview.advanced', 'Advanced')}</summary>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <Field label={t('traceview.rack_ids', 'Other identifiers of rack replies (hex)')}><input type="text" value={rackIds} onChange={(e) => setRackIds(e.target.value)} className={inputCls} placeholder="0x3F0" /></Field>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">{t('traceview.advanced_hint', 'The reply of the rack is read on 0x261 without any setting. Name other identifiers here only to read a trace recorded with a bench that sends the reply with another one.')}</p>
        </details>
        <p className="text-[11px] text-slate-500 mb-3">{t('traceview.limits', 'Limits: {{mb}} MB and {{rows}} frames per file; what is over the limit is not read and is counted.', { mb: MAX_TRACE_BYTES / (1024 * 1024), rows: MAX_TRACE_ROWS })}</p>

        {tooBig && <div className="text-xs text-red-400 mb-3" role="alert">{tooBig}</div>}
        {load.omitted > 0 && <div className="text-xs text-amber-300 mb-3" role="alert">{t('traceview.omitted', '{{count}} frames after the first {{max}} were left out.', { count: load.omitted, max: MAX_TRACE_ROWS })}</div>}
        {load.problemCount > 0 && (
          <details className="text-xs text-amber-300 mb-3">
            <summary>{t('traceview.problems', '{{count}} lines were not valid frames and were skipped', { count: load.problemCount })}</summary>
            <ul className="font-mono text-[11px] text-slate-400 mt-1">
              {load.problems.map((p) => <li key={p.line}>{t('traceview.problem_line', 'line {{line}}', { line: p.line })}: {t(`traceview.problem_${p.reason}`, p.reason)}</li>)}
            </ul>
          </details>
        )}

        {load.rows.length === 0 ? (
          <div className="text-xs text-slate-500">{t('traceview.empty', 'No frames loaded')}</div>
        ) : (
          <>
            <div className="text-xs text-slate-300 font-mono mb-3">
              <span className="text-cyan-300">{fileName}</span>{' - '}
              {t('traceview.summary', '{{frames}} frames, {{refused}} refused, {{faults}} faults, {{malformed}} malformed, {{flagged}} marked, {{seconds}} s', {
                frames: summary.frames, refused: summary.refused, faults: summary.faults, malformed: summary.malformed, flagged: summary.flagged, seconds: (summary.durationMs / 1000).toFixed(3),
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Field label={t('traceview.f_ids', 'Identifiers (hex)')}><input type="text" value={ids} onChange={(e) => setIds(e.target.value)} className={inputCls} placeholder="0x1A2 7F5" /></Field>
              <Field label={t('traceview.f_type', 'Type')}>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                  <option value="">{all}</option>
                  {TRACE_TYPES.map((v) => <option key={v} value={v}>{t(`traceview.type_${v}`, v)}</option>)}
                </select>
              </Field>
              <Field label={t('traceview.f_direction', 'Direction')}>
                <select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputCls}>
                  <option value="">{all}</option>
                  <option value="Tx">Tx</option>
                  <option value="Rx">Rx</option>
                </select>
              </Field>
              <Field label={t('traceview.f_result', 'Result')}>
                <select value={result} onChange={(e) => setResult(e.target.value)} className={inputCls}>
                  <option value="">{all}</option>
                  {TRACE_RESULTS.map((v) => <option key={v} value={v}>{t(`traceview.result_${v}`, v)}</option>)}
                </select>
              </Field>
              <Field label={t('traceview.f_node', 'Node')}>
                <select value={node} onChange={(e) => setNode(e.target.value)} className={inputCls}>
                  <option value="">{all}</option>
                  <option value="none">{t('traceview.no_node', 'no node')}</option>
                  {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label={t('traceview.f_mark', 'Mark')}>
                <select value={mark} onChange={(e) => setMark(e.target.value)} className={inputCls}>
                  <option value="">{all}</option>
                  <option value="any">{t('traceview.any_mark', 'any mark')}</option>
                  {TRACE_ANOMALIES.map((v) => <option key={v} value={v}>{t(`traceview.anomaly_${v}`, v)}</option>)}
                </select>
              </Field>
              <Field label={t('traceview.f_from', 'From (ms)')}><input type="number" value={fromMs} onChange={(e) => setFromMs(e.target.value)} className={inputCls} /></Field>
              <Field label={t('traceview.f_to', 'To (ms)')}><input type="number" value={toMs} onChange={(e) => setToMs(e.target.value)} className={inputCls} /></Field>
              <Field label={t('traceview.f_text', 'Search')}><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} /></Field>
            </div>
            {parsedIds.unreadable.length > 0 && <div className="text-[11px] text-amber-300 mb-2">{t('traceview.unreadable_ids', 'Not read as identifiers: {{list}}', { list: parsedIds.unreadable.join(' ') })}</div>}

            <div className="mb-3" data-testid="trace-timeline">
              <div className="text-[11px] text-slate-400 mb-1">{t('traceview.timeline', 'Timeline of the selection (click a bar to keep only its time)')}</div>
              <div className="flex items-end gap-px h-16 bg-slate-950 border border-slate-800 rounded p-1" role="img" aria-label={t('traceview.timeline', 'Timeline of the selection (click a bar to keep only its time)')}>
                {buckets.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    title={`${b.fromMs.toFixed(0)} - ${b.toMs.toFixed(0)} ms: ${b.count}`}
                    onClick={() => { setFromMs(String(Math.floor(b.fromMs))); setToMs(String(Math.ceil(b.toMs))); }}
                    className={`flex-1 min-w-0 ${b.refused > 0 ? 'bg-red-500' : b.flagged > 0 ? 'bg-amber-400' : 'bg-cyan-600'}`}
                    style={{ height: `${Math.max(b.count > 0 ? 4 : 0, Math.round((b.count / peak) * 100))}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-xs text-slate-300 font-mono">{t('traceview.selected', '{{count}} frames selected', { count: selected.length })}</span>
              <button className={btnCls} onClick={reset}>{t('traceview.reset', 'Clear the filters')}</button>
              <button className={btnCls} disabled={selected.length === 0} onClick={() => downloadBlob(new Blob([traceCsv(selected)], { type: 'text/csv' }), `urtc_trace_view_${stamp()}.csv`)}>{t('traceview.csv', 'Download the selection (CSV)')}</button>
              <button className={btnCls} disabled={selected.length === 0} onClick={() => downloadBlob(new Blob([traceJson(selected, fileName)], { type: 'application/json' }), `urtc_trace_view_${stamp()}.json`)}>{t('traceview.json', 'Download the selection (JSON)')}</button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              {t('traceview.format_read', 'Format read: {{format}}', { format: load.format })}{' - '}{t('traceview.keys_hint', 'Only the rows in view are drawn. Click the table, then use the arrow keys, Page Up, Page Down, Home and End to move through the rows.')}
            </p>
            <div className="sr-only" role="status" aria-live="polite">{active >= 0 ? t('traceview.row_status', 'Row {{row}} of {{total}}', { row: active + 1, total: selected.length }) : ''}</div>

            <div
              ref={box}
              role="grid"
              tabIndex={0}
              aria-label={t('traceview.grid_label', 'Frames of the trace')}
              aria-rowcount={selected.length + 1}
              aria-colcount={COLUMNS.length}
              aria-activedescendant={active >= 0 ? `trace-row-${selected[active]?.index}` : undefined}
              data-testid="trace-grid"
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              onKeyDown={onKeyDown}
              className="overflow-auto border border-slate-800 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              style={{ height: VIEW_HEIGHT }}
            >
              <table role="presentation" className="text-[11px] font-mono text-slate-300" style={{ width: TABLE_WIDTH, tableLayout: 'fixed' }}>
                <colgroup>{COLUMNS.map((width, i) => <col key={i} style={{ width }} />)}</colgroup>
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr role="row" aria-rowindex={1} className="text-left text-slate-500" style={{ height: HEAD_HEIGHT }}>
                    {head('index', '#')}{head('time', t('traceview.col_time', 'Time (ms)'))}{plainHead(t('traceview.f_direction', 'Direction'))}
                    {head('id', t('traceview.col_id', 'ID'))}{head('dlc', t('traceview.col_dlc', 'DLC'))}{plainHead(t('traceview.col_data', 'Data'))}
                    {head('name', t('traceview.col_name', 'Name'))}{head('type', t('traceview.f_type', 'Type'))}{head('node', t('traceview.f_node', 'Node'))}
                    {head('result', t('traceview.f_result', 'Result'))}{plainHead(t('traceview.f_mark', 'Mark'))}{plainHead(t('traceview.col_summary', 'Fields'))}
                  </tr>
                </thead>
                <tbody>
                  {win.topPad > 0 && <tr aria-hidden="true" style={{ height: win.topPad }}><td colSpan={COLUMNS.length} /></tr>}
                  {shown.map((r, i) => {
                    const position = win.start + i;
                    return (
                      <tr
                        key={r.index}
                        id={`trace-row-${r.index}`}
                        role="row"
                        aria-rowindex={position + 2}
                        aria-selected={position === active}
                        onClick={() => choose(position)}
                        className={`${rowClass(r)} ${position === active ? 'bg-slate-800' : ''}`}
                        style={{ height: ROW_HEIGHT }}
                      >
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden">{r.index}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden">{r.timeMs.toFixed(3)}</td>
                        <td role="gridcell" className="pr-3">{r.direction}</td>
                        <td role="gridcell" className="pr-3">{r.idHex}</td>
                        <td role="gridcell" className="pr-3">{r.dlc}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden text-ellipsis" title={r.dataHex}>{r.dataHex || '-'}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden text-ellipsis" title={r.name}>{r.name || '-'}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden">{t(`traceview.type_${r.type}`, r.type)}</td>
                        <td role="gridcell" className="pr-3">{r.node ?? '-'}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden">{t(`traceview.result_${r.result}`, r.result)}</td>
                        <td role="gridcell" className="pr-3 whitespace-nowrap overflow-hidden text-ellipsis">{r.anomalies.map((a) => t(`traceview.anomaly_${a}`, a)).join(', ') || '-'}</td>
                        <td role="gridcell" className="whitespace-nowrap overflow-hidden text-ellipsis" title={r.summary}>{r.summary}</td>
                      </tr>
                    );
                  })}
                  {win.bottomPad > 0 && <tr aria-hidden="true" style={{ height: win.bottomPad }}><td colSpan={COLUMNS.length} /></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Section>
  );
};

// Memoized: the page draws again on every frame that reaches it, and the context it hands down is one stable object, so a panel is drawn again only when its own state or props change.
export const TraceViewerPanel = React.memo(TraceViewerPanelBody);
