import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCustomerUploadUrl, resolveNullableCustomerUploadUrl } from "./upload-url";

afterEach(() => vi.unstubAllEnvs());

describe.each(["development", "production"])("%s catalog image delivery", (environment) => {
  it.each([
    "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/product.png",
    "https://smp-production-bfda.up.railway.app/uploads/catalog/products/images/product.png",
    "http://localhost:4000/uploads/catalog/products/images/product.png",
    "/catalog/products/images/product.png",
    "/uploads/catalog/products/images/product.png",
    "<UNKNOWN>/catalog/products/images/product.png"
  ])("keeps %s on the storefront origin", (url) => {
    vi.stubEnv("NODE_ENV", environment);
    expect(resolveCustomerUploadUrl(url)).toBe("/uploads/catalog/products/images/product.png");
  });

  it("preserves unrelated external images and local assets", () => {
    vi.stubEnv("NODE_ENV", environment);
    for (const url of ["https://cdn.example.com/catalog/products/photo.png", "/banner/banner.png"]) {
      expect(resolveCustomerUploadUrl(url)).toBe(url);
    }
    expect(resolveNullableCustomerUploadUrl(null)).toBeNull();
  });

  it("is idempotent and preserves query parameters", () => {
    vi.stubEnv("NODE_ENV", environment);
    const resolved = resolveCustomerUploadUrl(
      "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/product.png?v=2#preview"
    );
    expect(resolved).toBe("/uploads/catalog/products/images/product.png?v=2#preview");
    expect(resolveCustomerUploadUrl(resolved)).toBe(resolved);
  });
});
