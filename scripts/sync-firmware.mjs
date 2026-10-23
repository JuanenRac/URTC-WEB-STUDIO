// Bundles the URTC firmware (the application and bootloader .bin of both boards plus
// the <bin>.sha256 and <bin>.manifest.json sidecars, and the .hex/.elf when present)
// into public/firmware and regenerates src/lib/bundledFirmware.ts, so the files this
// app offers "locally" are exactly the ones URTC published - same names, same bytes,
// same signatures.
//
// The URTC binaries are not in git: they are the assets of the GitHub release of each
// version. Where the files come from:
//
//   node scripts/sync-firmware.mjs                    assets of the newest official release of JuanenRac/URTC; while there
//                                                     is none (GitHub's "latest" answers 404 for a pre-release), the release
//                                                     named in firmware-release.json
//   node scripts/sync-firmware.mjs --tag v0.3.5       assets of that release
//   node scripts/sync-firmware.mjs path/to/folder     a local folder (a bench build: ../URTC/firmware
//                                                     after build_firmware.sh in release mode)
//   --allow-unsigned                                  accept a set that has no release signatures (.sig):
//                                                     a bench pre-release or a local build
//   --require-official                                only an official release of the repository (not a pre-release,
//                                                     no fallback tag, no local folder), every file signed, and every
//                                                     application image built with a production key: what a published
//                                                     page may carry
//
// A release is first downloaded to a temporary folder; either way every image is checked
// (sha256 against its manifest and its sidecar) before anything in public/firmware is touched.
// Each file of an official release has a release signature (<file>.sig, Ed25519 by the key of
// the releases, over `urtc-rel/1|<file name>|<sha256>`): a wrong one is always refused, a missing
// one unless --allow-unsigned.
// GITHUB_TOKEN, when set, is sent to the API to lift the anonymous rate limit.
import { createHash, createPublicKey, verify } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RELEASE_REPO = 'JuanenRac/URTC';
/** The public key of the releases (Ed25519, 32 bytes in hexadecimal); the same one is published in docs/RELEASE_SIGNING.md of URTC. */
export const RELEASE_PUBLIC_KEY_HEX = '4020c46d76c8ebacb64c5c7b9f3e7c62475afeb133d7421591988174e0f5dc90';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

const COMPONENTS = {
  mainApplication: 'main_application',
  slaveApplication: 'slave_application',
  mainBootloader: 'main_bootloader',
  slaveBootloader: 'slave_bootloader',
};

/** The file name of each component's .bin, from firmware_manifest.json. */
export function pickFiles(index) {
  const files = {};
  for (const [key, component] of Object.entries(COMPONENTS)) {
    const file = index.components?.[component]?.files?.bin?.filename;
    if (!file) throw new Error(`firmware_manifest.json has no components.${component}.files.bin.filename`);
    files[key] = file;
  }
  return files;
}

const sha256Of = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** 'signed', 'unsigned' (no <file>.sig) or 'invalid' for the release signature of a file. */
export function signatureState(path, publicKeyHex = RELEASE_PUBLIC_KEY_HEX) {
  const sigPath = `${path}.sig`;
  if (!existsSync(sigPath)) return 'unsigned';
  const text = readFileSync(sigPath, 'ascii').trim();
  if (!/^[0-9a-f]{128}$/i.test(text)) return 'invalid';
  const name = path.split(/[\\/]/).pop();
  const message = Buffer.from(`urtc-rel/1|${name}|${sha256Of(path)}`, 'utf8');
  const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
  return verify(null, message, key, Buffer.from(text, 'hex')) ? 'signed' : 'invalid';
}

/** Checks the images of a folder and returns { files, copy(dst) }. Throws before anything is copied. */
export const PRODUCTION_KEY_KINDS = ['release', 'production'];

/** The kind of key an application image was signed with, from its own manifest or from the index; undefined when neither says. */
export function keyKindOf(manifest, indexComponent) {
  return manifest.signing_key_kind ?? indexComponent?.signing?.key_kind;
}

