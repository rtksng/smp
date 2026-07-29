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
});
