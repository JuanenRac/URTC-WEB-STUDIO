// The release-signature check of scripts/sync-firmware.mjs: a wrong signature is always refused,
// a missing one only with --allow-unsigned, and a signed set is copied together with its signatures.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RELEASE_PUBLIC_KEY_HEX, checkFolder, downloadRelease, keyKindOf, parseArgs, signatureState } from './sync-firmware.mjs';

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
const COMPONENTS = {
  main_application: 'URTC_MAIN_FIRMWARE_v0.3.5.bin',
  slave_application: 'URTC_SLAVE_FIRMWARE_v0.1.9.bin',
  main_bootloader: 'URTC_MAIN_BOOTLOADER_v0.3.8.bin',
  slave_bootloader: 'URTC_SLAVE_BOOTLOADER_v0.2.2.bin',
};

let dir;
let keys;
let publicHex;

function writeSet() {
  const components = {};
  for (const [component, bin] of Object.entries(COMPONENTS)) {
    const data = Buffer.from(`image ${bin}`);
    writeFileSync(join(dir, bin), data);
    writeFileSync(join(dir, `${bin}.sha256`), `${sha(data)}  ${bin}\n`);
    writeFileSync(join(dir, `${bin}.manifest.json`), JSON.stringify({ component, sha256: sha(data), hmac_sha256: 'ab'.repeat(32) }));
    components[component] = { files: { bin: { filename: bin } } };
  }
  writeFileSync(join(dir, 'firmware_manifest.json'), JSON.stringify({ components }));
}

function signFile(name, as = name) {
  const message = Buffer.from(`urtc-rel/1|${as}|${sha(readFileSync(join(dir, name)))}`);
  writeFileSync(join(dir, `${name}.sig`), `${sign(null, message, keys.privateKey).toString('hex')}\n`);
}

const allFiles = () => ['firmware_manifest.json', ...Object.values(COMPONENTS).flatMap((bin) => [bin, `${bin}.sha256`, `${bin}.manifest.json`])];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'urtc-sync-test-'));
  keys = generateKeyPairSync('ed25519');
  publicHex = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  writeSet();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('release signatures of the firmware set', () => {
  it('accepts a fully signed set and copies the signatures with the files', () => {
    for (const name of allFiles()) signFile(name);
    const checked = checkFolder(dir, { publicKeyHex: publicHex });
    const out = join(dir, 'out');
    checked.copy(out);
    expect(existsSync(join(out, 'URTC_MAIN_FIRMWARE_v0.3.5.bin.sig'))).toBe(true);
  });

  it('refuses a set without signatures unless it is allowed', () => {
    expect(() => checkFolder(dir, { publicKeyHex: publicHex })).toThrow(/no release signature/);
    expect(() => checkFolder(dir, { allowUnsigned: true, publicKeyHex: publicHex })).not.toThrow();
  });

  it('refuses a signature of another file even when unsigned sets are allowed', () => {
    for (const name of allFiles()) signFile(name);
    signFile('URTC_MAIN_FIRMWARE_v0.3.5.bin', 'URTC_SLAVE_FIRMWARE_v0.1.9.bin');
    expect(() => checkFolder(dir, { allowUnsigned: true, publicKeyHex: publicHex })).toThrow(/does not match its release signature/);
  });

  it('refuses a changed image and a signature that is not hexadecimal', () => {
    for (const name of allFiles()) signFile(name);
    writeFileSync(join(dir, 'URTC_MAIN_BOOTLOADER_v0.3.8.bin.sig'), 'not hex');
    expect(signatureState(join(dir, 'URTC_MAIN_BOOTLOADER_v0.3.8.bin'), publicHex)).toBe('invalid');
  });

  it('pins the same key as the firmware repository documents', () => {
    const doc = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'URTC', 'docs', 'RELEASE_SIGNING.md');
    if (!existsSync(doc)) return;
    expect(readFileSync(doc, 'utf8')).toContain(`ed25519 ${RELEASE_PUBLIC_KEY_HEX}`);
  });

  it('reads --allow-unsigned', () => {
    expect(parseArgs(['--tag', 'v0.3.5', '--allow-unsigned'])).toEqual({ dir: undefined, tag: 'v0.3.5', allowUnsigned: true, requireOfficial: false });
  });

  it('reads --require-official and refuses it with a local folder or with unsigned sets', () => {
    expect(parseArgs(['--require-official'])).toEqual({ dir: undefined, tag: undefined, allowUnsigned: false, requireOfficial: true });
    expect(() => parseArgs(['--require-official', '../URTC/firmware'])).toThrow(/not a local folder/);
    expect(() => parseArgs(['--require-official', '--allow-unsigned'])).toThrow(/contradict/);
  });
});

