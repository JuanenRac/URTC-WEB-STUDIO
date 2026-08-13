import { useEffect, useRef } from 'react';

// Mirrors PanelHelpersMixin._start_keepalive/_stop_keepalive from the Python
// URTC Tester: while `active` is true, `sendFn` fires immediately and then
// every `intervalMs` - a real master has to keep resending a tool's command
// to satisfy the firmware's own communication watchdog, or the actuator
// shuts itself off. `onFailure` (if provided) mirrors the Python tool
// unchecking its own "Active" box when a send throws, so the UI never shows
// a checkbox that's lying about whether the keepalive is actually running.
export function useKeepalive(
  active: boolean,
  intervalMs: number,
  sendFn: () => void | Promise<void>,
  onFailure?: () => void
) {
  const sendRef = useRef(sendFn);
  sendRef.current = sendFn;
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;

  useEffect(() => {
    if (!active) return;
    let stopped = false;

    const tick = async () => {
      try {
        await sendRef.current();
      } catch (e) {
        console.error('Keepalive send failed:', e);
        if (!stopped) onFailureRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, intervalMs]);
}
