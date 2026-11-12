import { useCallback, useEffect, useRef, useState } from 'react';
import { CutReason, Heartbeat, startHeartbeat } from '../lib/controlHeartbeat';

type Send = (id: number, data: number[]) => Promise<unknown>;

export interface HeldFrame { id: number; data: number[]; offData: number[] }

export interface ControlSessionOptions {
  /** A board is connected. */
  connected: boolean;
  /** The Control tab is the one on screen. */
  tabActive: boolean;
  /** The switch of real sending. */
  allowed: boolean;
  send: Send;
  /** Called once when something that was running ends, with why. */
  onEnd: (reason: CutReason) => void;
}

/**
 * What is switched on from the Control tab: either a setpoint that is refreshed for a bounded time (the heartbeat) or one frame that was sent once. Anything that
 * is on is cut at once, with the frame that switches it off, when the person presses STOP, when the time is up, when the window loses focus or is hidden, when
 * the tab is left, when the connection is lost, when the real-sending switch is turned off and when the page goes away.
 */
export function useControlSession(options: ControlSessionOptions) {
  const latest = useRef(options);
  latest.current = options;
  const heartbeat = useRef<Heartbeat | null>(null);
  const single = useRef<HeldFrame | null>(null);
  const [holding, setHolding] = useState(false);
  const [active, setActive] = useState(false);

  const cut = useCallback((reason: CutReason) => {
    const running = heartbeat.current;
    const once = single.current;
    if (!running && !once) return;
    single.current = null;
    if (running) {
      heartbeat.current = null;
      running.stop(reason);               // sends the off frame and tells onEnd
    } else if (once) {
      void Promise.resolve().then(() => latest.current.send(once.id, once.offData)).catch(() => undefined);
      latest.current.onEnd(reason);
    }
    setHolding(false);
    setActive(false);
  }, []);

  /** One confirmed frame went out: remember how to switch the tool off. */
  const rememberSingle = useCallback((frame: HeldFrame) => {
    cut('switch');
    single.current = frame;
    setActive(true);
  }, [cut]);

  /** A confirmed setpoint to refresh for `seconds`. */
  const startHold = useCallback((frame: HeldFrame, seconds: number) => {
    cut('switch');
    heartbeat.current = startHeartbeat({
      send: () => latest.current.send(frame.id, frame.data),
      off: () => latest.current.send(frame.id, frame.offData),
      durationMs: seconds * 1000,
      onEnd: (reason) => {
        heartbeat.current = null;
        setHolding(false);
        setActive(false);
        latest.current.onEnd(reason);
      },
    });
    setHolding(true);
    setActive(true);
  }, [cut]);

  useEffect(() => { if (!options.connected) cut('connection'); }, [options.connected, cut]);
  useEffect(() => { if (!options.tabActive) cut('tab'); }, [options.tabActive, cut]);
  useEffect(() => { if (!options.allowed) cut('stop'); }, [options.allowed, cut]);
  useEffect(() => {
    const onBlur = () => cut('blur');
    const onHidden = () => { if (document.visibilityState === 'hidden') cut('blur'); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      cut('unmount');
    };
  }, [cut]);

  return { holding, active, startHold, rememberSingle, stop: () => cut('stop') };
}
