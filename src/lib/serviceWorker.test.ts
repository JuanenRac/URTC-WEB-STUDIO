import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { cacheVersion, precacheList, renderServiceWorker, type PrecacheEntry } from "./serviceWorkerBuild";

const template = readFileSync(join(__dirname, "..", "..", "scripts", "sw.template.js"), "utf8");
const entries: PrecacheEntry[] = [
  { path: "index.html", digest: "a" },
  { path: "assets/index-1.js", digest: "b" },
  { path: "assets/index-1.js.map", digest: "c" },
  { path: "firmware/firmware_manifest.json", digest: "d" },
  { path: "firmware/URTC_MAIN_FIRMWARE_v1.bin", digest: "e" },
  { path: "images/urtc_custom_icon.svg", digest: "f" },
  { path: "manifest.webmanifest", digest: "g" },
  { path: "_headers", digest: "h" },
  { path: "version.json", digest: "i" },
  { path: "sw.js", digest: "j" },
];

describe("what the build writes for the service worker", () => {
  it("keeps the page, the scripts, the firmware and the images, and never the headers file, the version file or itself", () => {
    expect(precacheList(entries)).toEqual([
      "assets/index-1.js", "firmware/URTC_MAIN_FIRMWARE_v1.bin", "firmware/firmware_manifest.json", "images/urtc_custom_icon.svg", "index.html", "manifest.webmanifest",
    ]);
    expect(precacheList([])).toEqual(["index.html"]);
    expect(precacheList([{ path: "./assets/a.js", digest: "x" }, { path: "\\assets\\b.js", digest: "y" }])).toEqual(["assets/a.js", "assets/b.js", "index.html"]);
  });

  it("names the stored copy by version and by content, whatever the order of the files", () => {
    const name = cacheVersion("0.3.6", entries);
    expect(name).toMatch(/^0\.3\.6-[0-9a-f]{12}$/);
    expect(cacheVersion("0.3.6", entries.slice().reverse())).toBe(name);
    expect(cacheVersion("0.3.6", entries.map((e) => (e.path === "index.html" ? { ...e, digest: "changed" } : e)))).not.toBe(name);
    expect(cacheVersion("0.3.7", entries)).not.toBe(name);
  });

  it("fills in both markers and leaves valid JavaScript", () => {
    const text = renderServiceWorker(template, "0.3.6", entries);
    expect(text).not.toContain("__CACHE_VERSION__");
    expect(text).not.toContain("__PRECACHE__");
    expect(() => new vm.Script(text)).not.toThrow();
  });

  it("refuses a template without its markers and a version that cannot be part of a name", () => {
    expect(() => renderServiceWorker("nothing", "1.0.0", entries)).toThrow(/markers/);
    expect(() => renderServiceWorker(template, "1.0 beta", entries)).toThrow(/version/);
  });
});

// ---- the worker itself, run against a small model of the browser ----

type Listener = (event: Record<string, unknown>) => void;

function makeWorld(scope = "https://studio.example/app/", online = true) {
  const stores = new Map<string, Map<string, { body: string; ok: boolean; status: number; type: string }>>();
  const listeners: Record<string, Listener> = {};
  const network = new Map<string, string>();
  const fetched: string[] = [];
  let reachable = online;
  const keyOf = (input: unknown) => (typeof input === "string" ? input : (input as { url: string }).url);
  const response = (body: string, extra: Partial<{ ok: boolean; status: number; type: string }> = {}) => {
    const r = { body, ok: true, status: 200, type: "basic", ...extra };
    return { ...r, clone: () => ({ ...r, clone: () => r }) };
  };
  const cacheApi = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        put: async (request: unknown, res: { body: string; ok: boolean; status: number; type: string }) => { store.set(keyOf(request), res); },
        addAll: async (requests: unknown[]) => {
          for (const request of requests) {
            const url = keyOf(request);
            fetched.push(url);
            if (!reachable || !network.has(url)) throw new Error(`cannot fetch ${url}`);
            store.set(url, response(network.get(url)!));
          }
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: unknown) => {
      for (const store of stores.values()) {
        const found = store.get(keyOf(request));
        if (found) return found;
      }
      return undefined;
    },
  };
  const self = {
    registration: { scope },
    clients: { claim: async () => {} },
    addEventListener: (type: string, listener: Listener) => { listeners[type] = listener; },
  };
  const context = {
    self, caches: cacheApi, URL, Request: class { url: string; constructor(url: string) { this.url = url; } }, Promise, setTimeout, clearTimeout, Error, Boolean, JSON,
    fetch: async (request: unknown) => {
      const url = keyOf(request);
      fetched.push(url);
      if (!reachable) throw new Error("offline");
      if (!network.has(url)) return response("missing", { ok: false, status: 404 });
      return response(network.get(url)!);
    },
  };
  const run = (version: string, list: PrecacheEntry[]) => vm.runInNewContext(renderServiceWorker(template, version, list), context);
  const waitFor = async (type: string) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]({ waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
  };
  const request = async (url: string, init: { mode?: string; method?: string } = {}) => {
    let answer: Promise<{ body: string }> | undefined;
    listeners.fetch({ request: { url, method: init.method ?? "GET", mode: init.mode ?? "cors" }, respondWith: (p: Promise<{ body: string }>) => { answer = p; } });
    return answer === undefined ? "network" : (await answer).body;
  };
  return { stores, network, fetched, run, waitFor, request, setReachable: (value: boolean) => { reachable = value; }, listeners };
}

