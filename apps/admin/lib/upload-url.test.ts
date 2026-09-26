import { describe, expect, it } from "vitest";
import { resolveAdminUploadUrl } from "./upload-url";

describe("admin catalog image delivery", () => {
  it.each([
    "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/product.png",
    "https://smp-production-bfda.up.railway.app/uploads/catalog/products/images/product.png",
    "http://localhost:4000/uploads/catalog/products/images/product.png",
    "/catalog/products/images/product.png",
    "/uploads/catalog/products/images/product.png",
    "<UNKNOWN>/catalog/products/images/product.png"
  ])("keeps managed image %s on the admin origin", (url) => {
    expect(resolveAdminUploadUrl(url)).toBe(
      "/uploads/catalog/products/images/product.png"
    );
  });

  it("preserves unrelated external images and local assets", () => {
    expect(
      resolveAdminUploadUrl("https://cdn.example.com/catalog/products/photo.png")
    ).toBe("https://cdn.example.com/catalog/products/photo.png");
    expect(resolveAdminUploadUrl("/brand/logo.png")).toBe("/brand/logo.png");
  });

  it("is idempotent and preserves query parameters", () => {
    const resolved = resolveAdminUploadUrl(
      "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/product.png?v=2#preview"
    );

    expect(resolved).toBe("/uploads/catalog/products/images/product.png?v=2#preview");
    expect(resolveAdminUploadUrl(resolved)).toBe(resolved);
  });
});
