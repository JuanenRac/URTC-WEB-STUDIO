import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '../../lib/download';
import {
  DEFAULT_TRACE_SETTINGS, MAX_TRACE_BYTES, MAX_TRACE_ROWS, TRACE_ANOMALIES, TRACE_RESULTS, TRACE_TYPES, filterRows, parseCanTrace, parseIdList,
  sortRows, summarizeRows, timelineBuckets, traceCsv, traceJson,
  type TraceAnomaly, type TraceDirection, type TraceFilter, type TraceResult, type TraceRow, type TraceSortKey, type TraceType,
} from '../../lib/canTrace';
import { Field, Section, btnCls, inputCls } from './shared';

/** Rows drawn at once: the table of a large file would freeze the page, and the downloads always hold the whole selection. */
const RENDER_LIMIT = 1000;
const TIMELINE_BUCKETS = 60;

const rowClass = (r: TraceRow): string =>
  r.result === 'refused' || r.result === 'fault' ? 'text-red-400' : r.result === 'malformed' || r.anomalies.length > 0 ? 'text-amber-300' : '';

/** Loads a .trc / .asc recording and lists its frames named by the specification, with filters, marks, a timeline and a CSV or JSON download. Read in this page: nothing is uploaded. */
export const TraceViewerPanel: React.FC = () => {
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

  const number = (value: string, fallback: number) => (value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : fallback);
  const settings = useMemo(() => ({
    gapMs: number(gapMs, DEFAULT_TRACE_SETTINGS.gapMs),
    duplicateWindowMs: number(dupMs, DEFAULT_TRACE_SETTINGS.duplicateWindowMs),
    rackReplyIds: parseIdList(rackIds).ids,
  }), [gapMs, dupMs, rackIds]);
  const load = useMemo(() => parseCanTrace(text, settings), [text, settings]);

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
  const peak = Math.max(1, ...buckets.map((b) => b.count));
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
    <th className="pr-3 cursor-pointer select-none" onClick={() => sortBy(key)} aria-sort={sortKey === key ? (descending ? 'descending' : 'ascending') : 'none'}>
      {label}{sortKey === key ? (descending ? ' v' : ' ^') : ''}
    </th>
  );

  const reset = () => { setIds(''); setType(''); setDirection(''); setResult(''); setNode(''); setMark(''); setFromMs(''); setToMs(''); setSearch(''); };
  const all = t('traceview.all', 'all');
  const shown = selected.slice(0, RENDER_LIMIT);

  return (
    <Section title={t('traceview.title', 'CAN traces')} subtitle={t('traceview.subtitle', 'Open a recorded trace (.trc or .asc): every frame is named with the specification, refusals and odd frames are marked, and the selection can be saved as CSV or JSON. The file is read in this page and nothing is uploaded; nothing in it is run.')}>
      <div data-testid="trace-viewer">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Field label={t('traceview.choose', 'Choose a trace file (.trc, .asc)')}>
            <input type="file" accept=".trc,.asc,text/plain" className={inputCls} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
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
            {selected.length > shown.length && <div className="text-[11px] text-slate-500 mb-2">{t('traceview.showing', 'Showing the first {{shown}} of {{total}} selected frames; the downloads hold all of them.', { shown: shown.length, total: selected.length })}</div>}

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono text-slate-300">
                <thead>
                  <tr className="text-left text-slate-500">
                    {head('index', '#')}{head('time', t('traceview.col_time', 'Time (ms)'))}<th className="pr-3">{t('traceview.f_direction', 'Direction')}</th>
                    {head('id', t('traceview.col_id', 'ID'))}{head('dlc', t('traceview.col_dlc', 'DLC'))}<th className="pr-3">{t('traceview.col_data', 'Data')}</th>
                    {head('name', t('traceview.col_name', 'Name'))}{head('type', t('traceview.f_type', 'Type'))}{head('node', t('traceview.f_node', 'Node'))}
                    {head('result', t('traceview.f_result', 'Result'))}<th className="pr-3">{t('traceview.f_mark', 'Mark')}</th><th>{t('traceview.col_summary', 'Fields')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.index} className={rowClass(r)}>
                      <td className="pr-3">{r.index}</td><td className="pr-3">{r.timeMs.toFixed(3)}</td><td className="pr-3">{r.direction}</td><td className="pr-3">{r.idHex}</td>
                      <td className="pr-3">{r.dlc}</td><td className="pr-3">{r.dataHex || '-'}</td><td className="pr-3">{r.name || '-'}</td>
                      <td className="pr-3">{t(`traceview.type_${r.type}`, r.type)}</td><td className="pr-3">{r.node ?? '-'}</td>
                      <td className="pr-3">{t(`traceview.result_${r.result}`, r.result)}</td>
                      <td className="pr-3">{r.anomalies.map((a) => t(`traceview.anomaly_${a}`, a)).join(', ') || '-'}</td>
                      <td>{r.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Section>
  );
};
