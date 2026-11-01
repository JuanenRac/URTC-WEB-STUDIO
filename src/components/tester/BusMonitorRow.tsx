import React from 'react';
import { CanFrame } from '../../types';

// The raw bus monitor keeps this many rows and drops the oldest. A row never changes once logged (a frame is immutable and keyed by its
// sequence number), so it is memoized: when a frame arrives only the new row is drawn and the others are compared by reference and left
// alone. At this size the list needs no virtualization (see busMonitorRows.test.tsx for the measurement).
export const BUS_MONITOR_MAX_ROWS = 500;

export const BusMonitorRow = React.memo(function BusMonitorRow({ frame }: { frame: CanFrame }) {
  return (
    <tr className="odd:bg-slate-950 even:bg-slate-900/50">
      <td className="px-2 py-0.5 text-slate-500">{frame.timestamp}</td>
      <td className={`px-2 py-0.5 ${frame.direction === 'Tx' ? 'text-amber-400' : 'text-cyan-400'}`}>{frame.direction}</td>
      <td className="px-2 py-0.5 text-slate-200">{frame.idHex}</td>
      <td className="px-2 py-0.5 text-slate-400">{frame.dlc}</td>
      <td className="px-2 py-0.5 text-slate-300">{frame.dataHex}</td>
    </tr>
  );
});
