import { describe, expect, it, vi } from "vitest";
import { VERSION_FILE, checkServedVersion, isNewerVersion, servedVersion, versionParts } from "./selfUpdate";

const answer = (body: string, ok = true) => vi.fn(async () => ({ ok, text: async () => body }));
const file = (version: string, name = "urtc-web-studio") => JSON.stringify({ name, version });

describe("versions of the served page", () => {
  it("reads three or four components and refuses anything else", () => {
    expect(versionParts("0.3.6")).toEqual([0, 3, 6, 0]);
    expect(versionParts("v0.8.0.1")).toEqual([0, 8, 0, 1]);
    for (const bad of ["", "1", "1.2", "1.2.3.4.5", "x.y.z", "1.2.3-rc1"]) expect(versionParts(bad)).toBeNull();
  });

  it("calls a served page newer only when it is strictly higher", () => {
    expect(isNewerVersion("0.3.6", "0.3.7")).toBe(true);
    expect(isNewerVersion("0.7.9", "0.8.0.0")).toBe(true);
    expect(isNewerVersion("0.8.0.9", "0.8.1.0")).toBe(true);
    expect(isNewerVersion("0.3.6", "0.3.6")).toBe(false);
    expect(isNewerVersion("0.3.6", "0.3.5")).toBe(false);
    expect(isNewerVersion("0.3.6", "garbage")).toBe(false);
    expect(isNewerVersion("garbage", "0.3.6")).toBe(false);
  });

  it("accepts the version file of this application only", () => {
    expect(servedVersion(file("0.3.7"))).toBe("0.3.7");
    expect(servedVersion(file("0.3.7", "another-app"))).toBeNull();
    expect(servedVersion(file("not a version"))).toBeNull();
    expect(servedVersion("not json")).toBeNull();
    expect(servedVersion("{}")).toBeNull();
  });
});

describe("asking the host", () => {
  it("offers the reload when a higher version is served, asking for a fresh copy of a relative file", async () => {
    const fetchImpl = answer(file("0.3.7"));
    expect(await checkServedVersion("0.3.6", fetchImpl)).toEqual({ state: "newer", served: "0.3.7" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith(`${VERSION_FILE}?t=`)).toBe(true);
    expect(url.includes("://")).toBe(false);
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("omit");
  });

  it("says nothing when the served page is the same or older", async () => {
    expect(await checkServedVersion("0.3.6", answer(file("0.3.6")))).toEqual({ state: "current" });
    expect(await checkServedVersion("0.3.6", answer(file("0.3.0")))).toEqual({ state: "current" });
  });

  it("goes on working when the file is missing, wrong, or the network fails", async () => {
    expect(await checkServedVersion("0.3.6", answer("", false))).toEqual({ state: "unknown" });
    expect(await checkServedVersion("0.3.6", answer("<html>"))).toEqual({ state: "unknown" });
    expect(await checkServedVersion("0.3.6", vi.fn(async () => { throw new Error("offline"); }))).toEqual({ state: "unknown" });
  });

  it("gives up after the time limit", async () => {
    const never = (_: string, init?: RequestInit) => new Promise<never>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    expect(await checkServedVersion("0.3.6", never, 20)).toEqual({ state: "unknown" });
  });
});
