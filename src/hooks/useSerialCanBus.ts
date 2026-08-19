import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../types';

export function useSerialCanBus(onFrameReceived: (frame: CanFrame) => void) {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [portName, setPortName] = useState<string>('');

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(true);
  const rxBufferRef = useRef<string>('');
  const frameQueueRef = useRef<CanFrame[]>([]);

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

  // Per-caller correlation for waitForFrame: each call registers its own
  // waiter in a per-ID FIFO queue, so when two callers await the same CAN ID
  // concurrently, incoming frames are handed to the oldest still-waiting
  // caller for that ID first, deterministically - never to whichever caller
  // happens to poll or resolve first.
  const waitersRef = useRef<Map<number, Array<(frame: CanFrame) => void>>>(new Map());

  const waitForFrame = (expectedId: number, timeoutMs: number = 3000): Promise<CanFrame | null> => {
    // Serve immediately from anything already queued (arrived before this
    // particular call was made).
    const idx = frameQueueRef.current.findIndex(f => f.id === expectedId);
    if (idx !== -1) {
      return Promise.resolve(frameQueueRef.current.splice(idx, 1)[0]);
    }

    return new Promise<CanFrame | null>((resolve) => {
      let settled = false;
      const waiter = (frame: CanFrame) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(frame);
      };

      let list = waitersRef.current.get(expectedId);
      if (!list) { list = []; waitersRef.current.set(expectedId, list); }
      list.push(waiter);

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const l = waitersRef.current.get(expectedId);
        if (l) {
          const i = l.indexOf(waiter);
          if (i !== -1) l.splice(i, 1);
        }
        resolve(null);
      }, timeoutMs);
    });
  };

  // Hands a freshly-received frame to the oldest pending waitForFrame caller
  // for its ID (FIFO), if any; otherwise queues it in frameQueueRef for a
  // future waitForFrame call to pick up (same 500-frame cap as before).
  const deliverOrQueue = (frame: CanFrame) => {
    const list = waitersRef.current.get(frame.id);
    if (list && list.length > 0) {
      const waiter = list.shift()!;
      waiter(frame);
      return;
    }
    frameQueueRef.current.push(frame);
    if (frameQueueRef.current.length > 500) {
      frameQueueRef.current.shift();
    }
  };

  // Fires when the OS reports the physical port gone (cable unplugged,
  // adapter powered off) - distinct from disconnect() below, which is the
  // user-initiated "click Disconnect" path and can still talk to a live
  // port (send the SLCAN 'C' close command, call port.close()). Here the
  // port is already gone, so this only resets local state to match reality
  // instead of leaving the UI claiming "connected" to a port that no
  // longer exists.
  const handlePortGone = useCallback(() => {
    keepReadingRef.current = false;
    portRef.current = null;
    writerRef.current = null;
    readerRef.current = null;
    setIsConnected(false);
    setPortName('');
  }, []);

  const onNativeDisconnect = useCallback((event: any) => {
    if (event.target === portRef.current) {
      handlePortGone();
    }
  }, [handlePortGone]);

  const connect = async () => {
    if (!('serial' in navigator)) {
      alert(t('hooks.web_serial_unsupported', 'Web Serial API is not supported in this browser. Please use Chrome or Edge.'));
      return;
    }

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

      // SLCAN Init Sequence
      await _sendRaw('C');
      await new Promise(r => setTimeout(r, 50));
      await _sendRaw('S6'); // 500 kbit/s
      await new Promise(r => setTimeout(r, 50));
      await _sendRaw('O'); // Open

      setIsConnected(true);
      readLoop();
    } catch (e: any) {
      console.error('Failed to connect', e);
      if (e.message?.includes('requestPort') || e.name === 'SecurityError') {
        alert(t('hooks.iframe_blocked', 'Cannot access USB/Serial from this iframe. Please click the "Open in new tab" button at the top right of the preview pane to use the Web Serial API.'));
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
    setIsConnected(false);
    setPortName('');
  };

  const _sendRaw = async (cmd: string) => {
    if (writerRef.current) {
      const data = new TextEncoder().encode(cmd + '\r');
      await writerRef.current.write(data);
    }
  };

  const sendFrame = async (id: number, data: number[], description: string = 'Sent from Web Studio') => {
    if (!isConnected) return;
    const dlc = data.length;
    let hexData = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    const cmd = `t${id.toString(16).padStart(3, '0').toUpperCase()}${dlc}${hexData}`;

    await _sendRaw(cmd);

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
      description
    });
  };

  const readLoop = async () => {
    while (portRef.current && portRef.current.readable && keepReadingRef.current) {
      readerRef.current = portRef.current.readable.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { value, done } = await readerRef.current.read();
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
        readerRef.current.releaseLock();
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
            const idHex = line.substring(1, 4);
            const id = parseInt(idHex, 16);
            const dlc = parseInt(line.substring(4, 5), 16);
            const dataHexStr = line.substring(5, 5 + dlc * 2);
            
            const data: number[] = [];
            for (let j = 0; j < dlc * 2; j += 2) {
              data.push(parseInt(dataHexStr.substring(j, j + 2), 16));
            }
            
            const now = new Date();
            const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
            
            const dataHexFormatted = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

            const frame: CanFrame = {
              id,
              idHex: `0x${idHex.toUpperCase()}`,
              dlc,
              data,
              dataHex: dataHexFormatted,
              timestamp,
              direction: 'Rx',
              description: 'Incoming from CAN hardware'
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

  return {
    isConnected,
    portName,
    connect,
    disconnect,
    sendFrame,
    waitForFrame,
    subscribe,
    subscribeAll
  };
}

export type SerialCanBus = ReturnType<typeof useSerialCanBus>;
