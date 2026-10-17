import { useState, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../types';
import { CAN_ID_QUERY_VERSION, CAN_ID_VERSION_RESPONSE, CAN_ID_BOOTLOADER_VERSION_RESPONSE } from '../lib/flasher';
import { parseSlcanLine } from '../lib/slcan';
import { FrameRouter } from '../lib/frameRouter';

// Standard SLCAN/Lawicel "Sx" bitrate codes, in the same most-likely-first try
// order as URTC-FLASHER/URTC-TESTER's own auto_detect_bitrate: URTC's bus is
// fixed at 500k, so that's tried first, then its two most common neighbors,
// then the rest of the table.
const BITRATE_TRY_ORDER: Array<{ label: string; code: string }> = [
  { label: '500 kbit/s', code: '6' },
  { label: '250 kbit/s', code: '5' },
  { label: '125 kbit/s', code: '4' },
  { label: '1 Mbit/s', code: '8' },
  { label: '100 kbit/s', code: '3' },
  { label: '50 kbit/s', code: '2' },
  { label: '20 kbit/s', code: '1' },
  { label: '10 kbit/s', code: '0' },
  { label: '800 kbit/s', code: '7' },
];

export function useSerialCanBus(onFrameReceived: (frame: CanFrame) => void) {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  // The ref is what a send checks: a callback captured before the connection was made still sees the real state.
  const isConnectedRef = useRef(false);
  const setConnected = (value: boolean) => { isConnectedRef.current = value; setIsConnected(value); };
  const [portName, setPortName] = useState<string>('');
  // Surfaces sendFrame() write failures to the UI. Most callers (one-shot
  // "Send"/"Fire" buttons across tester/ToolPanels.tsx and tester/GlobalPanels.tsx,
  // plus every useKeepalive tick) call sendFrame() fire-and-forget, without
  // awaiting or catching it - before this, a write failure (e.g. the port
  // going away mid-session) only threw an unhandled rejection visible in the
  // browser console, silently dropping a command the user thought had been
  // sent. Cleared automatically the next time a send succeeds, or manually
  // via clearSendError (wired to the banner's dismiss button in App.tsx).
  const [sendError, setSendError] = useState<string | null>(null);
  const clearSendError = useCallback(() => setSendError(null), []);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(true);
  const rxBufferRef = useRef<string>('');
  // Routes received frames to whoever waits for an answer (see lib/frameRouter.ts).
  const routerRef = useRef(new FrameRouter<CanFrame>());

  // Stable per-frame identity for React list keys (CAN log tables prepend
  // new frames rather than appending, so an array index isn't a valid key -
  // see the CanFrame.seq doc comment in types.ts).
  const frameSeqRef = useRef<number>(0);

  // A well-formed SLCAN line is at most ~21 chars ('t' + 3 hex ID + 1 DLC
  // digit + up to 16 hex data chars). If the adapter sends data without a
  // carriage return (desync, garbage, or a non-SLCAN device on the port),
  // rxBufferRef would otherwise grow unbounded for the life of the
  // connection - cap it and drop the buffer if it's exceeded, matching the
  // bound already enforced on frameQueueRef below.
  const MAX_RX_BUFFER_CHARS = 4096;

  // Per-ID subscribers (many tool panels can listen to the same telemetry ID
  // at once) plus catch-all sniffers (raw bus monitor). Non-consuming - unlike
  // frameQueueRef (used only by waitForFrame's own request/response matching,
  // which splices frames out), every subscriber sees every frame regardless
  // of how many other subscribers or waitForFrame calls also see it.
  const subscribersRef = useRef<Map<number, Set<(f: CanFrame) => void>>>(new Map());
  const sniffersRef = useRef<Set<(f: CanFrame) => void>>(new Set());

  const subscribe = useCallback((id: number, cb: (f: CanFrame) => void) => {
    let set = subscribersRef.current.get(id);
    if (!set) {
      set = new Set();
      subscribersRef.current.set(id, set);
    }
    set.add(cb);
    return () => { set!.delete(cb); };
  }, []);

  const subscribeAll = useCallback((cb: (f: CanFrame) => void) => {
    sniffersRef.current.add(cb);
    return () => { sniffersRef.current.delete(cb); };
  }, []);

  const dispatchFrame = useCallback((frame: CanFrame) => {
    subscribersRef.current.get(frame.id)?.forEach(cb => cb(frame));
    sniffersRef.current.forEach(cb => cb(frame));
    onFrameReceived(frame);
  }, [onFrameReceived]);

  // Waits for the next frame with this id. A frame that arrived more than a
  // second ago is never served (see lib/frameQueue.ts); to be sure an answer
  // belongs to a request just made, use request() below.
  const waitForFrame = (expectedId: number, timeoutMs: number = 3000): Promise<CanFrame | null> =>
    routerRef.current.wait(expectedId, timeoutMs);

  // Forgets the frames kept for an id: whatever is on the bus now answers
  // something that already happened.
  const flushFrames = (id?: number) => routerRef.current.flush(id);

  // Request / answer in one call: forgets old frames of the answering id,
  // registers the waiter, sends, and resolves with the first frame that arrives
  // after the send (null on timeout). Throws like sendFrame when it cannot send.
  const request = (
    id: number,
    data: number[],
    respId: number,
    timeoutMs: number = 1500,
    description?: string,
    accept?: (frame: CanFrame) => boolean
  ): Promise<CanFrame | null> =>
    routerRef.current.request(respId, () => sendFrame(id, data, description), timeoutMs, accept);

  const deliverOrQueue = (frame: CanFrame) => routerRef.current.deliver(frame);

  // Fires when the OS reports the physical port gone (cable unplugged,
  // adapter powered off) - distinct from disconnect() below, which is the
  // user-initiated "click Disconnect" path and can still talk to a live
  // port (send the SLCAN 'C' close command, call port.close()). Here the
  // port is already gone, so this only resets local state to match reality
  // instead of leaving the UI claiming "connected" to a port that no
  // longer exists.
  const onNativeDisconnectRef = useRef<(event: any) => void>(() => {});
  const handlePortGone = useCallback(() => {
    keepReadingRef.current = false;
    // @ts-ignore
    navigator.serial?.removeEventListener('disconnect', onNativeDisconnectRef.current);
    routerRef.current.flush();
    portRef.current = null;
    writerRef.current = null;
    readerRef.current = null;
    setConnected(false);
    setPortName('');
  }, []);

  const onNativeDisconnect = useCallback((event: any) => {
    if (event.target === portRef.current) {
      handlePortGone();
    }
  }, [handlePortGone]);
  onNativeDisconnectRef.current = onNativeDisconnect;

  // Resolves true as soon as a CAN_ID_VERSION_RESPONSE or
  // CAN_ID_BOOTLOADER_VERSION_RESPONSE frame is dispatched (whichever the
  // board answers CAN_ID_QUERY_VERSION with - application or bootloader),
  // false if neither arrives within timeoutMs. Used by the bitrate
  // auto-detect loop below. Filtered to these two specific IDs rather than
  // "any parsed frame at all", so that noise which happens to parse into a
  // well-formed-looking SLCAN line at the wrong bitrate can't be mistaken
  // for a real board response.
  const probeForResponse = (timeoutMs: number): Promise<boolean> => {
    return new Promise((resolve) => {
      let settled = false;
      const unsubscribe = subscribeAll((frame) => {
        if (settled) return;
        if (frame.id !== CAN_ID_VERSION_RESPONSE && frame.id !== CAN_ID_BOOTLOADER_VERSION_RESPONSE) return;
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        resolve(true);
      });
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubscribe();
        resolve(false);
      }, timeoutMs);
    });
  };

  // Tries each candidate bitrate in BITRATE_TRY_ORDER: (re)opens the SLCAN
  // channel at that bitrate, sends a CAN_ID_QUERY_VERSION probe (empty
  // payload - the same frame the app uses elsewhere to ask "what's on the
  // bus"), and waits briefly for any response. Mirrors
  // URTC-FLASHER/URTC-TESTER's own auto_detect_bitrate. Returns the matching
  // bitrate label with the channel left open on it, or null if nothing
  // answered at any bitrate (channel is left closed in that case).
  const detectAndOpenBitrate = async (): Promise<string | null> => {
    const queryVersionCmd = `t${CAN_ID_QUERY_VERSION.toString(16).padStart(3, '0').toUpperCase()}0`;
    for (const { label, code } of BITRATE_TRY_ORDER) {
      await _sendRaw('C'); // close first - SLCAN rejects a bitrate change while already open
      await new Promise(r => setTimeout(r, 50));
      rxBufferRef.current = ''; // drop any partial garbage line from the previous bitrate attempt
      await _sendRaw('S' + code);
      await new Promise(r => setTimeout(r, 50));
      await _sendRaw('O');
      await new Promise(r => setTimeout(r, 50));

      const responded = probeForResponse(800); // register the listener before sending, so a fast reply can't be missed
      await _sendRaw(queryVersionCmd);
      if (await responded) {
        return label;
      }
    }
    return null;
  };

  const connect = async () => {
    if (!('serial' in navigator)) {
      alert(t('hooks.web_serial_unsupported', 'Web Serial API is not supported in this browser. Please use Chrome or Edge.'));
      return;
    }

    setSendError(null); // drop any stale banner from a previous session before trying a fresh one

    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setPortName('USB-CAN Adapter');
      // @ts-ignore
      navigator.serial.addEventListener('disconnect', onNativeDisconnect);

      writerRef.current = port.writable.getWriter();
      keepReadingRef.current = true;
      readLoop(); // start pumping bytes now so the bitrate probes below can actually see responses

      const detectedLabel = await detectAndOpenBitrate();
      if (!detectedLabel) {
        throw new Error(t('hooks.no_bus_response', 'No response from a URTC board at any known CAN bitrate (tried 500k, 250k, 125k, 1M, 100k, 50k, 20k, 10k, 800k). Check wiring and power.'));
      }

      setConnected(true);
      setPortName(`USB-CAN Adapter (${detectedLabel})`);
    } catch (e: any) {
      console.error('Failed to connect', e);

      // If port.open() already succeeded before something later in the init
      // sequence threw (getWriter(), the SLCAN handshake, or every bitrate
      // probe in detectAndOpenBitrate() coming back empty), the port is left
      // physically open and claimed by this tab while isConnected is still
      // false - the UI only offers a "Connect" button in that state, never
      // "Disconnect", so without this cleanup the port stays hung open with
      // no way to release it short of reloading the page. Tear it back down
      // exactly like a normal disconnect() would - including canceling the
      // read loop's reader first (readLoop() is started early, before
      // bitrate detection, so the probes can see responses), since
      // port.close() below can fail on a still-locked readable stream
      // otherwise.
      keepReadingRef.current = false;
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch {}
      }
      if (writerRef.current) {
        try { writerRef.current.releaseLock(); } catch {}
        writerRef.current = null;
      }
      if (portRef.current) {
        // @ts-ignore
        navigator.serial.removeEventListener('disconnect', onNativeDisconnect);
        try { await portRef.current.close(); } catch {}
        portRef.current = null;
      }
      readerRef.current = null;
      setPortName('');

      if (e.message?.includes('requestPort') || e.name === 'SecurityError') {
        alert(t('hooks.iframe_blocked', 'Cannot access USB/Serial from here: this page is embedded in a frame that does not allow it. Open the page in its own browser tab.'));
      } else if (e.name === 'NotFoundError' || e.message?.includes('No port selected by the user') || e.message?.includes('Request failed')) {
        // User cancelled the prompt, do not show an alert
        console.log('User cancelled serial port selection.');
      } else {
        alert(t('hooks.connection_failed', 'Connection failed: {{message}}', { message: e.message || 'Unknown error' }));
      }
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
    // @ts-ignore
    navigator.serial.removeEventListener('disconnect', onNativeDisconnect);
    if (readerRef.current) {
      await readerRef.current.cancel();
    }

    if (writerRef.current) {
      try {
        await _sendRaw('C');
      } catch (e) {}
      await writerRef.current.releaseLock();
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (e) {}
    }

    portRef.current = null;
    writerRef.current = null;
    readerRef.current = null;
    setConnected(false);
    setPortName('');
  };

  const _sendRaw = async (cmd: string) => {
    // Throw rather than silently no-op when the writer is already gone
    // (port physically unplugged, writer lock released by handlePortGone()).
    // sendFrame() below only logs a 'Tx' frame into the UI after this call
    // returns successfully - a silent no-op here would make the CAN log
    // claim a command reached the board (laser power, drill speed, etc.)
    // when the byte was never actually written to the wire.
    if (!writerRef.current) {
      throw new Error(t('hooks.writer_unavailable', 'Serial port writer is not available (port disconnected).'));
    }
    const data = new TextEncoder().encode(cmd + '\r');
    await writerRef.current.write(data);
  };

  const sendFrame = async (id: number, data: number[], description: string = 'Sent from Web Studio') => {
    // A send that goes nowhere must fail, not look like it worked (a keepalive or a button would otherwise believe the command left).
    if (!isConnectedRef.current) {
      const message = t('hooks.not_connected', 'Not connected to a USB-CAN adapter.');
      setSendError(message);
      throw new Error(message);
    }

    // Do not serialize invalid UI input into an SLCAN command. Several panels
    // accept editable hexadecimal values; without this guard a NaN byte, an
    // ID outside the standard CAN range, or more than eight bytes was sent as
    // malformed text while the UI still logged it as a successful command.
    let invalidReason: string | null = null;
    if (!Number.isInteger(id) || id < 0 || id > 0x7FF) {
      invalidReason = 'identifier must be an integer from 0x000 to 0x7FF';
    } else if (data.length > 8) {
      invalidReason = 'payload cannot exceed 8 bytes';
    } else if (data.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 0xFF)) {
      invalidReason = 'every payload value must be an integer from 0x00 to 0xFF';
    }
    if (invalidReason) {
      setSendError(t('hooks.invalid_frame', 'Refusing malformed CAN frame: {{reason}}', { reason: invalidReason }));
      return;
    }

    const dlc = data.length;
    const hexData = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    const cmd = `t${id.toString(16).padStart(3, '0').toUpperCase()}${dlc}${hexData}`;

    try {
      await _sendRaw(cmd);
    } catch (e: any) {
      // Most callers never await/catch this promise (see the sendError
      // comment above) - set the banner message here, at the one place every
      // sendFrame() call funnels through, then rethrow so callers that DO
      // await/catch (useKeepalive, handleQueryVersion, etc.) keep seeing the
      // rejection exactly as before.
      setSendError(t('hooks.send_failed', 'CAN send failed ({{description}}): {{message}}', { description, message: e?.message || String(e) }));
      throw e;
    }
    setSendError(null); // self-heals as soon as a send succeeds again (e.g. after a reconnect)

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    dispatchFrame({
      id,
      idHex: `0x${id.toString(16).toUpperCase().padStart(3, '0')}`,
      dlc,
      data,
      dataHex: hexData.match(/.{1,2}/g)?.join(' ') || '',
      timestamp,
      direction: 'Tx',
      description,
      seq: ++frameSeqRef.current
    });
  };

  const readLoop = async () => {
    while (portRef.current && portRef.current.readable && keepReadingRef.current) {
      // Keep a local reference alongside readerRef.current: handlePortGone()
      // (called below, or concurrently from the native 'disconnect' listener
      // if the port physically drops mid-read) nulls readerRef.current, and
      // the old code called releaseLock() on readerRef.current directly in
      // `finally` - which threw "Cannot read properties of null" on every
      // single physical unplug during a read, since handlePortGone() had
      // already nulled it by the time `finally` ran. Reading through the
      // local `reader` const instead of the ref sidesteps that race.
      const reader = portRef.current.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            rxBufferRef.current += chunk;
            if (rxBufferRef.current.length > MAX_RX_BUFFER_CHARS) {
              console.warn('SLCAN rx buffer exceeded max size without a frame terminator - resetting (adapter desync or non-SLCAN data on the port).');
              rxBufferRef.current = '';
            }
            processBuffer();
          }
        }
      } catch (error) {
        console.error('Read error:', error);
        // A throw here (rather than read() resolving {done: true}) means the
        // port itself broke - the adapter was unplugged mid-read - not a
        // user-requested disconnect() (which sets keepReadingRef false
        // before ever touching the reader). Reset local state so the UI
        // stops claiming "connected" to a port that's already gone; the
        // navigator.serial 'disconnect' listener above covers the same
        // case, but reacting here too doesn't depend on that event firing.
        if (keepReadingRef.current) {
          handlePortGone();
        }
      } finally {
        try { reader.releaseLock(); } catch {}
      }
    }
  };

  const processBuffer = () => {
    const lines = rxBufferRef.current.split('\r');
    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith('t') && line.length >= 5) {
          try {
            // A malformed or truncated SLCAN line used to be accepted here:
            // DLC 9..F produced a non-CAN frame and short/non-hex payloads
            // inserted NaN bytes into the telemetry stream. parseSlcanLine
            // (src/lib/slcan.ts) validates the standard 11-bit `t` frame
            // prefix before anything is delivered to control panels - see
            // its own tests for the exact matrix of what it accepts/rejects.
            const parsed = parseSlcanLine(line);
            if (!parsed) {
              console.warn('Ignoring malformed/truncated SLCAN frame:', line);
              continue;
            }

            const now = new Date();
            const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

            const frame: CanFrame = {
              ...parsed,
              timestamp,
              direction: 'Rx',
              description: 'Incoming from CAN hardware',
              seq: ++frameSeqRef.current
            };

            deliverOrQueue(frame);
            dispatchFrame(frame);
          } catch (e) {
            console.error('Failed to parse frame:', line);
          }
        }
      }
      rxBufferRef.current = lines[lines.length - 1]; // Keep remainder
    }
  };

  // The functions above are rebuilt on every render and read the latest state
  // through refs, so the ones handed out are thin, stable wrappers: a panel
  // that lists them as an effect dependency is not torn down and rebuilt each
  // time a frame arrives.
  const latest = useRef({ connect, disconnect, sendFrame, waitForFrame, request, flushFrames });
  latest.current = { connect, disconnect, sendFrame, waitForFrame, request, flushFrames };
  const stable = useMemo(() => ({
    connect: () => latest.current.connect(),
    disconnect: () => latest.current.disconnect(),
    sendFrame: (id: number, data: number[], description?: string) => latest.current.sendFrame(id, data, description),
    waitForFrame: (id: number, timeoutMs?: number) => latest.current.waitForFrame(id, timeoutMs),
    request: (id: number, data: number[], respId: number, timeoutMs?: number, description?: string, accept?: (frame: CanFrame) => boolean) =>
      latest.current.request(id, data, respId, timeoutMs, description, accept),
    flushFrames: (id?: number) => latest.current.flushFrames(id),
  }), []);

  return {
    isConnected,
    portName,
    ...stable,
    subscribe,
    subscribeAll,
    sendError,
    clearSendError
  };
}

export type SerialCanBus = ReturnType<typeof useSerialCanBus>;
