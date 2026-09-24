import { describe, expect, it } from "vitest";
import {
  confirm,
  connected,
  connecting,
  describe as label,
  disconnected,
  displayValue,
  failed,
  initialState,
  propose,
  refuse,
} from "./deviceState";

const online = () => connected(connecting(initialState()));

describe("device state", () => {
  it("starts offline and moves through connecting to online", () => {
    expect(initialState().connection).toBe("offline");
    expect(connecting(initialState()).connection).toBe("connecting");
    expect(online().connection).toBe("online");
  });

  it("refuses a change while the device is not online", () => {
    for (const state of [initialState(), connecting(initialState()), failed(initialState(), "port busy")]) {
      const result = propose(state, "current", 1.5);
      expect(result.change).toBeNull();
      expect(result.state.pending).toEqual([]);
    }
  });

  it("refuses a value that is not a finite number", () => {
    expect(propose(online(), "current", Number.NaN).change).toBeNull();
    expect(propose(online(), "current", Number.POSITIVE_INFINITY).change).toBeNull();
  });

  it("keeps a proposed change pending and never confirmed until the device confirms it", () => {
    const { state, change } = propose(online(), "current", 1.5);
    expect(change).not.toBeNull();
    expect(state.pending).toHaveLength(1);
    expect(state.confirmed).toEqual({});
    expect(displayValue(state, "current")).toEqual({ value: undefined, awaiting: true });
    const done = confirm(state, change!.id);
    expect(done.confirmed).toEqual({ current: 1.5 });
    expect(done.pending).toEqual([]);
    expect(displayValue(done, "current")).toEqual({ value: 1.5, awaiting: false });
  });

  it("rolls a refused change back and keeps the previous confirmed value and the reason", () => {
    let state = online();
    const first = propose(state, "current", 1.0);
    state = confirm(first.state, first.change!.id);
    const second = propose(state, "current", 9.9);
    const refused = refuse(second.state, second.change!.id, "out of range");
    expect(refused.confirmed).toEqual({ current: 1.0 });
    expect(refused.pending).toEqual([]);
    expect(refused.message).toBe("out of range");
  });

  it("drops every pending change when the link fails or is closed", () => {
    const proposed = propose(online(), "current", 2).state;
    expect(failed(proposed, "lost").pending).toEqual([]);
    expect(disconnected(proposed).pending).toEqual([]);
    expect(failed(proposed, "lost").connection).toBe("error");
  });

  it("ignores confirmations and refusals for a change that is not pending", () => {
    const state = online();
    expect(confirm(state, 99)).toBe(state);
    expect(refuse(state, 99, "x")).toBe(state);
  });

  it("gives each change its own id", () => {
    const a = propose(online(), "a", 1);
    const b = propose(a.state, "b", 2);
    expect(new Set([a.change!.id, b.change!.id]).size).toBe(2);
  });

  it("describes every connection state", () => {
    expect(label(initialState())).toBe("Offline");
    expect(label(connecting(initialState()))).toBe("Connecting…");
    expect(label(online())).toBe("Online");
    expect(label(propose(online(), "a", 1).state)).toContain("awaiting the device");
    expect(label(failed(initialState(), "port busy"))).toBe("Error: port busy");
  });
});