export function checkFolder(src, { allowUnsigned = false, publicKeyHex = RELEASE_PUBLIC_KEY_HEX, requireProductionKey = false } = {}) {
  const index = JSON.parse(readFileSync(join(src, 'firmware_manifest.json'), 'utf8'));
  const files = pickFiles(index);
  const toCopy = ['firmware_manifest.json'];
  for (const bin of Object.values(files)) {
    const manifest = JSON.parse(readFileSync(join(src, `${bin}.manifest.json`), 'utf8'));
    const actual = sha256Of(join(src, bin));
    if (actual !== manifest.sha256) throw new Error(`${bin}: sha256 ${actual} does not match its manifest ${manifest.sha256}`);
    const sidecar = readFileSync(join(src, `${bin}.sha256`), 'utf8').trim().split(/\s+/)[0].toLowerCase();
    if (sidecar !== actual) throw new Error(`${bin}: sha256 ${actual} does not match its .sha256 file ${sidecar}`);
    if (/application/i.test(manifest.component ?? '') && !/^[0-9a-f]{64}$/i.test(manifest.hmac_sha256 ?? '')) {
      throw new Error(`${bin}: an application image needs hmac_sha256 in its manifest`);
    }
    if (requireProductionKey && /application/i.test(manifest.component ?? '')) {
      const kind = keyKindOf(manifest, index.components?.[manifest.component]);
      if (!PRODUCTION_KEY_KINDS.includes(kind)) throw new Error(`${bin}: signed with key kind ${JSON.stringify(kind)}, not a production key`);
    }
    const stem = bin.replace(/\.bin$/, '');
    toCopy.push(bin, `${bin}.sha256`, `${bin}.manifest.json`);
    for (const optional of [`${stem}.hex`, `${stem}.elf`]) if (existsSync(join(src, optional))) toCopy.push(optional);
  }
  const signatures = [];
  for (const f of toCopy) {
    const state = signatureState(join(src, f), publicKeyHex);
    if (state === 'invalid') throw new Error(`${f} does not match its release signature`);
    if (state === 'unsigned' && !allowUnsigned && !/\.(hex|elf)$/.test(f)) {
      throw new Error(`${f} has no release signature (use --allow-unsigned for a set that has none)`);
    }
    if (state === 'signed') signatures.push(`${f}.sig`);
  }
  return {
    files,
    copy(dst) {
      rmSync(dst, { recursive: true, force: true });
      mkdirSync(dst, { recursive: true });
      for (const f of [...toCopy, ...signatures]) copyFileSync(join(src, f), join(dst, f));
    },
  };
}

