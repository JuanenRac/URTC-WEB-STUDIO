import {
  MN_VERSION, MN_ADDRESS_MASK, MN_NODE_MAX, MN_NODE_TIMEOUT_MS, MN_SELECT_TIMEOUT_MS, MN_DISCOVER_SLOT_MS, MN_SELECT_SELECT,
  MN_SELECT_DESELECT_ALL, MN_STATE_SELECTED, MN_STATE_FAULT, MN_STATE_CONFLICT, MN_STATE_BOOTLOADER, BITRATE,
  CAN_ID_ENTER_BOOTLOADER, CAN_ID_MULTINODE_CONFIG_RESP,
  mnSplitId, encodeMnDiscover, encodeMnSelect, encodeMnSafeStop, decodeMnNodeInfo, decodeMnNodeStatus,
  encodeMultinodeConfigRespRequest, decodeMultinodeConfigRespResponse,
} from './generated/urtcCanIds';

// The window of the tool heads, without a window: what to show for each head of a bus that carries several (the multinode extension of the
// firmware, off by default), how to select one and keep it, what to do when the selected head is lost, and which frames may go out while
// several heads are on the bus. The same rules as urtc_common.node_picker (Python, in the flasher and the tester): both are held to
// conformance/node_picker_vectors.json. No React and no serial port here; the caller gives the clock, a way to send and a way to wait.
// Tried against a model of the bus (multinodeSim.ts) only, never against boards.

export type NodeStatus = 'ready' | 'selected' | 'conflict' | 'fault' | 'bootloader' | 'lost';
export type SwitchState = 'unknown' | 'off' | 'on' | 'pending_on' | 'pending_off';
export type PickerMode = 'idle' | 'legacy' | 'multi';
export type NoticeLevel = 'info' | 'warning' | 'error';

/** The state of one head as a person reads it. A conflict, a lost head, a fault and a bootloader each rule out a selection. */
export function classifyNode(state: number, conflict: boolean, alive: boolean): NodeStatus {
  if (conflict || (state & MN_STATE_CONFLICT) !== 0) return 'conflict';
  if (!alive) return 'lost';
  if ((state & MN_STATE_FAULT) !== 0) return 'fault';
  if ((state & MN_STATE_BOOTLOADER) !== 0) return 'bootloader';
  if ((state & MN_STATE_SELECTED) !== 0) return 'selected';
  return 'ready';
}

/** What the answer of the head to 0x1AC/0x1AD (stored, running) says about the switch of the extension. */
export function switchState(config: { stored?: number; running?: number } | null | undefined): SwitchState {
  if (!config || (config.stored === undefined && config.running === undefined)) return 'unknown';
  const stored = !!config.stored;
  const running = !!config.running;
  if (stored && running) return 'on';
  if (stored && !running) return 'pending_on';
  if (running && !stored) return 'pending_off';
  return 'off';
}

/** The key (after "nodes.") of the text for a refusal reason, matched on the words it contains. */
export function failKey(reason: string): string {
  const text = reason.toLowerCase();
  for (const [word, key] of [['announced', 'fail_not_announced'], ['gone', 'fail_gone'], ['address', 'fail_conflict'], ['fault', 'fail_fault'],
    ['bootloader', 'fail_bootloader'], ['confirm', 'fail_unconfirmed']] as const) {
    if (text.includes(word)) return key;
  }
  return 'fail_other';
}

const STATUS_FAIL_KEYS: Partial<Record<NodeStatus, string>> = { conflict: 'fail_conflict', fault: 'fail_fault', bootloader: 'fail_bootloader', lost: 'fail_gone' };
const FRAME_OVERHEAD_BITS = 47;
const STUFFED_OVERHEAD_BITS = 34;

function frameBits(dlc: number, worstCase: boolean): number {
  let bits = FRAME_OVERHEAD_BITS + 8 * dlc;
  if (worstCase) bits += Math.floor((STUFFED_OVERHEAD_BITS + 8 * dlc - 1) / 4);
  return bits;
}

