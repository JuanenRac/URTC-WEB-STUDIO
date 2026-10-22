// Simulator of the tool rack (URTC-SMART-RACK) for the studio: no board needed. Same rules as urtc_common.rack_sim and as the C code
// of the rack; the shared vectors check all three.
export const RACK_SOF = 0xA5;
export const RACK_VERSION = 1;
export const RACK_MAX_PAYLOAD = 16;
export const RACK_CMD_SET_PREHEAT = 0x01;
export const RACK_TOOL_ID_NONE = 31;
export const RACK_TOOL_ID_LAST = 24;
export const RACK_CEILING_C = 400;
export const RACK_LINK_TIMEOUT_MS = 250;
export const RACK_PREHEAT_MAX_MS = 600_000;
export const RACK_SLOTS = 8;
const MAX_PREHEAT_C: Record<number, number> = { 0: RACK_CEILING_C, 10: 310, 19: RACK_CEILING_C };

export function rackCrc8(data: ArrayLike<number>): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let b = 0; b < 8; b++) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
  }
  return crc;
}

export function encodeRackFrame(seq: number, cmd: number, payload: number[] = []): number[] {
  if (payload.length > RACK_MAX_PAYLOAD) throw new Error('payload too long');
  const body = [RACK_SOF, RACK_VERSION, seq & 0xFF, cmd & 0xFF, payload.length, ...payload];
  return [...body, rackCrc8(body)];
}

export type RackFrameStatus = 'ok' | 'incomplete' | 'bad_sof' | 'unsupported_version' | 'length_out_of_range' | 'crc_mismatch';

export function parseRackFrame(buf: number[]): { status: RackFrameStatus; frame: { seq: number; cmd: number; payload: number[] } | null } {
  if (buf.length < 6) return { status: 'incomplete', frame: null };
  if (buf[0] !== RACK_SOF) return { status: 'bad_sof', frame: null };
  if (buf[1] !== RACK_VERSION) return { status: 'unsupported_version', frame: null };
  const len = buf[4];
  if (len > RACK_MAX_PAYLOAD) return { status: 'length_out_of_range', frame: null };
  if (buf.length < 5 + len + 1) return { status: 'incomplete', frame: null };
  if (rackCrc8(buf.slice(0, 5 + len)) !== buf[5 + len]) return { status: 'crc_mismatch', frame: null };
  return { status: 'ok', frame: { seq: buf[2], cmd: buf[3], payload: buf.slice(5, 5 + len) } };
}

export const encodeSetPreheat = (seq: number, tool: number, targetC: number) => encodeRackFrame(seq, RACK_CMD_SET_PREHEAT, [tool, targetC & 0xFF, (targetC >> 8) & 0xFF]);

export type RackCommandStatus = 'ok' | 'wrong_payload_len' | 'tool_id_absent' | 'temp_out_of_range' | 'tool_id_invalid' | 'tool_not_heatable';

export function validateSetPreheat(payload: number[]): { status: RackCommandStatus; tool: number; target: number } {
  if (payload.length !== 3) return { status: 'wrong_payload_len', tool: 0, target: 0 };
  const tool = payload[0];
  if (tool > 31) return { status: 'tool_id_invalid', tool, target: 0 };
  if (tool === RACK_TOOL_ID_NONE) return { status: 'tool_id_absent', tool, target: 0 };
  if (tool > RACK_TOOL_ID_LAST) return { status: 'tool_id_invalid', tool, target: 0 };
  const target = payload[1] | (payload[2] << 8);
  if (target > RACK_CEILING_C) return { status: 'temp_out_of_range', tool, target };
  const ceiling = MAX_PREHEAT_C[tool] ?? 0;
  if (target > 0 && ceiling === 0) return { status: 'tool_not_heatable', tool, target };
  if (target > ceiling) return { status: 'temp_out_of_range', tool, target };
  return { status: 'ok', tool, target };
}

export interface RackSlot { occupied: boolean; toolId: number; serial: number; targetC: number }
export interface RackReply { kind: 'ack' | 'nack' | 'none'; action: 'none' | 'set_target' | 'safe_state'; toolId: number | null; targetC: number | null; detail: string }

/** The unit key of a slot: the tool type plus the serial number, or null when the serial is unknown. */
export const unitKey = (s: RackSlot) => (s.occupied && s.serial ? `${s.toolId}:${s.serial}` : null);

export class SimulatedRack {
  slots: RackSlot[] = Array.from({ length: RACK_SLOTS }, () => ({ occupied: false, toolId: RACK_TOOL_ID_NONE, serial: 0, targetC: 0 }));
  lastRxMs: number | null = null;
  lastSeq = new Map<number, number>();
  startedMs = new Map<number, number>();
  expired = new Set<number>();
  constructor(public preheatMaxMs: number | null = RACK_PREHEAT_MAX_MS) {}

