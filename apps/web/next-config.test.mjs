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

describe("security headers", () => {
  function headerMap(headers) {
    return Object.fromEntries(headers.map((header) => [header.key, header.value]));
  }

  it("are applied to every route", async () => {
    vi.resetModules();
    const { default: nextConfig } = await import("./next.config.mjs");
    const routes = await nextConfig.headers();

    expect(routes).toHaveLength(1);
    expect(routes[0].source).toBe("/:path*");
  });

  it("enforce clickjacking protection and report the full policy", async () => {
    const { securityHeaders } = await import("./security-headers.mjs");
    const byKey = headerMap(
      securityHeaders({ NEXT_PUBLIC_API_URL: "https://api.example.in/api/v1", NODE_ENV: "production" })
    );
    const reportOnly = byKey["Content-Security-Policy-Report-Only"];

    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(reportOnly).toContain("connect-src 'self' https://api.example.in");
    expect(reportOnly).toContain("object-src 'none'");
    expect(reportOnly).not.toContain("unsafe-eval");
    expect(reportOnly).toContain("https://checkout.razorpay.com");
    expect(reportOnly).toContain("frame-src https://api.razorpay.com");
  });

  it("enforce the full policy once CSP_ENFORCE is set", async () => {
    const { securityHeaders } = await import("./security-headers.mjs");
    const byKey = headerMap(securityHeaders({ CSP_ENFORCE: "true", NODE_ENV: "production" }));

    expect(byKey["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(byKey["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("skip HSTS outside production", async () => {
    const { securityHeaders } = await import("./security-headers.mjs");
    const byKey = headerMap(securityHeaders({ NODE_ENV: "development" }));

    expect(byKey["Strict-Transport-Security"]).toBeUndefined();
  });
});
