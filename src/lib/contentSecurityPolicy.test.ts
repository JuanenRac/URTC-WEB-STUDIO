import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "../../vite.config";
import { LATEST_RELEASE_URL } from "./githubRelease";

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
  it("allows the font host that index.html loads from", () => {
    expect(directive("style-src")).toContain("https://fonts.googleapis.com");
    expect(directive("font-src")).toContain("https://fonts.gstatic.com");
  });
});
