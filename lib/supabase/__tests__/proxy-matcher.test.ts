import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

// The matcher decides whether updateSession runs at all. Paths it matches get
// the auth redirect; paths it excludes are served straight from public/.
//
// This exists because /sw.js was matched, so an unauthenticated request for the
// service worker was answered with a 307 to /login. Browsers reject a worker
// whose script is behind a redirect ("The script resource is behind a redirect,
// which is disallowed"), so the worker never registered — and web push, which
// requires a registered worker, could never have worked either.
const matcher = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
  it("excludes the service worker and its offline fallback", () => {
    expect(matcher.test("/sw.js")).toBe(false);
    expect(matcher.test("/offline")).toBe(false);
  });

  it("excludes PWA and static assets", () => {
    for (const p of [
      "/manifest.webmanifest",
      "/favicon.ico",
      "/icon-192.png",
      "/rise-logo.png",
      "/_next/static/chunk.js",
    ]) {
      expect(matcher.test(p), p).toBe(false);
    }
  });

  it("still guards application routes and APIs", () => {
    for (const p of ["/", "/productivity", "/finance", "/api/push/subscribe"]) {
      expect(matcher.test(p), p).toBe(true);
    }
  });
});
