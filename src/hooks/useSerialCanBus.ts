import { useState, useRef } from 'react';
import { CanFrame } from '../types';

export function useSerialCanBus(onFrameReceived: (frame: CanFrame) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [portName, setPortName] = useState<string>('');
  
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const writerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(true);
  const rxBufferRef = useRef<string>('');
  const frameQueueRef = useRef<CanFrame[]>([]);

  const waitForFrame = async (expectedId: number, timeoutMs: number = 3000): Promise<CanFrame | null> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const idx = frameQueueRef.current.findIndex(f => f.id === expectedId);
      if (idx !== -1) {
        const frame = frameQueueRef.current.splice(idx, 1)[0];
        return frame;
      }
      await new Promise(r => setTimeout(r, 10)); // Poll
    }
    return null;
  };

  const connect = async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setPortName('USB-CAN Adapter');

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
        alert('Cannot access USB/Serial from this iframe. Please click the "Open in new tab" button at the top right of the preview pane to use the Web Serial API.');
      } else if (e.name === 'NotFoundError' || e.message?.includes('No port selected by the user') || e.message?.includes('Request failed')) {
        // User cancelled the prompt, do not show an alert
        console.log('User cancelled serial port selection.');
      } else {
        alert('Connection failed: ' + (e.message || 'Unknown error'));
      }
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
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
      await portRef.current.close();
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

  const sendFrame = async (id: number, data: number[]) => {
    if (!isConnected) return;
    const dlc = data.length;
    let hexData = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    const cmd = `t${id.toString(16).padStart(3, '0').toUpperCase()}${dlc}${hexData}`;
    
    await _sendRaw(cmd);
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
            processBuffer();
          }
        }
      } catch (error) {
        console.error('Read error:', error);
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
            
            frameQueueRef.current.push(frame);
            // keep the queue from growing indefinitely
            if (frameQueueRef.current.length > 500) {
              frameQueueRef.current.shift();
            }

            onFrameReceived(frame);
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
    waitForFrame
  };
}