function apiHeaders(accept, env = process.env) {
  const headers = { Accept: accept, 'User-Agent': 'urtc-web-studio-sync' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

/** The `fallback_tag` of firmware-release.json, or undefined when the file is missing, unreadable or names something that is not a tag. */
export function pinnedTag(root) {
  try {
    const tag = JSON.parse(readFileSync(join(root, 'firmware-release.json'), 'utf8')).fallback_tag;
    return typeof tag === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(tag) ? tag : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Downloads the assets of a release (newest, or the given tag) that the bundle needs into outDir.
 * When the newest release was asked for and GitHub has none (404), the release named by `fallbackTag` is used
 * instead; a tag that was asked for is never replaced.
 */
export async function downloadRelease({ fetchFn = fetch, tag, outDir, env = process.env, fallbackTag, requireOfficial = false }) {
  const releaseUrl = (name) => `https://api.github.com/repos/${RELEASE_REPO}/releases/${name ? `tags/${encodeURIComponent(name)}` : 'latest'}`;
  let url = releaseUrl(tag);
  let res = await fetchFn(url, { headers: apiHeaders('application/vnd.github+json', env) });
  if (res.status === 404 && !tag && fallbackTag) {
    console.log(`sync-firmware: no official release yet, using ${fallbackTag} named in firmware-release.json`);
    url = releaseUrl(fallbackTag);
    res = await fetchFn(url, { headers: apiHeaders('application/vnd.github+json', env) });
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
  const release = await res.json();
  if (requireOfficial && (release.prerelease || release.draft)) {
    throw new Error(`the release ${release.tag_name} is a ${release.draft ? 'draft' : 'pre-release'}, not an official one`);
  }
  const assets = new Map((release.assets ?? []).map((a) => [a.name, a]));
  const get = async (name) => {
    const asset = assets.get(name);
    if (!asset) throw new Error(`the release ${release.tag_name} has no asset ${name}`);
    const r = await fetchFn(asset.url, { headers: apiHeaders('application/octet-stream', env) });
    if (!r.ok) throw new Error(`GitHub answered ${r.status} for the asset ${name}`);
    writeFileSync(join(outDir, name), Buffer.from(await r.arrayBuffer()));
  };
  const getSignature = async (name) => { if (assets.has(`${name}.sig`)) await get(`${name}.sig`); };
  await get('firmware_manifest.json');
  await getSignature('firmware_manifest.json');
  const files = pickFiles(JSON.parse(readFileSync(join(outDir, 'firmware_manifest.json'), 'utf8')));
  for (const bin of Object.values(files)) {
    const stem = bin.replace(/\.bin$/, '');
    for (const name of [bin, `${bin}.sha256`, `${bin}.manifest.json`]) { await get(name); await getSignature(name); }
    for (const optional of [`${stem}.hex`, `${stem}.elf`]) if (assets.has(optional)) { await get(optional); await getSignature(optional); }
  }
  return release.tag_name;
}

export function writeBundledModule(root, files) {
  writeFileSync(join(root, 'src', 'lib', 'bundledFirmware.ts'), `// GENERATED by scripts/sync-firmware.mjs from the URTC release assets (or a local build folder) - do not edit by hand.
// The binaries in public/firmware/ are byte-identical to what URTC published
// and each ships its <bin>.sha256 and <bin>.manifest.json (with hmac_sha256).
export const BUNDLED_FIRMWARE = ${JSON.stringify(files, null, 2)} as const;
`);
}

export function parseArgs(argv) {
  const out = { dir: undefined, tag: undefined, allowUnsigned: false, requireOfficial: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--allow-unsigned') out.allowUnsigned = true;
    else if (argv[i] === '--require-official') out.requireOfficial = true;
    else if (argv[i] === '--tag') {
      out.tag = argv[++i];
      if (!out.tag) throw new Error('--tag needs a value, for example v0.3.5');
    } else if (argv[i].startsWith('--tag=')) out.tag = argv[i].slice(6);
    else if (argv[i].startsWith('--')) throw new Error(`unknown option ${argv[i]}`);
    else out.dir = argv[i];
  }
  if (out.dir && out.tag) throw new Error('give a local folder or a release tag, not both');
  if (out.requireOfficial && out.dir) throw new Error('--require-official reads a release of GitHub, not a local folder');
  if (out.requireOfficial && out.allowUnsigned) throw new Error('--require-official and --allow-unsigned contradict each other');
  return out;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dst = join(root, 'public', 'firmware');
  const args = parseArgs(process.argv.slice(2));
  let src;
  let temp;
  let origin;
  if (args.dir) {
    src = resolve(args.dir);
    origin = src;
  } else {
    temp = mkdtempSync(join(tmpdir(), 'urtc-release-'));
    const tag = await downloadRelease({ tag: args.tag, outDir: temp, fallbackTag: args.requireOfficial ? undefined : pinnedTag(root), requireOfficial: args.requireOfficial });
    src = temp;
    origin = `release ${tag} of ${RELEASE_REPO}`;
  }
  try {
    const checked = checkFolder(src, { allowUnsigned: args.allowUnsigned, requireProductionKey: args.requireOfficial });
    checked.copy(dst);
    writeBundledModule(root, checked.files);
    console.log(`synced ${Object.keys(checked.files).length} images from ${origin}:`, checked.files);
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`sync-firmware: ${e.message}`); process.exit(1); });
}
