import { afterEach, describe, expect, it } from "vitest";
import {
  buildMetadata,
  buildPrivateMetadata,
  buildBrandMetadata,
  buildCategoryMetadata,
  buildProductMetadata,
  getBrandImageAlt,
  getCategoryImageAlt,
  getProductImageAlt,
  trimMetaDescription
} from "./metadata";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

describe("web SEO metadata helpers", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("builds canonical Open Graph metadata from the configured site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.surgical.example";

    const metadata = buildMetadata({
      description: "Shop surgical equipment for hospitals and clinics.",
      image: "https://cdn.example.com/catalog/forceps.jpg",
      path: "/products/forceps",
      title: "Curved Artery Forceps"
    });

    expect(metadata.alternates?.canonical).toBe(
      "https://shop.surgical.example/products/forceps"
    );
    expect(metadata.openGraph?.url).toBe(
      "https://shop.surgical.example/products/forceps"
    );
    expect(metadata.openGraph?.images).toEqual([
      {
        alt: "Curved Artery Forceps",
        url: "https://cdn.example.com/catalog/forceps.jpg"
      }
    ]);
  });

  it("adds noindex directives for private customer routes", () => {
    const metadata = buildPrivateMetadata({
      description: "Review your protected customer cart.",
      path: "/cart",
      title: "Cart"
    });

    expect(metadata.robots).toEqual({
      follow: false,
      googleBot: {
        follow: false,
        index: false
      },
      index: false
    });
  });

  it("trims generated meta descriptions without cutting words in half", () => {
    expect(
      trimMetaDescription(
        "Reusable surgical instruments, medical consumables, hospital diagnostics, and operating room supplies for procurement teams.",
        82
      )
    ).toBe(
      "Reusable surgical instruments, medical consumables, hospital diagnostics, and..."
    );
  });

  it("builds contextual image alt text when catalog records omit it", () => {
    expect(getProductImageAlt("Sterile Drapes", null)).toBe(
      "Sterile Drapes product image"
    );
    expect(getProductImageAlt("Sterile Drapes", "Folded sterile drape pack")).toBe(
      "Folded sterile drape pack"
    );
    expect(getCategoryImageAlt("Operating Room")).toBe(
      "Operating Room category image"
    );
    expect(getBrandImageAlt("Acme Surgical")).toBe("Acme Surgical brand logo");
  });

  it("uses product API SEO fields before generated product metadata", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.surgical.example";

    const metadata = buildProductMetadata({
      description: "Long reusable product description.",
      images: [
        {
          altText: null,
          id: "image-1",
          isPrimary: true,
          sortOrder: 1,
          url: "https://cdn.example.com/products/forceps.jpg"
        }
      ],
      metaDescription: "Buy artery forceps for surgical teams.",
      metaTitle: "Premium Artery Forceps",
      name: "Curved Artery Forceps",
      shortDescription: "Curved artery forceps.",
      slug: "curved-artery-forceps"
    });

    expect(metadata.title).toBe("Premium Artery Forceps");
    expect(metadata.description).toBe("Buy artery forceps for surgical teams.");
    expect(metadata.alternates?.canonical).toBe(
      "https://shop.surgical.example/products/curved-artery-forceps"
    );
    expect(metadata.openGraph?.images).toEqual([
      {
        alt: "Curved Artery Forceps product image",
        url: "https://cdn.example.com/products/forceps.jpg"
      }
    ]);
  });

  it("generates category and brand metadata from public catalog records", () => {
    expect(
      buildCategoryMetadata({
        description: "Operating room equipment and sterile surgical supplies.",
        imageUrl: "https://cdn.example.com/categories/or.jpg",
        name: "Operating Room",
        slug: "operating-room"
      }).title
    ).toBe("Operating Room Surgical Products");

    expect(
      buildBrandMetadata({
        description: null,
        logoUrl: "https://cdn.example.com/brands/acme.svg",
        name: "Acme Surgical",
        slug: "acme-surgical"
      }).description
    ).toBe("Shop Acme Surgical surgical and medical equipment with GST invoices and secure checkout.");
  });
});
