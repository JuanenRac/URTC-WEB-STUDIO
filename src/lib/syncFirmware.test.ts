import { afterEach, describe, expect, it } from "vitest";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BUNDLED_FIRMWARE } from "./bundledFirmware";

// The sync script is plain Node: loaded at run time so the type checker does not need declarations for it.
const sync = await import(pathToFileURL(join(__dirname, "..", "..", "scripts", "sync-firmware.mjs")).href);

const bundled = join(__dirname, "..", "..", "public", "firmware");
const temps: string[] = [];
const temp = () => { const d = mkdtempSync(join(tmpdir(), "urtc-sync-test-")); temps.push(d); return d; };
afterEach(() => { while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true }); });

// A fake of the GitHub API that serves the bundled files as the assets of a release.
function fakeRelease(folder: string, tag = "v9.9.9", dropAsset?: string) {
  const names = readdirSync(folder).filter(n => n !== dropAsset);
  const urls: string[] = [];
  const fn = async (url: string) => {
    urls.push(url);
    if (/\/releases\/(latest|tags\/[^/]+)$/.test(url)) {
      const body = { tag_name: tag, assets: names.map(name => ({ name, url: `https://api.github.com/repos/JuanenRac/URTC/releases/assets/${encodeURIComponent(name)}` })) };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }
    const name = decodeURIComponent(url.split("/assets/")[1]);
    const bytes = readFileSync(join(folder, name));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as unknown as Response;
  };
  return { fn, urls };
}

describe("sync-firmware from a local folder", () => {
  it("accepts the bundled folder and copies exactly its files", () => {
    const checked = sync.checkFolder(bundled, { allowUnsigned: true });
    expect(checked.files).toEqual(BUNDLED_FIRMWARE);
    const dst = temp();
    checked.copy(join(dst, "out"));
    expect(readdirSync(join(dst, "out")).sort()).toEqual(readdirSync(bundled).sort());
  });

  it("refuses an image that does not match its manifest or its .sha256, before copying anything", () => {
    const src = temp();
    cpSync(bundled, src, { recursive: true });
    const app = BUNDLED_FIRMWARE.mainApplication;
    const bytes = readFileSync(join(src, app));
    bytes[100] ^= 0xff;
    writeFileSync(join(src, app), bytes);
    expect(() => sync.checkFolder(src)).toThrow(/does not match its manifest/);

    const src2 = temp();
    cpSync(bundled, src2, { recursive: true });
    writeFileSync(join(src2, `${app}.sha256`), `${"0".repeat(64)}  ${app}\n`);
    expect(() => sync.checkFolder(src2)).toThrow(/does not match its \.sha256/);
  });

  it("refuses an application manifest without its signature", () => {
    const src = temp();
    cpSync(bundled, src, { recursive: true });
    const file = join(src, `${BUNDLED_FIRMWARE.slaveApplication}.manifest.json`);
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    delete manifest.hmac_sha256;
    writeFileSync(file, JSON.stringify(manifest));
    expect(() => sync.checkFolder(src)).toThrow(/hmac_sha256/);
  });

  it("works without the optional .hex and .elf files, as a release without them has", () => {
    const src = temp();
    cpSync(bundled, src, { recursive: true });
    for (const n of readdirSync(src)) if (/\.(hex|elf)$/.test(n)) rmSync(join(src, n));
    const dst = temp();
    sync.checkFolder(src, { allowUnsigned: true }).copy(join(dst, "out"));
    expect(readdirSync(join(dst, "out")).some(n => /\.(hex|elf)$/.test(n))).toBe(false);
    expect(existsSync(join(dst, "out", BUNDLED_FIRMWARE.mainApplication))).toBe(true);
  });
});

