import type { CanFrame } from '../types';
import { checkSignature, SESSION_KIND, sessionPayload, signPayload, type SignatureBlock, type SignatureCheck } from './recordSigning';

// A saved session that can be shown to be unedited. The log is a text file; next to it goes a record that names it by its SHA-256 and its
// size, with the settings in use. It is the same record the desktop Tester writes (tester_result_record.session_manifest: log_file,
// log_sha256, log_bytes and the context as text, keys sorted), so a record from either program is checked the same way. Checking
// needs no key: whoever has the log and the record sees whether they belong together. No React here.

export const SESSION_LOG_EXTENSION = 'log';
export const SESSION_RECORD_EXTENSION = 'json';

export type SessionManifest = Record<string, string | number | SignatureBlock>;

/** The SHA-256 of a text as it is stored (UTF-8), 64 lowercase hexadecimal digits. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const frameLine = (f: Pick<CanFrame, 'timestamp' | 'direction' | 'idHex' | 'dlc' | 'dataHex'>) =>
  `${f.timestamp} ${f.direction} ${f.idHex} [${f.dlc}] ${f.dataHex}`.trimEnd();

/** The log of a session: one line per frame, oldest first, ending in a newline. */
export function sessionLogText(frames: Array<Pick<CanFrame, 'timestamp' | 'direction' | 'idHex' | 'dlc' | 'dataHex'>>): string {
  return frames.map(frameLine).join('\n') + '\n';
}

/** What the record says about a log: its name, SHA-256 and size, then the context (every value as text, keys sorted). */
export async function sessionManifest(logText: string, logFile: string, context: Record<string, unknown> = {}): Promise<SessionManifest> {
  const manifest: SessionManifest = {
    log_file: logFile,
    log_sha256: await sha256Hex(logText),
    log_bytes: new TextEncoder().encode(logText).length,
  };
  for (const key of Object.keys(context).sort()) manifest[key] = String(context[key]);
  return manifest;
}

/** JSON with the keys sorted, two spaces of indent and non-ASCII characters escaped: the bytes Python's json.dumps(indent=2, sort_keys=True) writes. */
export function manifestJson(manifest: SessionManifest): string {
  const escape = (text: string) => JSON.stringify(text).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const lines = Object.keys(manifest).sort().map((key) => {
    const value = manifest[key];
    if (typeof value === 'object') {
      const fields = value as unknown as Record<string, unknown>;
      const inner = Object.keys(fields).sort().map((name) => `    ${escape(name)}: ${escape(String(fields[name]))}`);
      return `  ${escape(key)}: {\n${inner.join(',\n')}\n  }`;
    }
    return `  ${escape(key)}: ${typeof value === 'number' ? String(value) : escape(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}`;
}

/** The manifest with a `signature` block made with the key of this browser; the manifest as it was where the browser cannot sign. */
export async function signedManifest(manifest: SessionManifest, jwk: JsonWebKey | null): Promise<SessionManifest> {
  const block = await signPayload(SESSION_KIND, sessionPayload({ log_file: manifest.log_file, log_sha256: manifest.log_sha256, log_bytes: manifest.log_bytes }), jwk);
  return block ? { ...manifest, signature: block } : manifest;
}

export type SessionCheck =
  | { ok: true; logFile: string; bytes: number; signature: SignatureCheck }
  | { ok: false; reason: 'record' | 'size' | 'hash'; logFile?: string };

/** Reads a record and compares it with a log: not a record, a log of another size, or a log whose SHA-256 differs. */
export async function checkSession(recordText: string, logText: string): Promise<SessionCheck> {
  let record: unknown;
  try {
    record = JSON.parse(recordText);
  } catch {
    return { ok: false, reason: 'record' };
  }
  if (typeof record !== 'object' || record === null) return { ok: false, reason: 'record' };
  const fields = record as Record<string, unknown>;
  const { log_file: logFile, log_sha256: sha, log_bytes: bytes } = fields;
  if (typeof logFile !== 'string' || typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha) || typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes < 0) {
    return { ok: false, reason: 'record' };
  }
  if (new TextEncoder().encode(logText).length !== bytes) return { ok: false, reason: 'size', logFile };
  if ((await sha256Hex(logText)) !== sha) return { ok: false, reason: 'hash', logFile };
  return { ok: true, logFile, bytes, signature: await checkSignature(fields.signature, SESSION_KIND, sessionPayload({ log_file: logFile, log_sha256: sha, log_bytes: bytes })) };
}

/** The names of the two files of a saved session, from a stamp such as 20000101_000000. */
export function sessionFileNames(stamp: string): { log: string; record: string } {
  return { log: `urtc_web_session_${stamp}.${SESSION_LOG_EXTENSION}`, record: `urtc_web_session_${stamp}.${SESSION_RECORD_EXTENSION}` };
}
