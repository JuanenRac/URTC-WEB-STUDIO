import { describe, expect, it } from "vitest";
import {
  PID_ACTION_AUTOTUNE_ABORT, PID_ACTION_AUTOTUNE_START, PID_ACTION_QUERY, PID_ACTION_SET_GAINS, PID_GAIN_MAX, PID_STATE_KEYS, decodePidState, encodePidConfig, pidGainX100,
} from "./pid";
import { CAN_ID_PID_CONFIG, CAN_ID_PID_STATE_RESP } from "./canIds";
import { rawSendPolicy } from "./dangerousActions";

const hex = (data: number[] | null) => (data ? data.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase() : null);

describe("the heater PID frames", () => {
  it("use the identifiers of the specification", () => {
    expect(CAN_ID_PID_CONFIG).toBe(0x1B9);
    expect(CAN_ID_PID_STATE_RESP).toBe(0x1BA);
  });

  it("store the gains times 100 and the action, like the examples of the specification", () => {
    expect(hex(encodePidConfig(PID_ACTION_SET_GAINS, { kp: "8", ki: "0.2", kd: "1.5" }))).toBe("03200014009600");
    expect(hex(encodePidConfig(PID_ACTION_SET_GAINS, { kp: 600, ki: 600, kd: 600 }))).toBe("EA60EA60EA6000");
    expect(hex(encodePidConfig(PID_ACTION_AUTOTUNE_START))).toBe("00000000000001");
    expect(hex(encodePidConfig(PID_ACTION_AUTOTUNE_ABORT, { kp: 9, ki: 9, kd: 9 }))).toBe("00000000000002"); // the gains are read only for a store
    expect(hex(encodePidConfig(PID_ACTION_QUERY))).toBe("00000000000003");
  });

  it("refuse a gain that is not a number from 0 to 600 instead of correcting it", () => {
    for (const bad of ["", "x", "-1", "600.01", "1e2", "0x10", "NaN", "Infinity", " ", "1,5"]) {
      expect(pidGainX100(bad), bad).toBeNull();
      expect(encodePidConfig(PID_ACTION_SET_GAINS, { kp: bad, ki: "1", kd: "1" }), bad).toBeNull();
    }
    expect(pidGainX100("0")).toBe(0);
    expect(pidGainX100(" 12.5 ")).toBe(1250);
    expect(pidGainX100(PID_GAIN_MAX)).toBe(60000);
    expect(encodePidConfig(PID_ACTION_SET_GAINS)).toBeNull();
    expect(encodePidConfig(7)).toBeNull();
  });

  it("decode the answer and do not guess at a wrong length", () => {
    expect(decodePidState([0x03, 0x20, 0x00, 0x14, 0x00, 0x96, 0x01, 0x25])).toEqual({ kp: 8, ki: 0.2, kd: 1.5, state: 1, dutyPercent: 37 });
    expect(decodePidState([1, 2, 3])).toBeNull();
    expect(decodePidState(new Array(9).fill(0))).toBeNull();
  });

  it("have a text for every state of the specification", () => {
    expect(Object.keys(PID_STATE_KEYS).map(Number).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("are not a frame to type by hand without a confirmation: the autotune heats", () => {
    expect(rawSendPolicy(0x1B9)).toEqual({ kind: "confirm", reason: "actuator" });
  });
});
