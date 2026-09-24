// =============================================================================
// URTC-WEB-STUDIO - src/lib/deviceState.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0 - see LICENSE
// =============================================================================
// The state model for one device: whether it is reachable, and which
// configuration changes are only proposed. A change is kept in `pending`
// until the device confirms it; only then does it become part of `confirmed`.
// If the device refuses it, or the link drops first, the change is rolled
// back and the reason is kept. Pure functions, so every transition is tested
// without a serial port.

export type Connection = "offline" | "connecting" | "online" | "error";

export interface PendingChange {
  id: number;
  key: string;
  value: number;
}

export interface DeviceState {
  connection: Connection;
  /** Why the device is in the `error` state, or why the last change was refused. */
  message: string;
  /** What the device itself has confirmed. Never contains a value the device has not accepted. */
  confirmed: Record<string, number>;
  pending: PendingChange[];
  nextChangeId: number;
}

export const initialState = (): DeviceState => ({
  connection: "offline",
  message: "",
  confirmed: {},
  pending: [],
  nextChangeId: 1,
});

export function connecting(state: DeviceState): DeviceState {
  return { ...state, connection: "connecting", message: "" };
}

export function connected(state: DeviceState): DeviceState {
  return { ...state, connection: "online", message: "" };
}

export function failed(state: DeviceState, message: string): DeviceState {
  // A failed link cannot confirm anything: every proposed change is dropped.
  return { ...state, connection: "error", message, pending: [] };
}

export function disconnected(state: DeviceState): DeviceState {
  return { ...state, connection: "offline", message: "", pending: [] };
}

/** Propose a change. Refused while the device is not online. Returns the new state and the change (or null). */
export function propose(state: DeviceState, key: string, value: number): { state: DeviceState; change: PendingChange | null } {
  if (state.connection !== "online" || !Number.isFinite(value)) {
    return { state: { ...state, message: state.connection === "online" ? "value must be a finite number" : "the device is not online" }, change: null };
  }
  const change: PendingChange = { id: state.nextChangeId, key, value };
  return { state: { ...state, pending: [...state.pending, change], nextChangeId: state.nextChangeId + 1, message: "" }, change };
}

/** The device confirmed the change: it becomes part of the confirmed configuration. */
export function confirm(state: DeviceState, id: number): DeviceState {
  const change = state.pending.find((c) => c.id === id);
  if (!change) return state;
  return {
    ...state,
    confirmed: { ...state.confirmed, [change.key]: change.value },
    pending: state.pending.filter((c) => c.id !== id),
  };
}

/** The device refused the change: it is dropped and the confirmed value stays as it was. */
export function refuse(state: DeviceState, id: number, reason: string): DeviceState {
  if (!state.pending.some((c) => c.id === id)) return state;
  return { ...state, pending: state.pending.filter((c) => c.id !== id), message: reason };
}

/** What to show for a key: the confirmed value, and whether a newer one is still waiting. */
export function displayValue(state: DeviceState, key: string): { value: number | undefined; awaiting: boolean } {
  return { value: state.confirmed[key], awaiting: state.pending.some((c) => c.key === key) };
}

/** A short label for the connection, for a status badge. */
export function describe(state: DeviceState): string {
  switch (state.connection) {
    case "offline":
      return "Offline";
    case "connecting":
      return "Connecting…";
    case "online":
      return state.pending.length ? `Online, ${state.pending.length} change(s) awaiting the device` : "Online";
    case "error":
      return `Error: ${state.message || "unknown"}`;
  }
}
