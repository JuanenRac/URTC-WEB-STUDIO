// Bundles the URTC firmware (the application and bootloader .bin of both boards plus
// the <bin>.sha256 and <bin>.manifest.json sidecars, and the .hex/.elf when present)
// into public/firmware and regenerates src/lib/bundledFirmware.ts, so the files this
// app offers "locally" are exactly the ones URTC published - same names, same bytes,
// same signatures.
//
// The URTC binaries are not in git: they are the assets of the GitHub release of each
// version. Where the files come from:
//
//   node scripts/sync-firmware.mjs                    assets of the newest release of JuanenRac/URTC
//   node scripts/sync-firmware.mjs --tag v0.3.5       assets of that release
//   node scripts/sync-firmware.mjs path/to/folder     a local folder (a bench build: ../URTC/firmware
//                                                     after build_firmware.sh in release mode)
//
// A release is first downloaded to a temporary folder; either way every image is checked
// (sha256 against its manifest and its sidecar) before anything in public/firmware is touched.
// GITHUB_TOKEN, when set, is sent to the API to lift the anonymous rate limit.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const RELEASE_REPO = 'JuanenRac/URTC';

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

/** Checks the images of a folder and returns { files, copy(dst) }. Throws before anything is copied. */
export function checkFolder(src) {
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
    const stem = bin.replace(/\.bin$/, '');
    toCopy.push(bin, `${bin}.sha256`, `${bin}.manifest.json`);
    for (const optional of [`${stem}.hex`, `${stem}.elf`]) if (existsSync(join(src, optional))) toCopy.push(optional);
  }
  return {
    files,
    copy(dst) {
      rmSync(dst, { recursive: true, force: true });
      mkdirSync(dst, { recursive: true });
      for (const f of toCopy) copyFileSync(join(src, f), join(dst, f));
    },
  };
}

function apiHeaders(accept, env = process.env) {
  const headers = { Accept: accept, 'User-Agent': 'urtc-web-studio-sync' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return headers;
}

/** Downloads the assets of a release (newest, or the given tag) that the bundle needs into outDir. */
export async function downloadRelease({ fetchFn = fetch, tag, outDir, env = process.env }) {
  const url = `https://api.github.com/repos/${RELEASE_REPO}/releases/${tag ? `tags/${encodeURIComponent(tag)}` : 'latest'}`;
  const res = await fetchFn(url, { headers: apiHeaders('application/vnd.github+json', env) });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}`);
  const release = await res.json();
  const assets = new Map((release.assets ?? []).map((a) => [a.name, a]));
  const get = async (name) => {
    const asset = assets.get(name);
    if (!asset) throw new Error(`the release ${release.tag_name} has no asset ${name}`);
    const r = await fetchFn(asset.url, { headers: apiHeaders('application/octet-stream', env) });
    if (!r.ok) throw new Error(`GitHub answered ${r.status} for the asset ${name}`);
    writeFileSync(join(outDir, name), Buffer.from(await r.arrayBuffer()));
  };
  await get('firmware_manifest.json');
  const files = pickFiles(JSON.parse(readFileSync(join(outDir, 'firmware_manifest.json'), 'utf8')));
  for (const bin of Object.values(files)) {
    const stem = bin.replace(/\.bin$/, '');
    for (const name of [bin, `${bin}.sha256`, `${bin}.manifest.json`]) await get(name);
    for (const optional of [`${stem}.hex`, `${stem}.elf`]) if (assets.has(optional)) await get(optional);
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
  const out = { dir: undefined, tag: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tag') {
      out.tag = argv[++i];
      if (!out.tag) throw new Error('--tag needs a value, for example v0.3.5');
    } else if (argv[i].startsWith('--tag=')) out.tag = argv[i].slice(6);
    else if (argv[i].startsWith('--')) throw new Error(`unknown option ${argv[i]}`);
    else out.dir = argv[i];
  }
  if (out.dir && out.tag) throw new Error('give a local folder or a release tag, not both');
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
    const tag = await downloadRelease({ tag: args.tag, outDir: temp });
    src = temp;
    origin = `release ${tag} of ${RELEASE_REPO}`;
  }
  try {
    const checked = checkFolder(src);
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
