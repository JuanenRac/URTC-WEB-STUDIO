import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_SECURITY_POLICY, PERMISSIONS_POLICY } from "../../vite.config";
import { LATEST_RELEASE_URL } from "./githubRelease";

const root = join(__dirname, "..", "..");
const directive = (name: string) => CONTENT_SECURITY_POLICY.split(";").map(s => s.trim()).find(s => s.startsWith(`${name} `)) ?? "";

describe("the content security policy of the built page", () => {
  it("runs scripts only from the page itself, never inline and never eval", () => {
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(directive("object-src")).toBe("object-src 'none'");
  });
  it("lets the page reach the GitHub host it reads the releases from, and the hosts that serve the assets", () => {
    const connect = directive("connect-src");
    expect(connect).toContain(new URL(LATEST_RELEASE_URL).origin);
    expect(connect).toContain("https://*.githubusercontent.com");
  });
  it("takes styles and fonts from the page itself and allows only style attributes inline", () => {
    expect(directive("style-src")).toBe("style-src 'self'");
    expect(directive("style-src-attr")).toBe("style-src-attr 'unsafe-inline'");
    expect(directive("font-src")).toBe("font-src 'self'");
    expect(directive("default-src")).toBe("default-src 'self'");
  });
  it("names no host other than the ones that serve GitHub releases", () => {
    const hosts = [...CONTENT_SECURITY_POLICY.matchAll(/https:\/\/[^\s;]+/g)].map(match => match[0]);
    expect(hosts.sort()).toEqual([
      "https://*.githubusercontent.com",
      "https://api.github.com",
      "https://github.com",
      "https://raw.githubusercontent.com",
    ]);
  });
});

describe("the fonts are served by the page", () => {
  it("index.html loads nothing from a font host", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
  });
  it("the font packages the interface uses are installed and imported", () => {
    const main = readFileSync(join(root, "src", "main.tsx"), "utf8");
    for (const family of ["jetbrains-mono", "plus-jakarta-sans"]) {
      expect(main).toContain(`@fontsource/${family}/`);
      expect(existsSync(join(root, "node_modules", "@fontsource", family, "latin-400.css"))).toBe(true);
    }
  });
  it("no source file asks a font host for anything", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
    for (const file of walk(join(root, "src")).filter(f => /\.(css|tsx?)$/.test(f) && !f.endsWith("contentSecurityPolicy.test.ts"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    }
  });
});

describe("the response headers for hosts that can send them (public/_headers)", () => {
  const headers = readFileSync(join(root, "public", "_headers"), "utf8");
  const value = (name: string) => headers.split("\n").map(l => l.trim()).find(l => l.startsWith(`${name}:`))?.slice(name.length + 1).trim();

  it("carry the same Content-Security-Policy as the page, plus frame-ancestors", () => {
    expect(value("Content-Security-Policy")).toBe(`${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`);
  });
  it("carry the Permissions-Policy: serial for the page itself and nothing else powerful", () => {
    expect(value("Permissions-Policy")).toBe(PERMISSIONS_POLICY);
    expect(PERMISSIONS_POLICY).toContain("serial=(self)");
    for (const feature of ["camera", "microphone", "geolocation", "usb"]) expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
  });
  it("stop content sniffing and referrers", () => {
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Referrer-Policy")).toBe("no-referrer");
  });
});
