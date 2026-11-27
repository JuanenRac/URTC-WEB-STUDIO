// The files published next to an image (<image>.sha256, <image>.manifest.json). A file that is there but cannot be read is not the same as no
// file: what it said about the image is unknown, so the image is not flashed. The same rule as the desktop flasher.
import { parseManifest } from './flasher';
import { parseSha256Sidecar } from './githubRelease';

/** A published file is there but cannot be read. `suffix` says which one. */
export class UnreadablePublishedFile extends Error {
  constructor(public readonly suffix: '.sha256' | '.manifest.json') {
    super(`unreadable ${suffix}`);
    this.name = 'UnreadablePublishedFile';
  }
}

/** The manifest in `text`. A manifest with no `sha256` is readable; one that is not a JSON object, or whose `sha256` is not a digest, is not. */
export function readPublishedManifest(text: string) {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new UnreadablePublishedFile('.manifest.json');
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new UnreadablePublishedFile('.manifest.json');
  if ('sha256' in json && !(typeof json.sha256 === 'string' && /^(0x)?[0-9a-f]{64}$/i.test(json.sha256.trim()))) {
    throw new UnreadablePublishedFile('.manifest.json');
  }
  return parseManifest(json);
}

/** Refuses a `.sha256` that was published and holds no digest. `null` means that none was published. */
export function requireReadableSidecar(text: string | null): string | null {
  if (text !== null && parseSha256Sidecar(text) === null) throw new UnreadablePublishedFile('.sha256');
  return text;
}
