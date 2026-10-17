import { registerSafeOff } from "./safeOff";

export interface KeepaliveLoop {
  send: () => void | Promise<void>;
  onFailure?: () => void;
  off?: () => void | Promise<void>;
}

/**
 * Sends immediately and then every `intervalMs`. The returned function stops
 * the loop and sends the "off" action once, so an actuator is never left
 * running on a command that nobody repeats any more. While the loop runs, the
 * "off" is also registered for a global switch-off (page closing, emergency).
 */
export function startKeepaliveLoop(intervalMs: number, loop: () => KeepaliveLoop): () => void {
  let stopped = false;
  let offDone = false;

  const tick = async () => {
    try {
      await loop().send();
    } catch (e) {
      console.error("Keepalive send failed:", e);
      if (!stopped) loop().onFailure?.();
    }
  };

  const runOff = async () => {
    if (offDone) return;
    offDone = true;
    try {
      await loop().off?.();
    } catch (e) {
      console.error("Switching off failed:", e);
    }
  };

  const unregister = loop().off ? registerSafeOff(runOff) : () => {};
  void tick();
  const id = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(id);
    unregister();
    void runOff();
  };
}
