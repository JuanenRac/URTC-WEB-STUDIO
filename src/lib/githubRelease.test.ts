import { describe, expect, it } from "vitest";
import {
  GithubReleaseError, LATEST_RELEASE_URL, downloadAsset, downloadAssetText, digestMismatch,
  imagesFromRelease, listAllReleaseFirmware, parseSha256Sidecar,
} from "./githubRelease";

// A release shaped like the real one: 17 assets (4 components x bin, hex, .sha256, .manifest.json, plus the index).
const NAMES = (() => {
  const out = ["firmware_manifest.json"];
  for (const stem of ["URTC_MAIN_BOOTLOADER_v0.3.9", "URTC_MAIN_FIRMWARE_v0.3.5", "URTC_SLAVE_BOOTLOADER_v0.2.3", "URTC_SLAVE_FIRMWARE_v0.1.10"]) {
    out.push(`${stem}.bin`, `${stem}.hex`, `${stem}.bin.sha256`, `${stem}.bin.manifest.json`);
  }
  return out;
})();

const asset = (name: string, i: number) => ({
  name,
  size: 2048 * (i + 1),
  url: `https://api.github.com/repos/JuanenRac/URTC/releases/assets/${1000 + i}`,
  browser_download_url: `https://github.com/JuanenRac/URTC/releases/download/v0.3.5/${name}`,
  digest: `sha256:${"ab".repeat(32)}`,
});
const RELEASE = { tag_name: "v0.3.5", assets: NAMES.map(asset) };

interface Call { url: string; accept?: string }
type Handler = (url: string, accept?: string) => { status: number; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> } | "throw";

function fakeFetch(handler: Handler) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: { headers?: Record<string, string> }) => {
    const accept = init?.headers?.Accept;
    calls.push({ url, accept });
    const r = handler(url, accept);
    if (r === "throw") throw new TypeError("Failed to fetch");
    const bytes = r.bytes ?? new TextEncoder().encode(typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}));
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      json: async () => r.body,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as unknown as Response;
  };
  return { fn, calls };
}

describe("the images of the newest release", () => {
  it("lists only the application images of the selected board, with their sidecars", () => {
    const main = imagesFromRelease(RELEASE, "main");
    expect(main.map(i => i.name)).toEqual(["URTC_MAIN_FIRMWARE_v0.3.5.bin"]);
    expect(main[0].sha256?.name).toBe("URTC_MAIN_FIRMWARE_v0.3.5.bin.sha256");
    expect(main[0].manifest?.name).toBe("URTC_MAIN_FIRMWARE_v0.3.5.bin.manifest.json");
    expect(main[0].tag).toBe("v0.3.5");
    expect(main[0].asset.apiUrl).toMatch(/\/releases\/assets\/\d+$/);
    expect(imagesFromRelease(RELEASE, "slave").map(i => i.name)).toEqual(["URTC_SLAVE_FIRMWARE_v0.1.10.bin"]);
  });

  it("leaves out bootloaders, hex files, sidecars and the index", () => {
    const names = [...imagesFromRelease(RELEASE, "main"), ...imagesFromRelease(RELEASE, "slave")].map(i => i.name);
    expect(names.some(n => /BOOTLOADER|\.hex|\.sha256|\.json/.test(n))).toBe(false);
  });

  it("does not require the sidecars to be there, and ignores malformed assets", () => {
    const bare = { tag_name: "v1.0.0", assets: [asset("URTC_MAIN_FIRMWARE_v1.0.0.bin", 0), { name: "broken" }, null] };
    const [image] = imagesFromRelease(bare, "main");
    expect(image.sha256).toBeUndefined();
    expect(image.manifest).toBeUndefined();
    expect(imagesFromRelease({}, "main")).toEqual([]);
  });

  it("is read from the releases API with the JSON accept header", async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, body: RELEASE }));
    const all = await listAllReleaseFirmware(fn);
    expect(all.map(i => i.name)).toEqual(["URTC_MAIN_FIRMWARE_v0.3.5.bin", "URTC_SLAVE_FIRMWARE_v0.1.10.bin"]);
    expect(calls).toEqual([{ url: LATEST_RELEASE_URL, accept: "application/vnd.github+json" }]);
    expect(LATEST_RELEASE_URL).toBe("https://api.github.com/repos/JuanenRac/URTC/releases/latest");
  });

  it("reports the rate limit, a missing release, a release without images and a network failure as their own errors", async () => {
    const code = async (handler: Handler) => {
      try { await listAllReleaseFirmware(fakeFetch(handler).fn); return "none"; } catch (e) { return e instanceof GithubReleaseError ? e.code : "other"; }
    };
    expect(await code(() => ({ status: 403, headers: { "x-ratelimit-remaining": "0" } }))).toBe("rate_limit");
    expect(await code(() => ({ status: 429 }))).toBe("rate_limit");
    expect(await code(() => ({ status: 403 }))).toBe("http");
    expect(await code(() => ({ status: 404 }))).toBe("no_release");
    expect(await code(() => ({ status: 500 }))).toBe("http");
    expect(await code(() => ({ status: 200, body: { tag_name: "v1", assets: [] } }))).toBe("no_images");
    expect(await code(() => "throw")).toBe("network");
  });
});