describe("sync-firmware from the release assets", () => {
  it("downloads the newest release through the API, then passes the same checks", async () => {
    const { fn, urls } = fakeRelease(bundled);
    const out = temp();
    const tag = await sync.downloadRelease({ fetchFn: fn, outDir: out, env: {} });
    expect(tag).toBe("v9.9.9");
    expect(urls[0]).toBe("https://api.github.com/repos/JuanenRac/URTC/releases/latest");
    expect(sync.checkFolder(out, { allowUnsigned: true }).files).toEqual(BUNDLED_FIRMWARE);
    expect(readFileSync(join(out, BUNDLED_FIRMWARE.mainApplication))).toEqual(readFileSync(join(bundled, BUNDLED_FIRMWARE.mainApplication)));
  });

  it("downloads the release of a given tag", async () => {
    const { fn, urls } = fakeRelease(bundled, "v0.3.5");
    await sync.downloadRelease({ fetchFn: fn, tag: "v0.3.5", outDir: temp(), env: {} });
    expect(urls[0]).toBe("https://api.github.com/repos/JuanenRac/URTC/releases/tags/v0.3.5");
  });

  it("names the asset a release is missing", async () => {
    const { fn } = fakeRelease(bundled, "v9.9.9", `${BUNDLED_FIRMWARE.slaveApplication}.manifest.json`);
    await expect(sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: {} })).rejects.toThrow(/has no asset .*SLAVE_FIRMWARE.*manifest\.json/);
  });

  it("sends GITHUB_TOKEN only when it is set", async () => {
    const seen: Array<Record<string, string>> = [];
    const inner = fakeRelease(bundled).fn;
    const fn = async (url: string, init?: { headers?: Record<string, string> }) => { seen.push(init?.headers ?? {}); return inner(url); };
    await sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: {} });
    expect(seen.every(h => h.Authorization === undefined)).toBe(true);
    seen.length = 0;
    await sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: { GITHUB_TOKEN: "t" } });
    expect(seen.every(h => h.Authorization === "Bearer t")).toBe(true);
  });
});

describe("sync-firmware arguments", () => {
  it("takes a folder, a tag, or nothing (the newest release)", () => {
    expect(sync.parseArgs([])).toEqual({ dir: undefined, tag: undefined, allowUnsigned: false });
    expect(sync.parseArgs(["../URTC/firmware"])).toEqual({ dir: "../URTC/firmware", tag: undefined, allowUnsigned: false });
    expect(sync.parseArgs(["--tag", "v0.3.5"])).toEqual({ dir: undefined, tag: "v0.3.5", allowUnsigned: false });
    expect(sync.parseArgs(["--tag=v0.3.5"]).tag).toBe("v0.3.5");
  });
  it("refuses a folder together with a tag, an empty tag and unknown options", () => {
    expect(() => sync.parseArgs(["dir", "--tag", "v1"])).toThrow(/not both/);
    expect(() => sync.parseArgs(["--tag"])).toThrow(/needs a value/);
    expect(() => sync.parseArgs(["--nope"])).toThrow(/unknown option/);
  });
});

describe("sync-firmware while the project has no official release", () => {
  // GitHub's "latest" ignores pre-releases: it answers 404 until an official release exists.
  function noLatest(folder: string, tag: string) {
    const real = fakeRelease(folder, tag);
    const urls: string[] = [];
    const fn = async (url: string) => {
      urls.push(url);
      if (url.endsWith("/releases/latest")) return { ok: false, status: 404 } as unknown as Response;
      return real.fn(url);
    };
    return { fn, urls };
  }

  it("reads the pinned tag of firmware-release.json", () => {
    const root = temp();
    expect(sync.pinnedTag(root)).toBeUndefined();
    writeFileSync(join(root, "firmware-release.json"), JSON.stringify({ fallback_tag: "v0.3.8" }));
    expect(sync.pinnedTag(root)).toBe("v0.3.8");
    for (const bad of ['{"fallback_tag": "../x"}', '{"fallback_tag": 8}', "[1]", "not json", "{}"]) {
      writeFileSync(join(root, "firmware-release.json"), bad);
      expect(sync.pinnedTag(root), bad).toBeUndefined();
    }
    expect(sync.pinnedTag(join(__dirname, "..", ".."))).toMatch(/^v\d/);
  });

  it("uses the pinned release when there is no newest one, and says so", async () => {
    const { fn, urls } = noLatest(bundled, "v0.3.8");
    const tag = await sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: {}, fallbackTag: "v0.3.8" });
    expect(tag).toBe("v0.3.8");
    expect(urls[0]).toBe("https://api.github.com/repos/JuanenRac/URTC/releases/latest");
    expect(urls[1]).toBe("https://api.github.com/repos/JuanenRac/URTC/releases/tags/v0.3.8");
  });

  it("never replaces a tag that was asked for", async () => {
    const fn = async () => ({ ok: false, status: 404 }) as unknown as Response;
    await expect(sync.downloadRelease({ fetchFn: fn, tag: "v9.9.9", outDir: temp(), env: {}, fallbackTag: "v0.3.8" })).rejects.toThrow(/404/);
  });

  it("does not hide a failure other than a missing release", async () => {
    const fn = async () => ({ ok: false, status: 403 }) as unknown as Response;
    await expect(sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: {}, fallbackTag: "v0.3.8" })).rejects.toThrow(/403/);
  });

  it("keeps the 404 when there is no pin", async () => {
    const fn = async () => ({ ok: false, status: 404 }) as unknown as Response;
    await expect(sync.downloadRelease({ fetchFn: fn, outDir: temp(), env: {} })).rejects.toThrow(/404/);
  });
});
