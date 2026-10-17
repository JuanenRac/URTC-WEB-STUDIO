import { useEffect, useRef } from 'react';
import { startKeepaliveLoop } from '../lib/keepaliveLoop';

// Mirrors PanelHelpersMixin._start_keepalive/_stop_keepalive from the Python
// URTC Tester: while `active` is true, `sendFn` fires immediately and then
// every `intervalMs` - a real master has to keep resending a tool's command
// to satisfy the firmware's own communication watchdog, or the actuator
// shuts itself off. `onFailure` (if provided) mirrors the Python tool
// unchecking its own "Active" box when a send throws, so the UI never shows
// a checkbox that's lying about whether the keepalive is actually running.
//
// `offFn` is the frame that switches the actuator off. It is sent whenever
// the keepalive ends for any reason: Active unchecked, the panel replaced by
// another one, the tab changed, or the page closed. Without it, letting the
// repeated command simply lapse would leave the firmware to cut the actuator
// by its watchdog and latch a critical error.
export function useKeepalive(
  active: boolean,
  intervalMs: number,
  sendFn: () => void | Promise<void>,
  onFailure?: () => void,
  offFn?: () => void | Promise<void>
) {
  const latest = useRef({ send: sendFn, onFailure, off: offFn });
  latest.current = { send: sendFn, onFailure, off: offFn };

  useEffect(() => {
    if (!active) return;
    return startKeepaliveLoop(intervalMs, () => latest.current);
  }, [active, intervalMs]);
}