describe("downloading an asset from a browser", () => {
  const target = imagesFromRelease(RELEASE, "main")[0].asset;
  const bytes = new Uint8Array([1, 2, 3, 4]);

  it("goes through the API endpoint with Accept: application/octet-stream", async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, bytes }));
    expect(new Uint8Array(await downloadAsset(fn, target))).toEqual(bytes);
    expect(calls).toEqual([{ url: target.apiUrl, accept: "application/octet-stream" }]);
  });

  it("falls back to browser_download_url when the API endpoint fails or is blocked", async () => {
    const blocked = fakeFetch(url => (url === target.apiUrl ? "throw" : { status: 200, bytes }));
    expect(new Uint8Array(await downloadAsset(blocked.fn, target))).toEqual(bytes);
    expect(blocked.calls.map(c => c.url)).toEqual([target.apiUrl, target.browserUrl]);
    const refused = fakeFetch(url => (url === target.apiUrl ? { status: 502 } : { status: 200, bytes }));
    expect(new Uint8Array(await downloadAsset(refused.fn, target))).toEqual(bytes);
  });

  it("fails with the first error when neither works, and says when it was the rate limit", async () => {
    await expect(downloadAsset(fakeFetch(() => "throw").fn, target)).rejects.toMatchObject({ code: "network" });
    await expect(downloadAsset(fakeFetch(() => ({ status: 404 })).fn, target)).rejects.toMatchObject({ code: "http" });
    await expect(downloadAsset(fakeFetch(() => ({ status: 403, headers: { "x-ratelimit-remaining": "0" } })).fn, target)).rejects.toMatchObject({ code: "rate_limit" });
  });

  it("reads a text sidecar", async () => {
    const { fn } = fakeFetch(() => ({ status: 200, bytes: new TextEncoder().encode("{\"version\":\"0.3.5\"}") }));
    expect(await downloadAssetText(fn, target)).toBe("{\"version\":\"0.3.5\"}");
  });
});

describe("the digests a release publishes", () => {
  const hex = "0123456789abcdef".repeat(4);

  it("reads the digest of a .sha256 sidecar, with or without the file name", () => {
    expect(parseSha256Sidecar(`${hex}  URTC_MAIN_FIRMWARE_v0.3.5.bin\n`)).toBe(hex);
    expect(parseSha256Sidecar(hex.toUpperCase())).toBe(hex);
    expect(parseSha256Sidecar("not a digest")).toBeNull();
    expect(parseSha256Sidecar("")).toBeNull();
  });

  it("accepts a file that matches, and names the digest it expected when it does not", () => {
    expect(digestMismatch(hex, `${hex}  x.bin`, `sha256:${hex}`)).toBeNull();
    expect(digestMismatch(hex, null, undefined)).toBeNull();
    const other = "f".repeat(64);
    expect(digestMismatch(other, `${hex}  x.bin`)).toBe(hex);
    expect(digestMismatch(other, null, `sha256:${hex}`)).toBe(hex);
    expect(digestMismatch(hex, `${hex}  x.bin`, `sha256:${other}`)).toBe(other);
  });
});