/** How long the host waits for every answer to DISCOVER: the longer of the last slot plus one frame and all the frames back to back, plus a slot. */
export function discoverWindowMs(slotMs: number = MN_DISCOVER_SLOT_MS): number {
  const frameMs = (1000 * frameBits(8, true)) / BITRATE;
  const last = MN_ADDRESS_MASK * slotMs + frameMs;
  return Math.max(last, MN_NODE_MAX * frameMs) + slotMs;
}

export interface NodeRecord {
  node: number; tool: number; state: number; instance: number; serial: number; lastSeenMs: number; error: number; uptimeS: number; conflict: boolean;
}

export class NodeTable {
  nodes = new Map<number, NodeRecord>();

  onInfo(node: number, fields: { tool: number; state: number; instance: number; serial: number }, nowMs: number): NodeRecord {
    const known = this.nodes.get(node);
    const record: NodeRecord = { node, tool: fields.tool, state: fields.state, instance: fields.instance, serial: fields.serial, lastSeenMs: nowMs, error: 0, uptimeS: 0, conflict: false };
    if (known && known.serial !== record.serial) {
      // Two different boards claim one address: neither is trusted until one is removed or re-addressed.
      record.conflict = true;
      known.conflict = true;
    } else if (known) {
      record.conflict = known.conflict;
    }
    this.nodes.set(node, record);
    return record;
  }

  onStatus(node: number, fields: { state: number; error: number; uptime_s: number }, nowMs: number): NodeRecord | null {
    const record = this.nodes.get(node);
    if (!record) return null;
    record.state = fields.state;
    record.error = fields.error;
    record.uptimeS = fields.uptime_s;
    record.lastSeenMs = nowMs;
    return record;
  }

  alive(nowMs: number): number[] {
    return [...this.nodes.values()].filter(r => nowMs - r.lastSeenMs <= MN_NODE_TIMEOUT_MS).map(r => r.node).sort((a, b) => a - b);
  }

  /** The one live node that reports itself selected, or null; more than one is an error the host must clear. */
  selected(nowMs: number): number | null {
    const chosen = this.alive(nowMs).filter(n => (this.nodes.get(n)!.state & MN_STATE_SELECTED) !== 0);
    return chosen.length === 1 ? chosen[0] : null;
  }

  /** A node may be commanded only while it is alive, in no conflict, with no latched fault and out of its bootloader. */
  mayCommand(node: number, nowMs: number): boolean {
    const record = this.nodes.get(node);
    if (!record || !this.alive(nowMs).includes(node) || record.conflict) return false;
    return (record.state & (MN_STATE_FAULT | MN_STATE_CONFLICT | MN_STATE_BOOTLOADER)) === 0;
  }
}

export class NodeNotReady extends Error {
  constructor(public node: number | null, public reason: string) {
    super(`node ${node}: ${reason}`);
  }
}

/** A single-head frame was not sent because several heads are on the bus and none is selected and confirmed. */
export class NodeBlocked extends Error {
  constructor() {
    super('Several heads are on the bus: select one before sending commands.');
  }
}

export interface NodeIO {
  send(id: number, data: number[]): void | Promise<void>;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface Notice { key: string; params: Record<string, string | number>; level: NoticeLevel }
export interface Lapse { node: number; reason: string; released: boolean; atMs: number }
export interface NodeRow { address: number; toolId: number; tool: string; serial: string; instance: number; status: NodeStatus; mine: boolean; selectable: boolean }

export interface PickerSnapshot {
  mode: PickerMode; searched: boolean; switch: SwitchState; rows: NodeRow[]; selected: number | null; pending: number | null;
  confirm: { node: number; tool: string; serial: string } | null; releaseOnLapse: boolean; maySend: boolean; count: number;
}

export const STOP_REASON_HOST_LAPSE = 0x10;
const WHY_KEYS: Record<string, string> = { gone: 'why_gone', conflict: 'why_conflict', fault: 'why_fault', bootloader: 'why_bootloader', lost: 'why_lost', several: 'why_several' };

export interface PickerOptions {
  toolName?: (tool: number) => string;
  slotMs?: number;
  confirmMs?: number;
  attempts?: number;
  releaseOnLapse?: boolean;
  /** Reads the multinode switch of the head (0x1AD); resolves null when nobody answers. */
  readConfig?: () => Promise<{ stored?: number; running?: number } | null>;
}

export class NodePicker {
  table = new NodeTable();
  mode: PickerMode = 'idle';
  switch: SwitchState = 'unknown';
  searched = false;
  pending: number | null = null;
  wanted: number | null = null;
  releaseOnLapse: boolean;
  suspended = false;
  inBootloaderSession = false;
  notices: Notice[] = [];
  lapses: Lapse[] = [];
  private seq = 0;
  private lastSelectMs = 0;
  private readonly toolName: (tool: number) => string;
  private readonly slotMs: number;
  private readonly confirmMs: number;
  private readonly attempts: number;
  private readonly readConfig?: PickerOptions['readConfig'];

