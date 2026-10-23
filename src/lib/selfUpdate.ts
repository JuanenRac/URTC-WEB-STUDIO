// "A newer version of this page is being served": the built page carries its own version, the host serves a small
// `version.json` next to it, and the page compares the two. Nothing is reloaded by itself (a reload in the middle of a
// flash or a bench session would be harmful): the person is told, and a click reloads.
//
// No React and no `fetch` of its own in the rules, so they are tested directly. The request goes to the same origin
// only (a relative URL), never to another host.

export const VERSION_FILE = 'version.json';
const VERSION = /^\d{1,4}(\.\d{1,4}){2,3}$/;

/** The four components of a version (a missing fourth is 0), or null if the text is not a version. */
export function versionParts(text: string): [number, number, number, number] | null {
  const cleaned = text.trim().replace(/^v/i, '');
  if (!VERSION.test(cleaned)) return null;
  const n = cleaned.split('.').map(Number);
  return [n[0], n[1], n[2], n[3] ?? 0];
}

/** True only when `served` is strictly higher than `built`: an equal or older served page is never a reason to reload. */
export function isNewerVersion(built: string, served: string): boolean {
  const a = versionParts(built);
  const b = versionParts(served);
  if (!a || !b) return false;
  for (let i = 0; i < 4; i++) {
    if (b[i] !== a[i]) return b[i] > a[i];
  }
  return false;
}

/** The version in the text of a `version.json` of this application, or null for anything else. */
export function servedVersion(text: string): string | null {
  try {
    const doc = JSON.parse(text) as { name?: unknown; version?: unknown };
    if (doc.name !== 'urtc-web-studio' || typeof doc.version !== 'string' || versionParts(doc.version) === null) return null;
    return doc.version;
  } catch {
    return null;
  }
}

export type ServedCheck = { state: 'newer'; served: string } | { state: 'current' } | { state: 'unknown' };

/** Asks the host for `version.json` (never from a cache) and compares. Any failure is `unknown`: the page goes on working. */
export async function checkServedVersion(
  built: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'text'>>,
  timeoutMs = 5000,
): Promise<ServedCheck> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(`${VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit', signal: controller?.signal });
    if (!response.ok) return { state: 'unknown' };
    const served = servedVersion(await response.text());
    if (served === null) return { state: 'unknown' };
    return isNewerVersion(built, served) ? { state: 'newer', served } : { state: 'current' };
  } catch {
    return { state: 'unknown' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
