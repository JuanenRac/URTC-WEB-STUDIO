import type { VersionBus } from './boardVersion';
import controlConfig from './controlConfig.json';

// How a main bootloader reads an image that declares no patch number: kept in the board and changed only by a signed command that is made outside this page
// (URTC-COMMON, docs/VERSION_COMPAT.md). The page only READS it, and only when "version_rule_query" of controlConfig.json is true (default false: nothing is
// sent). A frame on 0x7EE whose first byte is 0x60 asks; the answer on 0x7EF has 8 bytes: 0xC5, status, mode in force, flags (bit 0: stored), counter
// (big-endian). A bootloader without the feature (the default of the firmware) answers nothing, which is "no data", never a guess.

export const VERSION_RULE_ID = 0x7ee;
export const VERSION_RULE_ANSWER_ID = 0x7ef;
const QUERY_INDEX = 0x60;
const ANSWER_MARKER = 0xc5;
const ANSWER_BYTES = 8;
const LAST_STATUS = 8;

export type VersionRuleMode = 'strict' | 'accept_patchless';

export interface VersionRule {
  status: number;
  mode: VersionRuleMode;
  /** False: nothing is stored and the rule is the one the bootloader was built with. */
  stored: boolean;
  counter: number;
}

export function versionRuleQueryEnabled(config: { version_rule_query?: unknown } = controlConfig as { version_rule_query?: unknown }): boolean {
  return config?.version_rule_query === true;
}

export function parseVersionRule(data: number[]): VersionRule | null {
  if (data.length !== ANSWER_BYTES || data[0] !== ANSWER_MARKER || data[1] > LAST_STATUS || (data[2] !== 1 && data[2] !== 2) || (data[3] & ~0x01) !== 0) return null;
  const counter = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
  return { status: data[1], mode: data[2] === 2 ? 'accept_patchless' : 'strict', stored: data[3] === 1, counter };
}

/** Asks the bootloader without changing anything. Null when it does not answer or the answer is not of this kind. */
export async function queryVersionRule(bus: VersionBus): Promise<VersionRule | null> {
  const resp = await bus.request(VERSION_RULE_ID, [QUERY_INDEX, 0, 0, 0, 0, 0, 0, 0], VERSION_RULE_ANSWER_ID, 600, 'Query the version rule of the bootloader');
  return resp ? parseVersionRule(resp.data) : null;
}