  constructor(private io: NodeIO, options: PickerOptions = {}) {
    this.toolName = options.toolName ?? ((tool) => `tool ${tool}`);
    this.slotMs = options.slotMs ?? MN_DISCOVER_SLOT_MS;
    this.confirmMs = options.confirmMs ?? 100;
    this.attempts = options.attempts ?? 3;
    this.releaseOnLapse = options.releaseOnLapse ?? true;
    this.readConfig = options.readConfig;
  }

  // -- listening -------------------------------------------------------------------------------------------------------------------
  /** Every frame received goes through here; only the frames of the extension matter. */
  onFrame(id: number, data: number[]): void {
    const split = mnSplitId(id);
    if (!split) return;
    const [name, node] = split;
    const now = this.io.now();
    if (name === 'NODE_INFO' && node !== null) {
      const f = decodeMnNodeInfo(data);
      if (f) this.table.onInfo(node, f as never, now);
    } else if (name === 'NODE_STATUS' && node !== null) {
      const f = decodeMnNodeStatus(data);
      if (f && this.table.onStatus(node, f as never, now) === null) {
        // A status from a node never announced: ask everyone to announce, so it is listed with its serial.
        const frame = encodeMnDiscover(MN_VERSION, this.slotMs);
        void this.io.send(frame.id, frame.data);
      }
    }
  }

  // -- finding the heads -----------------------------------------------------------------------------------------------------------
  /** Read the switch of the extension, look for heads and say what was found. Never selects anything. */
  async scan(): Promise<void> {
    this.pending = null;
    this.inBootloaderSession = false;
    this.wanted = null;
    try {
      if (this.readConfig) {
        this.switch = switchState(await this.readConfig());
      } else {
        this.switch = 'unknown';
      }
      this.table = new NodeTable();
      const frame = encodeMnDiscover(MN_VERSION, this.slotMs);
      await this.io.send(frame.id, frame.data);
      await this.io.sleep(Math.ceil(discoverWindowMs(this.slotMs)));
    } catch (error) {
      this.mode = 'idle';
      this.say('msg_scan_failed', 'error', { text: error instanceof Error ? error.message : String(error) });
      return;
    }
    this.searched = true;
    const found = this.table.alive(this.io.now());
    this.mode = found.length > 0 ? 'multi' : 'legacy';
    if (this.switch !== 'on') this.say(`sw_${this.switch}`, this.switch === 'pending_on' || this.switch === 'pending_off' ? 'warning' : 'info');
    this.say(found.length > 0 ? 'msg_found' : 'msg_legacy', 'info', { count: found.length });
  }

  rows(): NodeRow[] {
    const now = this.io.now();
    const alive = new Set(this.table.alive(now));
    return [...this.table.nodes.keys()].sort((a, b) => a - b).map(address => {
      const record = this.table.nodes.get(address)!;
      const status = classifyNode(record.state, record.conflict, alive.has(address));
      return {
        address, toolId: record.tool, tool: this.toolName(record.tool), serial: record.serial.toString(16).toUpperCase().padStart(8, '0'),
        instance: record.instance, status, mine: this.wanted === address && status === 'selected', selectable: status === 'ready',
      };
    });
  }

  // -- choosing --------------------------------------------------------------------------------------------------------------------
  /** The person pressed Select on a row: nothing is sent yet; the window shows the confirmation and waits for confirm(). */
  ask(node: number): boolean {
    const row = this.rows().find(r => r.address === node);
    if (!row || !row.selectable) {
      this.say(row ? (STATUS_FAIL_KEYS[row.status] ?? 'fail_other') : 'fail_not_announced', 'error');
      return false;
    }
    this.pending = node;
    return true;
  }