  setSlot(slot: number, toolId: number, serial = 0) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= RACK_SLOTS) throw new Error('slot out of range');
    if (toolId === RACK_TOOL_ID_NONE) {
      this.slots[slot] = { occupied: false, toolId: RACK_TOOL_ID_NONE, serial: 0, targetC: 0 };
      this.startedMs.delete(slot); this.expired.delete(slot);
      return;
    }
    if (!Number.isInteger(toolId) || toolId < 0 || toolId > RACK_TOOL_ID_LAST) throw new Error('not a tool profile');
    this.slots.forEach((s, other) => {
      if (other !== slot && s.occupied && s.toolId === toolId && (!serial || s.serial === serial || !s.serial)) {
        this.slots[other] = { occupied: false, toolId: RACK_TOOL_ID_NONE, serial: 0, targetC: 0 };
      }
    });
    this.slots[slot] = { occupied: true, toolId, serial: serial & 0xFF, targetC: 0 };
    this.startedMs.delete(slot); this.expired.delete(slot);
  }

  private find(toolId: number): number | null {
    const i = this.slots.findIndex(s => s.occupied && s.toolId === toolId);
    return i < 0 ? null : i;
  }

  linkLost(nowMs: number) { return this.lastRxMs === null || nowMs - this.lastRxMs >= RACK_LINK_TIMEOUT_MS; }

  tick(nowMs: number): number {
    let cut = 0;
    if (this.lastRxMs !== null && this.linkLost(nowMs)) { this.lastRxMs = null; this.lastSeq.clear(); }
    const lost = this.linkLost(nowMs);
    this.slots.forEach((s, i) => {
      if (!s.occupied || s.targetC === 0) return;
      const ranOut = this.preheatMaxMs !== null && nowMs - (this.startedMs.get(i) ?? nowMs) >= this.preheatMaxMs;
      if (lost || ranOut) { s.targetC = 0; cut++; if (ranOut && !lost) this.expired.add(i); }
    });
    return cut;
  }

  receive(buf: number[], nowMs: number): RackReply {
    const { status, frame } = parseRackFrame(buf);
    if (!frame) return { kind: 'none', action: 'none', toolId: null, targetC: null, detail: `frame refused: ${status}` };
    this.tick(nowMs);
    this.lastRxMs = nowMs;
    if (frame.cmd !== RACK_CMD_SET_PREHEAT) return { kind: 'none', action: 'none', toolId: null, targetC: null, detail: 'command not acted on' };
    return this.setPreheat(frame.seq, frame.payload, nowMs);
  }

  private setPreheat(seq: number, payload: number[], nowMs: number): RackReply {
    const { status, tool, target } = validateSetPreheat(payload);
    if (status !== 'ok') {
      if (payload.length >= 1 && payload[0] <= RACK_TOOL_ID_LAST) {
        const slot = this.find(payload[0]);
        if (slot !== null) this.slots[slot].targetC = 0;
        return { kind: 'nack', action: 'safe_state', toolId: payload[0], targetC: 0, detail: status };
      }
      return { kind: 'nack', action: 'none', toolId: null, targetC: null, detail: status };
    }
    const prev = this.lastSeq.get(tool);
    if (prev !== undefined) {
      const d = (seq - prev) & 0xFF;
      if (d === 0 || d >= 128) return { kind: 'ack', action: 'none', toolId: tool, targetC: null, detail: 'retransmission already applied' };
    }
    this.lastSeq.set(tool, seq);
    const slot = this.find(tool);
    if (slot === null) return { kind: 'ack', action: 'none', toolId: tool, targetC: target, detail: 'tool not racked: target not applied' };
    if (this.expired.has(slot)) {
      if (target === 0) this.expired.delete(slot);
      else return { kind: 'ack', action: 'none', toolId: tool, targetC: target, detail: 'pre-heat limit reached: send 0 or swap the tool' };
    }
    if (target > 0 && this.slots[slot].targetC === 0) this.startedMs.set(slot, nowMs);
    this.slots[slot].targetC = target;
    return { kind: 'ack', action: 'set_target', toolId: tool, targetC: target, detail: '' };
  }
}

export type SlotVerdict = 'unknown' | 'empty_ok' | 'heater_in_empty_slot' | 'idle_ok' | 'still_hot' | 'heating' | 'reached' | 'not_reached' | 'overshoot';

/** What the thermal reading of a slot says about the pre-heat that was ordered. */
export function verifySlot(occupied: boolean, commandedC: number, measuredC: number | null, ambientC: number, elapsedMs: number): SlotVerdict {
  if (measuredC === null || Number.isNaN(measuredC)) return 'unknown';
  if (!occupied) return measuredC > ambientC + 40 ? 'heater_in_empty_slot' : 'empty_ok';
  if (commandedC === 0) return measuredC > ambientC + 60 ? 'still_hot' : 'idle_ok';
  if (measuredC > commandedC + 25) return 'overshoot';
  if (measuredC >= commandedC - 15) return 'reached';
  return elapsedMs >= 60_000 ? 'not_reached' : 'heating';
}
