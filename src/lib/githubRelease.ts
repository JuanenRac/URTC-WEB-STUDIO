import { isFlashableFirmwareName, FlashTarget } from './firmwareImage';

// The URTC firmware binaries are not in git: they are assets of the GitHub release of
// each version (see URTC docs/FIRMWARE_DISTRIBUTION.md). This lists the application
// images of the newest release for one board, with their <bin>.sha256 and
// <bin>.manifest.json sidecars, and downloads them.
//
// Browser reality (CORS):
//  - api.github.com answers cross-origin requests, so the release listing is a plain fetch.
//  - browser_download_url (github.com/.../releases/download/...) answers with a redirect to the
//    asset host and the github.com side does not allow cross-origin reads, so a browser cannot
//    rely on it.
//  - The asset endpoint of the API (assets[].url) with "Accept: application/octet-stream" is
//    answered by api.github.com with a redirect to a signed URL of the asset host; that is the
//    path a page can use. browser_download_url stays as the fallback when it fails.
// Both count against the unauthenticated limit of the API (60 requests per hour per address),
// which is reported as its own error instead of a generic failure.

export const RELEASE_REPO = 'JuanenRac/URTC';
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

export interface ReleaseAsset {
  name: string;
  size: number;
  /** assets[].url: the API endpoint of the asset, downloadable with Accept: application/octet-stream. */
  apiUrl: string;
  /** assets[].browser_download_url. */
  browserUrl: string;
  /** assets[].digest ("sha256:<hex>"), when GitHub provides it. */
  digest?: string;
}

/** An application image of the newest release and the sidecars published next to it. */
export interface RemoteFirmware {
  name: string;
  size: number;
  tag: string;
  asset: ReleaseAsset;
  sha256?: ReleaseAsset;
  manifest?: ReleaseAsset;
  /** The release signature of the image (<image>.sig), when the release has one. */
  signature?: ReleaseAsset;
}

export type GithubReleaseErrorCode = 'rate_limit' | 'no_release' | 'http' | 'network' | 'no_images';

export class GithubReleaseError extends Error {
  constructor(public code: GithubReleaseErrorCode, message: string) { super(message); }
}

type FetchFn = (input: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

function toAsset(raw: any): ReleaseAsset | null {
  if (!raw || typeof raw.name !== 'string' || typeof raw.url !== 'string' || typeof raw.browser_download_url !== 'string') return null;
  const asset: ReleaseAsset = { name: raw.name, size: Number(raw.size) || 0, apiUrl: raw.url, browserUrl: raw.browser_download_url };
  if (typeof raw.digest === 'string') asset.digest = raw.digest;
  return asset;
}

/** The images of this board in the assets of a release, in the order of the release, each with its sidecars. */
export function imagesFromRelease(release: any, target: FlashTarget): RemoteFirmware[] {
  const tag = typeof release?.tag_name === 'string' ? release.tag_name : '';
  const assets: ReleaseAsset[] = (Array.isArray(release?.assets) ? release.assets : []).map(toAsset).filter((a: ReleaseAsset | null): a is ReleaseAsset => a !== null);
  const byName = new Map(assets.map(a => [a.name, a]));
  return assets
    .filter(a => isFlashableFirmwareName(a.name, target))
    .map(a => ({
      name: a.name,
      size: a.size,
      tag,
      asset: a,
      sha256: byName.get(`${a.name}.sha256`),
      manifest: byName.get(`${a.name}.manifest.json`),
      signature: byName.get(`${a.name}.sig`),
    }));
}

async function getJson(fetchFn: FetchFn, url: string): Promise<any> {
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { Accept: 'application/vnd.github+json' } });
  } catch (e: any) {
    throw new GithubReleaseError('network', e?.message ?? 'network error');
  }
  if (res.status === 404) throw new GithubReleaseError('no_release', 'no release published');
  if (res.status === 403 || res.status === 429) {
    if (res.headers?.get('x-ratelimit-remaining') === '0' || res.status === 429) throw new GithubReleaseError('rate_limit', 'GitHub API rate limit reached');
  }
  if (!res.ok) throw new GithubReleaseError('http', `GitHub answered ${res.status}`);
  return res.json();
}

/** Both boards from one request: the list the Flasher offers. */
export async function listAllReleaseFirmware(fetchFn: FetchFn): Promise<RemoteFirmware[]> {
  const release = await getJson(fetchFn, LATEST_RELEASE_URL);
  const images = [...imagesFromRelease(release, 'main'), ...imagesFromRelease(release, 'slave')];
  if (images.length === 0) throw new GithubReleaseError('no_images', 'the newest release has no application image');
  return images;
}

/** Downloads one asset: through the API endpoint first, through browser_download_url if that fails. */
export async function downloadAsset(fetchFn: FetchFn, asset: ReleaseAsset): Promise<ArrayBuffer> {
  let apiFailure: unknown;
  try {
    const res = await fetchFn(asset.apiUrl, { headers: { Accept: 'application/octet-stream' } });
    if (res.ok) return await res.arrayBuffer();
    apiFailure = new GithubReleaseError(res.status === 429 || (res.status === 403 && res.headers?.get('x-ratelimit-remaining') === '0') ? 'rate_limit' : 'http', `GitHub answered ${res.status}`);
  } catch (e) {
    apiFailure = e;
  }
  try {
    const res = await fetchFn(asset.browserUrl);
    if (res.ok) return await res.arrayBuffer();
  } catch {
    // fall through to the first failure, which says more
  }
  if (apiFailure instanceof GithubReleaseError) throw apiFailure;
  throw new GithubReleaseError('network', (apiFailure as Error)?.message ?? 'network error');
}

export async function downloadAssetText(fetchFn: FetchFn, asset: ReleaseAsset): Promise<string> {
  return new TextDecoder().decode(await downloadAsset(fetchFn, asset));
}

/** The digest in a "<hex>  <file name>" sidecar, lower case; null when the text holds none. */
export function parseSha256Sidecar(text: string): string | null {
  const m = /^\s*(?:sha256:)?([0-9a-fA-F]{64})\b/.exec(text);
  return m ? m[1].toLowerCase() : null;
}

/** The digests a downloaded image must match, from the .sha256 sidecar and from the digest GitHub lists. A mismatch returns the digest that was expected. */
export function digestMismatch(actualHex: string, sidecarText: string | null, listedDigest?: string): string | null {
  const expected: string[] = [];
  const fromSidecar = sidecarText !== null ? parseSha256Sidecar(sidecarText) : null;
  if (fromSidecar) expected.push(fromSidecar);
  if (listedDigest && /^sha256:[0-9a-f]{64}$/i.test(listedDigest)) expected.push(listedDigest.slice(7).toLowerCase());
  for (const e of expected) if (e !== actualHex.toLowerCase()) return e;
  return null;
}