  cancel(): void { this.pending = null; }

  /** The person confirmed: select the head and wait until it says it is selected. A failure leaves nothing selected. */
  async confirm(): Promise<boolean> {
    const node = this.pending;
    this.pending = null;
    if (node === null) return false;
    this.inBootloaderSession = false;
    try {
      await this.select(node);
    } catch (error) {
      if (error instanceof NodeNotReady) {
        this.say(failKey(error.reason), 'error');
        return false;
      }
      throw error;
    }
    this.say('msg_selected', 'info', { node });
    return true;
  }

  private severalSelected(): boolean {
    const now = this.io.now();
    return this.table.alive(now).filter(n => (this.table.nodes.get(n)!.state & MN_STATE_SELECTED) !== 0).length > 1;
  }

  private whyNot(node: number, now: number): string {
    const record = this.table.nodes.get(node)!;
    if (!this.table.alive(now).includes(node)) return 'gone (no status for too long)';
    if (record.conflict || (record.state & MN_STATE_CONFLICT) !== 0) return 'another board uses its address';
    if ((record.state & MN_STATE_FAULT) !== 0) return 'a fault is latched';
    if ((record.state & MN_STATE_BOOTLOADER) !== 0) return 'in its bootloader';
    return 'not ready';
  }

  /** Select a head and wait for its own status to say so. Throws NodeNotReady and leaves nothing selected when it cannot. */
  async select(node: number): Promise<void> {
    const now = this.io.now();
    if (!this.table.nodes.has(node)) throw new NodeNotReady(node, 'not announced');
    if (!this.table.mayCommand(node, now)) throw new NodeNotReady(node, this.whyNot(node, now));
    this.suspended = false;
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      this.seq = (this.seq + 1) & 0xFF;
      const frame = encodeMnSelect(MN_SELECT_SELECT, node, this.seq);
      await this.io.send(frame.id, frame.data);
      this.lastSelectMs = this.io.now();
      for (let waited = 0; waited < this.confirmMs; waited += 5) {
        await this.io.sleep(5);
        const chosen = this.table.selected(this.io.now());
        if (chosen === node) { this.wanted = node; return; }
        if (chosen === null && this.severalSelected()) break;
      }
      if (this.severalSelected()) {
        // Two heads report themselves selected: no selection until it is cleared, then try again.
        const clear = encodeMnSelect(MN_SELECT_DESELECT_ALL, 0, this.seq);
        await this.io.send(clear.id, clear.data);
        await this.io.sleep(this.confirmMs);
      }
    }
    const clear = encodeMnSelect(MN_SELECT_DESELECT_ALL, 0, this.seq);
    await this.io.send(clear.id, clear.data);
    this.wanted = null;
    throw new NodeNotReady(node, 'did not confirm the selection');
  }

  async release(): Promise<void> {
    const frame = encodeMnSelect(MN_SELECT_DESELECT_ALL, 0, this.seq);
    await this.io.send(frame.id, frame.data);
    this.wanted = null;
    this.pending = null;
    this.suspended = false;
    this.inBootloaderSession = false;
    this.say('msg_released');
  }

  // -- keeping it ------------------------------------------------------------------------------------------------------------------
  private lapseReason(node: number, now: number): string | null {
    const record = this.table.nodes.get(node);
    if (!record || !this.table.alive(now).includes(node)) return 'gone';
    if (record.conflict || (record.state & MN_STATE_CONFLICT) !== 0) return 'conflict';
    if ((record.state & MN_STATE_FAULT) !== 0) return 'fault';
    if ((record.state & MN_STATE_BOOTLOADER) !== 0) return 'bootloader';
    if (this.severalSelected()) return 'several';
    if ((record.state & MN_STATE_SELECTED) === 0 && now - this.lastSelectMs > this.confirmMs) return 'lost';
    return null;
  }

