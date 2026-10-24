import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CanFrame } from '../types';
import { SerialCanBus } from './useSerialCanBus';
import { CAN_ID_MULTINODE_CONFIG_RESP } from '../lib/generated/urtcCanIds';
import { NodePicker, Notice, PickerSnapshot, configRequest, readConfigAnswer } from '../lib/nodePicker';
import { TOOL_PROFILES } from '../data/toolsData';
import { confirmController } from '../lib/confirmController';

const RELEASE_STORAGE_KEY = 'urtc-web-studio-heads-release-on-lapse';
const TICK_MS = 500;

function savedRelease(): boolean {
  try { return localStorage.getItem(RELEASE_STORAGE_KEY) !== '0'; } catch { return true; }
}
function saveRelease(value: boolean): void {
  try { localStorage.setItem(RELEASE_STORAGE_KEY, value ? '1' : '0'); } catch { /* a convenience only: the default is the protective one */ }
}

const EMPTY: PickerSnapshot = {
  mode: 'idle', searched: false, switch: 'unknown', rows: [], selected: null, pending: null, confirm: null, releaseOnLapse: true, maySend: true, count: 0,
};

export interface HeadMessage extends Notice { id: number }

/**
 * The state of the tool head window: one NodePicker per connection (made when the adapter connects, dropped when it goes), its frames fed from
 * the bus, a gate on the sends so a single-head frame never goes to a head that is not selected and confirmed, and a timer that keeps the
 * selection alive and notices a head that was lost. Nothing is sent to find the heads until the person asks.
 */
export function useNodePicker(bus: SerialCanBus) {
  const { t } = useTranslation();
  const pickerRef = useRef<NodePicker | null>(null);
  const busRef = useRef(bus);
  busRef.current = bus;
  const releasePreference = useRef(savedRelease());
  const [snapshot, setSnapshot] = useState<PickerSnapshot>({ ...EMPTY, releaseOnLapse: releasePreference.current });
  const [messages, setMessages] = useState<HeadMessage[]>([]);
  const [lapse, setLapse] = useState<HeadMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const nextId = useRef(1);

  const refresh = useCallback(() => {
    const picker = pickerRef.current;
    if (!picker) { setSnapshot({ ...EMPTY, releaseOnLapse: releasePreference.current }); return; }
    for (const notice of picker.takeNotices()) {
      const message = { ...notice, id: nextId.current++ };
      setMessages(previous => [...previous, message].slice(-12));
      if (notice.key === 'lapse_released' || notice.key === 'lapse_kept') setLapse(message);
      else if (notice.key === 'msg_selected' || notice.key === 'msg_released') setLapse(null);
    }
    setSnapshot(picker.snapshot());
  }, []);

  const run = useCallback(async (work: () => Promise<unknown> | unknown) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try { await work(); } finally { busyRef.current = false; setBusy(false); refresh(); }
  }, [refresh]);

  // One picker per connection.
  useEffect(() => {
    if (!bus.isConnected) {
      pickerRef.current = null;
      bus.setSendGate(null);
      setMessages([]);
      setLapse(null);
      refresh();
      return;
    }
    const toolName = (tool: number) => TOOL_PROFILES.find(profile => profile.id === tool)?.name ?? `tool ${tool}`;
    const io = {
      send: (id: number, data: number[]) => busRef.current.sendFrame(id, data, 'Tool heads'),
      now: () => Math.round(performance.now()),
      sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    };
    const picker = new NodePicker(io, {
      toolName,
      releaseOnLapse: releasePreference.current,
      readConfig: async () => {
        const request = configRequest();
        const answer = await busRef.current.request(request.id, request.data, CAN_ID_MULTINODE_CONFIG_RESP, 500, 'Tool heads: read the multinode switch');
        return answer ? readConfigAnswer(answer.id, answer.data) : null;
      },
    });
    pickerRef.current = picker;
    bus.setSendGate((id, data) => picker.gate(id, data));
    const unsubscribe = bus.subscribeAll((frame: CanFrame) => {
      if (frame.direction === 'Rx' && !frame.replayed && !frame.simulated) picker.onFrame(frame.id, frame.data);
    });
    refresh();
    return () => { unsubscribe(); bus.setSendGate(null); if (pickerRef.current === picker) pickerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.isConnected]);

  // Keep the selection alive and notice a head that was lost; stay off the bus while another call of the window is waiting for it.
  useEffect(() => {
    const timer = setInterval(() => {
      const picker = pickerRef.current;
      if (!picker || picker.wanted === null || busyRef.current) return;
      void run(() => picker.tick());
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [run]);

  const find = useCallback(() => {
    const picker = pickerRef.current;
    if (!picker) { setMessages(previous => [...previous, { key: 'msg_not_connected', params: {}, level: 'warning' as const, id: nextId.current++ }].slice(-12)); return; }
    void run(() => picker.scan());
  }, [run]);

  const select = useCallback(async (node: number) => {
    const picker = pickerRef.current;
    if (!picker || !picker.ask(node)) { refresh(); return; }
    const confirm = picker.snapshot().confirm;
    refresh();
    const yes = await confirmController.ask({
      risk: 'caution',
      title: t('nodes.title', 'Tool heads on the bus'),
      message: t('nodes.msg_confirm', 'Select the {{tool}} at address {{node}} (serial {{serial}})? Only this head will obey commands until you release it.', { tool: confirm?.tool, node, serial: confirm?.serial }),
      confirmLabel: t('nodes.btn_confirm', 'Yes, select it'),
      cancelLabel: t('nodes.btn_cancel', 'Cancel'),
    });
    if (!yes) { picker.cancel(); refresh(); return; }
    void run(() => picker.confirm());
  }, [refresh, run, t]);

  const release = useCallback(() => {
    const picker = pickerRef.current;
    if (picker) void run(() => picker.release());
  }, [run]);

  const setReleaseOnLapse = useCallback(async (value: boolean) => {
    if (!value) {
      const yes = await confirmController.ask({
        risk: 'danger',
        title: t('nodes.title', 'Tool heads on the bus'),
        message: t('nodes.opt_release_lower', 'Changing this means a head can keep an output on while nobody watches it. Continue?'),
        confirmLabel: t('nodes.btn_confirm', 'Yes, select it'),
        cancelLabel: t('nodes.btn_cancel', 'Cancel'),
      });
      if (!yes) return;
    }
    releasePreference.current = value;
    saveRelease(value);
    if (pickerRef.current) pickerRef.current.releaseOnLapse = value;
    refresh();
  }, [refresh, t]);

  return { snapshot, messages, lapse, busy, find, select, release, setReleaseOnLapse, isConnected: bus.isConnected };
}

export type NodePickerState = ReturnType<typeof useNodePicker>;
