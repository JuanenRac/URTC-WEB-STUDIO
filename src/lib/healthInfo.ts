// The identity frame of a head (0x1BB) read for both versions of the protocol, and the bit rate of the bus that a head declares in it: the same reading as
// urtc_common.health_info of URTC-COMMON (Python), held to the same cases (generated/bus_health_vectors.json, section "info").
//
// Protocol version 2 uses byte 5 of the frame to declare the bit rate the head runs at and keeps the uptime in the last two bytes (16 bits, stopping at 65535).
// Version 1 had a 24-bit uptime over bytes 5 to 7 and declared nothing. Byte 5 is read as a rate only when byte 0 says version 2 or more, so a head with older
// firmware is read as before and its rate is simply unknown.

export const CAN_ID_HEALTH_INFO = 0x1bb;
export const FIRST_DECLARING_VERSION = 2;

/** The bit rate in bit/s of each code a head sends (0 means not declared and has no rate). */
export const RATE_OF_CODE: Readonly<Record<number, number>> = { 1: 1_000_000, 2: 500_000, 3: 250_000, 4: 125_000 };

export interface HealthInfo {
  protocol_version: number;
  reset_cause: number;
  fw_minor: number;
  fw_patch: number;
  fw_build: number;
  uptime_s: number;
  /** null: the frame does not declare a rate (version 1); 0: version 2 and not declared; 1 to 4 a rate. */
  rate_code: number | null;
  rate_bps: number | null;
}

/** The fields of a 0x1BB payload, or null when it is not eight bytes long. The rate is read only from a frame of version 2 or more. */
export function parseHealthInfo(data: ArrayLike<number>): HealthInfo | null {
  if (data.length !== 8) return null;
  const version = data[0];
  const declares = version >= FIRST_DECLARING_VERSION;
  const rateCode = declares ? data[5] : null;
  const uptime = declares ? (data[6] << 8) | data[7] : (data[5] << 16) | (data[6] << 8) | data[7];
  return {
    protocol_version: version,
    reset_cause: data[1],
    fw_minor: data[2],
    fw_patch: data[3],
    fw_build: data[4],
    uptime_s: uptime,
    rate_code: rateCode,
    rate_bps: rateCode !== null ? RATE_OF_CODE[rateCode] ?? null : null,
  };
}

/** The bit rates (bit/s) that the 0x1BB frames declare, one per frame that declares a known one, in order; a frame that declares nothing is skipped. */
export function declaredRates(frames: ReadonlyArray<ArrayLike<number>>): number[] {
  const rates: number[] = [];
  for (const frame of frames) {
    const info = parseHealthInfo(frame);
    if (info !== null && info.rate_bps !== null) rates.push(info.rate_bps);
  }
  return rates;
}

/** The distinct declared rates, the highest first. */
export function distinctRates(frames: ReadonlyArray<ArrayLike<number>>): number[] {
  return [...new Set(declaredRates(frames))].sort((a, b) => b - a);
}

/** "1 Mbit/s", "500 kbit/s"... for a rate; an empty string for none. Numbers only: the page puts the words around it in its own language. */
export function rateText(rateBps: number | null | undefined): string {
  if (!rateBps) return '';
  return rateBps % 1_000_000 === 0 ? `${rateBps / 1_000_000} Mbit/s` : `${Math.floor(rateBps / 1000)} kbit/s`;
}
