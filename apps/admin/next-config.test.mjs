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
    delete process.env.NEXT_PUBLIC_API_URL;
    const { default: nextConfig } = await import("./next.config.mjs");
    const hostnames = nextConfig.images.remotePatterns.map(
      (pattern) => pattern.hostname
    );

    expect(hostnames).toContain("smp-production-bfda.up.railway.app");
    expect(hostnames).not.toContain("smp-production-b700.up.railway.app");
  });

  it("rewrites local admin API proxy requests to the configured API base", async () => {
    process.env.NEXT_PUBLIC_API_URL =
      "https://smp-production-bfda.up.railway.app/api/v1";
    const { default: nextConfig } = await import("./next.config.mjs");

    await expect(nextConfig.rewrites()).resolves.toEqual([
      {
        destination: "https://smp-production-bfda.up.railway.app/api/v1/:path*",
        source: "/api/v1/:path*"
      }
    ]);
  });
});