describe("the service worker", () => {
  const files: PrecacheEntry[] = [{ path: "assets/app-1.js", digest: "1" }, { path: "firmware/firmware_manifest.json", digest: "2" }, { path: "firmware/fw.bin", digest: "3" }];
  const seed = (world: ReturnType<typeof makeWorld>, suffix = "") => {
    world.network.set("https://studio.example/app/index.html", "page" + suffix);
    world.network.set("https://studio.example/app/", "page" + suffix);
    world.network.set("https://studio.example/app/assets/app-1.js", "script" + suffix);
    world.network.set("https://studio.example/app/firmware/firmware_manifest.json", "manifest" + suffix);
    world.network.set("https://studio.example/app/firmware/fw.bin", "image" + suffix);
  };

  it("stores the whole copy when it installs and fails the install when a file is missing", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    const [store] = [...world.stores.values()];
    expect([...store.keys()].sort()).toEqual([
      "https://studio.example/app/assets/app-1.js", "https://studio.example/app/firmware/firmware_manifest.json", "https://studio.example/app/firmware/fw.bin", "https://studio.example/app/index.html",
    ]);
    const broken = makeWorld();
    seed(broken);
    broken.network.delete("https://studio.example/app/firmware/fw.bin");
    broken.run("1.0.0", files);
    await expect(broken.waitFor("install")).rejects.toThrow(/cannot fetch/);
  });

  it("opens the page and the firmware without a network", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    world.setReachable(false);
    expect(await world.request("https://studio.example/app/", { mode: "navigate" })).toBe("page");
    expect(await world.request("https://studio.example/app/index.html")).toBe("page");
    expect(await world.request("https://studio.example/app/assets/app-1.js")).toBe("script");
    expect(await world.request("https://studio.example/app/firmware/fw.bin")).toBe("image");
    expect(await world.request("https://studio.example/app/firmware/firmware_manifest.json")).toBe("manifest");
  });

  it("gives the newest page and manifest when there is a network, and keeps them for later", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    seed(world, "-new");
    expect(await world.request("https://studio.example/app/", { mode: "navigate" })).toBe("page-new");
    expect(await world.request("https://studio.example/app/firmware/firmware_manifest.json")).toBe("manifest-new");
    world.setReachable(false);
    expect(await world.request("https://studio.example/app/", { mode: "navigate" })).toBe("page-new");
  });

  it("serves the hashed files from the copy first, without asking the network", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    world.fetched.length = 0;
    expect(await world.request("https://studio.example/app/assets/app-1.js")).toBe("script");
    expect(world.fetched).toEqual([]);
  });

  it("leaves alone what is not the business of the page: other methods, other hosts, version.json and the worker", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    expect(await world.request("https://studio.example/app/firmware/fw.bin", { method: "POST" })).toBe("network");
    expect(await world.request("https://api.github.com/repos/x/y/releases/latest")).toBe("network");
    expect(await world.request("https://studio.example/other/page.html")).toBe("network");
    expect(await world.request("https://studio.example/app/version.json")).toBe("network");
    expect(await world.request("https://studio.example/app/sw.js")).toBe("network");
  });

  it("does not keep an error answer or one that is not from the page", async () => {
    const world = makeWorld();
    seed(world);
    world.run("1.0.0", files);
    await world.waitFor("install");
    const answer = await world.request("https://studio.example/app/assets/missing.js");
    expect(answer).toBe("missing");
    const [store] = [...world.stores.values()];
    expect(store.has("https://studio.example/app/assets/missing.js")).toBe(false);
  });

  it("removes the copies of earlier versions when it activates, and only those of the Studio", async () => {
    const world = makeWorld();
    seed(world);
    world.stores.set("urtc-web-studio-0.9.0-aaaaaaaaaaaa", new Map());
    world.stores.set("someone-else", new Map());
    world.run("1.0.0", files);
    await world.waitFor("install");
    await world.waitFor("activate");
    const names = [...world.stores.keys()];
    expect(names).toContain("someone-else");
    expect(names.filter((n) => n.startsWith("urtc-web-studio-"))).toHaveLength(1);
    expect(names.some((n) => n.startsWith("urtc-web-studio-1.0.0-"))).toBe(true);
  });

  it("does not take over by itself: a new worker waits for the open tabs to close", () => {
    expect(template).not.toMatch(/skipWaiting/);
  });
});