  /**
   * Call while working: notices a head that is no longer confirmed selected and repeats SELECT before it lapses. When the head being driven is
   * gone, in conflict, faulted, in its bootloader or no longer reports itself selected, the selection is forgotten, a lapse is recorded and, with
   * releaseOnLapse (the default), SAFE_STOP is sent so no head keeps an output on without a host watching it.
   */
  async tick(): Promise<void> {
    if (this.suspended || this.wanted === null) return;
    const now = this.io.now();
    const why = this.lapseReason(this.wanted, now);
    if (why !== null) {
      const node = this.wanted;
      this.lapses.push({ node, reason: why, released: this.releaseOnLapse, atMs: now });
      this.wanted = null;
      this.say(this.releaseOnLapse ? 'lapse_released' : 'lapse_kept', this.releaseOnLapse ? 'warning' : 'error', { node, whyKey: WHY_KEYS[why] ?? 'why_lost' });
      if (this.releaseOnLapse) {
        const frame = encodeMnSafeStop(STOP_REASON_HOST_LAPSE);
        await this.io.send(frame.id, frame.data);
      }
      return;
    }
    if (now - this.lastSelectMs >= MN_SELECT_TIMEOUT_MS / 2) {
      this.seq = (this.seq + 1) & 0xFF;
      const frame = encodeMnSelect(MN_SELECT_SELECT, this.wanted, this.seq);
      this.lastSelectMs = now;
      await this.io.send(frame.id, frame.data);
    }
  }

  // -- the gate --------------------------------------------------------------------------------------------------------------------
  confirmedSelected(): boolean {
    if (this.wanted === null) return false;
    const now = this.io.now();
    return this.table.mayCommand(this.wanted, now) && this.table.selected(now) === this.wanted;
  }

  maySend(): boolean {
    if (this.mode === 'legacy' || (this.mode === 'idle' && this.table.nodes.size === 0)) return true;
    return this.confirmedSelected();
  }

  /**
   * Called before a single-head frame goes out. With heads on the bus it must go to the selected, confirmed head: anything else throws
   * NodeBlocked and nothing is sent. The enter-bootloader frame needs the confirmation like any other and, once it has gone, the bootloader
   * frames of that head pass (the bootloader is not part of the extension and the head stops reporting by design, so the selection is not
   * watched until it is released). The frames of the extension itself, and the read of the switch, are not single-head frames.
   */
  gate(id: number, data: number[] = []): void {
    if (mnSplitId(id) !== null) return;
    if (id === CAN_ID_MULTINODE_CONFIG_RESP && data.length === 0) return;
    if (this.mode !== 'multi') return;
    if (this.inBootloaderSession && id >= 0x7F1 && id <= 0x7FF) return;
    if (!this.maySend()) throw new NodeBlocked();
    if (id === CAN_ID_ENTER_BOOTLOADER) {
      this.inBootloaderSession = true;
      this.suspended = true;
    }
  }

  // -- saying it -------------------------------------------------------------------------------------------------------------------
  private say(key: string, level: NoticeLevel = 'info', params: Record<string, string | number> = {}): void {
    this.notices.push({ key, params, level });
  }

  takeNotices(): Notice[] {
    const taken = this.notices;
    this.notices = [];
    return taken;
  }

  takeLapses(): Lapse[] {
    const taken = this.lapses;
    this.lapses = [];
    return taken;
  }

  snapshot(): PickerSnapshot {
    const rows = this.rows();
    const pendingRow = this.pending === null ? undefined : rows.find(r => r.address === this.pending);
    return {
      mode: this.mode, searched: this.searched, switch: this.switch, rows, selected: this.wanted, pending: this.pending,
      confirm: pendingRow ? { node: pendingRow.address, tool: pendingRow.tool, serial: pendingRow.serial } : null,
      releaseOnLapse: this.releaseOnLapse, maySend: this.maySend(), count: rows.length,
    };
  }
}

/** The request that asks the head for its multinode switch; the answer is decoded with readConfigAnswer. */
export function configRequest(): { id: number; data: number[] } {
  return encodeMultinodeConfigRespRequest();
}

export function readConfigAnswer(id: number, data: number[]): { stored: number; running: number } | null {
  if (id !== CAN_ID_MULTINODE_CONFIG_RESP) return null;
  const fields = decodeMultinodeConfigRespResponse(data);
  return fields ? { stored: Number(fields.stored), running: Number(fields.running) } : null;
}
