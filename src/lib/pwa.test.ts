import { describe, expect, it, vi } from "vitest";
import { askToInstall, canRegisterWorker, registerOfflineCopy, type PwaEnv } from "./pwa";

const worker = (overrides: Partial<NonNullable<PwaEnv["serviceWorker"]>> = {}) => ({
  register: vi.fn(async () => ({})),
  ready: Promise.resolve({}),
  ...overrides,
});

describe("registering the offline copy", () => {
  it("registers the worker under the base path of the page and reports ready once it is active", async () => {
    const sw = worker();
    expect(await registerOfflineCopy({ production: true, secureContext: true, baseUrl: "/URTC-WEB-STUDIO/", serviceWorker: sw })).toBe("ready");
    expect(sw.register).toHaveBeenCalledWith("/URTC-WEB-STUDIO/sw.js", { scope: "/URTC-WEB-STUDIO/" });
  });

  it("adds the slash a base path may lack", async () => {
    const sw = worker();
    await registerOfflineCopy({ production: true, secureContext: true, baseUrl: "/studio", serviceWorker: sw });
    expect(sw.register).toHaveBeenCalledWith("/studio/sw.js", { scope: "/studio/" });
  });

  it("does nothing in the development server, on an insecure page or where the browser has no workers", async () => {
    const sw = worker();
    expect(await registerOfflineCopy({ production: false, secureContext: true, baseUrl: "/", serviceWorker: sw })).toBe("unsupported");
    expect(await registerOfflineCopy({ production: true, secureContext: false, baseUrl: "/", serviceWorker: sw })).toBe("unsupported");
    expect(await registerOfflineCopy({ production: true, secureContext: true, baseUrl: "/" })).toBe("unsupported");
    expect(sw.register).not.toHaveBeenCalled();
    expect(canRegisterWorker({ production: true, secureContext: true, baseUrl: "/", serviceWorker: sw })).toBe(true);
  });

  it("reports a failure and lets the page go on when the registration or the storage fails", async () => {
    const refused = worker({ register: vi.fn(async () => { throw new Error("refused"); }) });
    expect(await registerOfflineCopy({ production: true, secureContext: true, baseUrl: "/", serviceWorker: refused })).toBe("failed");
    const failed = Promise.reject(new Error("install failed"));
    failed.catch(() => {}); // handled here so the test runner sees no stray rejection before the page awaits it
    const neverReady = worker({ ready: failed });
    expect(await registerOfflineCopy({ production: true, secureContext: true, baseUrl: "/", serviceWorker: neverReady })).toBe("failed");
  });
});

describe("the install offer of the browser", () => {
  it("is true when the person accepts and false when they dismiss it", async () => {
    expect(await askToInstall({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: "accepted" }) })).toBe(true);
    expect(await askToInstall({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: "dismissed" }) })).toBe(false);
  });
  it("is false when the browser refuses to show it", async () => {
    expect(await askToInstall({ prompt: async () => { throw new Error("used twice"); }, userChoice: Promise.resolve({ outcome: "accepted" }) })).toBe(false);
  });
});
