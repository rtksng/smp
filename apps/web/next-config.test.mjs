/* global process */

import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }

  vi.resetModules();
});

describe("next config", () => {
  it("allows images from the current Railway API host", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_API_URL;
    const { default: nextConfig } = await import("./next.config.mjs");
    const hostnames = nextConfig.images.remotePatterns.map(
      (pattern) => pattern.hostname
    );

    expect(hostnames).toContain("smp-production-bfda.up.railway.app");
    expect(hostnames).toContain(
      "pxseurailproxy-production-1f3a.up.railway.app"
    );
    expect(hostnames).not.toContain("smp-production-b700.up.railway.app");
  });

  it("lets the App Router API proxy own customer API requests", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
    const { default: nextConfig } = await import("./next.config.mjs");

    const rewrites =
      typeof nextConfig.rewrites === "function"
        ? await nextConfig.rewrites()
        : [];

    expect(JSON.stringify(rewrites)).not.toContain("/api/v1/:path*");
  });
});
