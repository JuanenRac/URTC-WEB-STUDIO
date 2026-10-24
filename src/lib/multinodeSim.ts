import {
  MN_ADDRESS_MASK, MN_DISCOVER_SLOT_MS, MN_LEGACY_LISTEN_MS, MN_NODE_MAX, MN_SELECT_TIMEOUT_MS, MN_STATUS_PERIOD_MS, MN_VERSION,
  MN_STATE_SELECTED, MN_STATE_FAULT, MN_STATE_CONFLICT, MN_SELECT_SELECT, MN_ID_DISCOVER, MN_ID_SELECT, MN_ID_SAFE_STOP,
  MN_ID_NODE_INFO_BASE, MN_ID_NODE_STATUS_BASE,
  encodeMnNodeInfo, encodeMnNodeStatus,
} from './generated/urtcCanIds';

// A model of the nodes of the multinode extension and of a bus that joins them, to try the tool head window against without boards. The same
// rules as urtc_common.multinode_sim (listen 1.5 s, behave as the one head when nobody is heard, start unselected when another node is heard,
// obey single-head frames only while selected, let a selection lapse after 2 s, latch a conflict when a frame arrives on the own address, obey
// SAFE_STOP always). A frame is delivered at the millisecond it is sent; arbitration is not modelled. Nothing here has been compared with boards.

const PHASE_LISTEN = 0, PHASE_UNSELECTED = 1, PHASE_SELECTED = 2, PHASE_LEGACY = 3;

export class SimNode {
  phase = PHASE_LISTEN;
  conflict = false;
  enabled = true;
  fault = false;
  error = 0;
  infoPending = true;
  statusNow = false;
  selectDeadlineMs = 0;
  infoDueMs: number;
  statusDueMs: number;
  stopReason = 0;
  safeStops = 0;
  obeyed: Array<[number, number[]]> = [];
  private bootMs: number;

  constructor(public address: number, public tool = 3, public serial = 0, startMs = 0) {
    this.address &= MN_ADDRESS_MASK;
    this.bootMs = startMs;
    this.infoDueMs = startMs + this.address * MN_DISCOVER_SLOT_MS;
    this.statusDueMs = startMs + MN_STATUS_PERIOD_MS;
  }

  private advance(now: number): void {
    if (this.phase === PHASE_LISTEN && now - this.bootMs >= MN_LEGACY_LISTEN_MS) this.phase = this.conflict ? PHASE_UNSELECTED : PHASE_LEGACY;
    if (this.phase === PHASE_SELECTED && now - this.selectDeadlineMs >= 0) { this.phase = PHASE_UNSELECTED; this.statusNow = true; }
  }

  maySingleHead(): boolean {
    return !this.conflict && (this.phase === PHASE_SELECTED || this.phase === PHASE_LEGACY);
  }

  stateFlags(): number {
    return (this.maySingleHead() ? MN_STATE_SELECTED : 0) | (this.fault ? MN_STATE_FAULT : 0) | (this.conflict ? MN_STATE_CONFLICT : 0);
  }

  /** Every received frame goes through here; returns true when the node asked the bus to count a SAFE_STOP (the safe state was entered). */
  onRx(id: number, data: number[], now: number): boolean {
    this.advance(now);
    if (id < MN_ID_DISCOVER || id > 0x49F) {
      if (this.maySingleHead()) this.obeyed.push([id, [...data]]);
      return false;
    }
    for (const base of [MN_ID_NODE_INFO_BASE, MN_ID_NODE_STATUS_BASE]) {
      if (id >= base && id < base + MN_NODE_MAX) {
        if ((id & MN_ADDRESS_MASK) === this.address) {
          if (!this.conflict) {
            this.conflict = true;
            this.phase = PHASE_UNSELECTED;
            this.statusNow = true;
            this.safeStops++;
            return true;
          }
        } else if (this.phase === PHASE_LISTEN) {
          this.phase = PHASE_UNSELECTED;
          this.statusNow = true;
        }
        return false;
      }
    }
    if (id === MN_ID_DISCOVER) {
      if (data.length === 2 && data[0] >= MN_VERSION && data[1] >= 1 && data[1] <= 50) {
        this.infoPending = true;
        this.infoDueMs = now + this.address * data[1];
      }
    } else if (id === MN_ID_SELECT) {
      if (data.length === 3 && data[0] <= MN_SELECT_SELECT && data[1] <= MN_ADDRESS_MASK) {
        if (data[0] === MN_SELECT_SELECT && data[1] === this.address) {
          if (!this.conflict) {
            this.phase = PHASE_SELECTED;
            this.selectDeadlineMs = now + MN_SELECT_TIMEOUT_MS;
            this.statusNow = true;
          }
        } else {
          this.phase = PHASE_UNSELECTED;
          this.statusNow = true;
        }
      }
    } else if (id === MN_ID_SAFE_STOP) {
      if (data.length === 1) {
        this.stopReason = data[0];
        this.safeStops++;
        return true;
      }
    }
    return false;
  }

  /** The next frame due, or null; call until it returns null. */
  service(now: number): { id: number; data: number[] } | null {
    this.advance(now);
    if (this.infoPending && now - this.infoDueMs >= 0) {
      this.infoPending = false;
      return encodeMnNodeInfo(this.address, this.tool, this.stateFlags(), 0, MN_VERSION, this.serial);
    }
    if (this.statusNow || now - this.statusDueMs >= 0) {
      this.statusNow = false;
      this.statusDueMs = now + MN_STATUS_PERIOD_MS;
      return encodeMnNodeStatus(this.address, this.stateFlags(), this.error, Math.min(Math.floor((now - this.bootMs) / 1000), 0xFFFF));
    }
    return null;
  }
}

export class SimBus {
  nodes: SimNode[] = [];
  now = 0;
  safeStateCalls = new Map<number, number>();
  /** The frames the host would hear: every frame a node sends. */
  onHostFrame: (id: number, data: number[]) => void = () => {};

  add(node: SimNode): SimNode { this.nodes.push(node); return node; }

  private deliver(id: number, data: number[], sender: SimNode | null): void {
    if (sender) this.onHostFrame(id, data);
    for (const node of this.nodes) {
      if (node === sender || !node.enabled) continue;
      if (node.onRx(id, data, this.now)) this.safeStateCalls.set(node.address, (this.safeStateCalls.get(node.address) ?? 0) + 1);
    }
  }

  hostSend(id: number, data: number[]): void { this.deliver(id, data, null); }

  step(ms: number): void {
    for (let i = 0; i < ms; i++) {
      this.now++;
      const due: Array<{ id: number; data: number[]; node: SimNode }> = [];
      for (const node of this.nodes) {
        if (!node.enabled) continue;
        for (let frame = node.service(this.now); frame; frame = node.service(this.now)) due.push({ ...frame, node });
      }
      due.sort((a, b) => a.id - b.id);
      for (const f of due) this.deliver(f.id, f.data, f.node);
    }
  }
}