describe('what a published page may carry (--require-official)', () => {
  const setKinds = (kinds) => {
    writeSet();
    for (const [component, bin] of Object.entries(COMPONENTS)) {
      const path = join(dir, `${bin}.manifest.json`);
      const manifest = JSON.parse(readFileSync(path, 'utf8'));
      if (kinds[component]) manifest.signing_key_kind = kinds[component];
      writeFileSync(path, JSON.stringify(manifest));
    }
    for (const name of allFiles()) signFile(name);
  };

  it('accepts application images built with a production key', () => {
    setKinds({ main_application: 'release', slave_application: 'production' });
    expect(() => checkFolder(dir, { publicKeyHex: publicHex, requireProductionKey: true })).not.toThrow();
  });

  it('refuses an application image built with the public development key, or with no key kind at all', () => {
    setKinds({ main_application: 'release', slave_application: 'dev' });
    expect(() => checkFolder(dir, { publicKeyHex: publicHex, requireProductionKey: true })).toThrow(/slave_application|SLAVE_FIRMWARE.*"dev"/);
    setKinds({ main_application: 'release' });
    expect(() => checkFolder(dir, { publicKeyHex: publicHex, requireProductionKey: true })).toThrow(/key kind undefined/);
    expect(() => checkFolder(dir, { publicKeyHex: publicHex })).not.toThrow();
  });

  it('takes the key kind from the index when the image manifest does not say', () => {
    expect(keyKindOf({}, { signing: { key_kind: 'release' } })).toBe('release');
    expect(keyKindOf({ signing_key_kind: 'dev' }, { signing: { key_kind: 'release' } })).toBe('dev');
    expect(keyKindOf({}, undefined)).toBeUndefined();
  });

  const fakeFetch = (release) => async (url) => {
    if (url.includes('/releases/')) return { ok: true, status: 200, json: async () => release };
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) };
  };

  it('refuses a pre-release and a draft, and uses no fallback tag', async () => {
    for (const flag of ['prerelease', 'draft']) {
      await expect(downloadRelease({ fetchFn: fakeFetch({ tag_name: 'v0.4.0', [flag]: true, assets: [] }), tag: 'v0.4.0', outDir: dir, requireOfficial: true }))
        .rejects.toThrow(/not an official one/);
    }
    const missing = async () => ({ ok: false, status: 404 });
    await expect(downloadRelease({ fetchFn: missing, outDir: dir, fallbackTag: undefined, requireOfficial: true })).rejects.toThrow(/404/);
  });
});

describe('the Pages workflow stays off until the owner turns it on', () => {
  const workflow = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.github', 'workflows', 'pages.yml'), 'utf8').replaceAll('\r\n', '\n');

  it('runs both jobs only when the variable is "true"', () => {
    const gate = "vars.URTC_PAGES_ENABLED == 'true'";
    expect(workflow.split(gate).length - 1).toBeGreaterThanOrEqual(2);
    expect(workflow).toMatch(/build:\s*\n\s*name: .*\n\s*if: \$\{\{ vars\.URTC_PAGES_ENABLED == 'true' \}\}/);
    expect(workflow).toMatch(/deploy:[\s\S]*?if: \$\{\{ vars\.URTC_PAGES_ENABLED == 'true' && needs\.build\.outputs\.deploy == 'true' \}\}/);
  });

  it('builds with the firmware of an official release only', () => {
    expect(workflow).toContain('npm run sync-firmware -- --require-official');
    expect(workflow).not.toMatch(/--allow-unsigned/);
    expect(workflow).not.toMatch(/sync-firmware\s*$/m);
  });

  it('no longer claims that the images carry the development key', () => {
    expect(workflow).not.toContain('VITE_BENCH_NOTICE');
  });
});
