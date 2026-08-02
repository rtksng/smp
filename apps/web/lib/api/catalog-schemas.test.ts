import { afterEach, describe, expect, it, vi } from "vitest";
import { cartSchema } from "./cart";
import {
  brandSchema,
  categorySchema,
  productListSchema,
  productSchema
} from "./schemas";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("customer catalog schemas", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.unstubAllEnvs();
  });

  it("parses backend product list responses used by the homepage", () => {
    const product = {
      basePrice: 1000,
      brand: {
        id: "brand-id",
        name: "Acme Surgical",
        slug: "acme-surgical"
      },
      brandId: "brand-id",
      category: {
        id: "category-id",
        name: "Surgical Instruments",
        slug: "surgical-instruments"
      },
      categoryId: "category-id",
      createdAt: "2026-05-25T10:00:00.000Z",
      description: "Reusable operating room instrument.",
      disposable: false,
      documents: [],
      expirySensitive: false,
      id: "product-id",
      images: [],
      inStock: true,
      material: "Stainless steel",
      medicalSpecialty: "General Surgery",
      metaDescription: null,
      metaTitle: null,
      mrp: 1400,
      name: "Curved Artery Forceps",
      packSize: "1 pc",
      searchTags: ["forceps", "artery"],
      sellingPrice: 1200,
      shortDescription: "Curved artery forceps.",
      sku: "FORCEPS-001",
      slug: "curved-artery-forceps",
      status: "ACTIVE",
      sterile: true,
      subcategory: {
        id: "subcategory-id",
        name: "Endodontics",
        slug: "endodontics"
      },
      subcategoryId: "subcategory-id",
      taxRate: 18,
      unit: "piece",
      updatedAt: "2026-05-25T10:00:00.000Z",
      variants: []
    };

    expect(productSchema.parse(product).sku).toBe("FORCEPS-001");
    expect(
      productListSchema.parse({
        items: [product],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          limit: 6,
          page: 1,
          total: 1,
          totalPages: 1
        }
      }).items
    ).toHaveLength(1);
  });

  it("parses active category trees and brands from public catalog APIs", () => {
    expect(
      categorySchema.parse({
        children: [],
        description: "Operating room equipment.",
        id: "category-id",
        imageUrl: null,
        isActive: true,
        name: "Operating Room",
        parentId: null,
        slug: "operating-room",
        sortOrder: 1
      }).slug
    ).toBe("operating-room");

    expect(
      brandSchema.parse({
        description: "Trusted surgical supplier.",
        id: "brand-id",
        isActive: true,
        logoUrl: null,
        name: "Acme Surgical",
        slug: "acme-surgical"
      }).name
    ).toBe("Acme Surgical");
  });

  it("rewrites uploaded asset URLs to the Railway storage origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.NEXT_PUBLIC_API_URL =
      "https://smp-production-bfda.up.railway.app/api/v1";
    const railwayStorageBaseUrl =
      "https://pxseurailproxy-production-1f3a.up.railway.app";
    const staleProductImageUrl =
      "https://smp-production-bfda.up.railway.app/uploads/catalog/products/images/forceps.png";
    const staleCategoryImageUrl =
      "https://smp-production-bfda.up.railway.app/uploads/catalog/categories/images/or.png";
    const staleBrandLogoUrl =
      "https://smp-production-bfda.up.railway.app/uploads/catalog/brands/logos/acme.png";

    expect(
      productSchema.parse({
        basePrice: 1000,
        brand: {
          id: "brand-id",
          name: "Acme Surgical",
          slug: "acme-surgical"
        },
        brandId: "brand-id",
        category: {
          id: "category-id",
          name: "Surgical Instruments",
          slug: "surgical-instruments"
        },
        categoryId: "category-id",
        createdAt: "2026-05-25T10:00:00.000Z",
        description: "Reusable operating room instrument.",
        disposable: false,
        documents: [],
        expirySensitive: false,
        id: "product-id",
        images: [
          {
            altText: null,
            id: "image-id",
            isPrimary: true,
            sortOrder: 1,
            url: staleProductImageUrl
          }
        ],
        inStock: true,
        material: "Stainless steel",
        medicalSpecialty: "General Surgery",
        metaDescription: null,
        metaTitle: null,
        mrp: 1400,
        name: "Curved Artery Forceps",
        packSize: "1 pc",
        searchTags: ["forceps", "artery"],
        sellingPrice: 1200,
        shortDescription: "Curved artery forceps.",
        sku: "FORCEPS-001",
        slug: "curved-artery-forceps",
        status: "ACTIVE",
        sterile: true,
        subcategory: null,
        subcategoryId: null,
        taxRate: 18,
        unit: "piece",
        updatedAt: "2026-05-25T10:00:00.000Z",
        variants: []
      }).images[0]?.url
    ).toBe(`${railwayStorageBaseUrl}/catalog/products/images/forceps.png`);

    expect(
      categorySchema.parse({
        children: [],
        description: "Operating room equipment.",
        id: "category-id",
        imageUrl: staleCategoryImageUrl,
        isActive: true,
        name: "Operating Room",
        parentId: null,
        slug: "operating-room",
        sortOrder: 1
      }).imageUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/categories/images/or.png`);

    expect(
      brandSchema.parse({
        description: "Trusted surgical supplier.",
        id: "brand-id",
        isActive: true,
        logoUrl: staleBrandLogoUrl,
        name: "Acme Surgical",
        slug: "acme-surgical"
      }).logoUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/brands/logos/acme.png`);

    expect(
      cartSchema.parse({
        id: "cart-id",
        itemCount: 1,
        items: [
          {
            availableQuantity: 12,
            brand: {
              id: "brand-id",
              name: "Acme Surgical",
              slug: "acme-surgical"
            },
            category: {
              id: "category-id",
              name: "Surgical Instruments",
              slug: "surgical-instruments"
            },
            createdAt: "2026-05-25T10:00:00.000Z",
            id: "cart-item-id",
            imageUrl: staleProductImageUrl,
            isAvailable: true,
            name: "Curved Artery Forceps",
            productId: "product-id",
            productStatus: "ACTIVE",
            quantity: 1,
            sku: "FORCEPS-001",
            slug: "curved-artery-forceps",
            subcategory: null,
            subtotal: 1200,
            tax: 216,
            taxRate: 18,
            total: 1416,
            unitPrice: 1200,
            updatedAt: "2026-05-25T10:00:00.000Z",
            variantId: null,
            variantName: null,
            variantStatus: null
          }
        ],
        totalQuantity: 1,
        totals: {
          deliveryCharge: 0,
          discount: 0,
          grandTotal: 1416,
          subtotal: 1200,
          tax: 216
        },
        updatedAt: "2026-05-25T10:00:00.000Z"
      }).items[0]?.imageUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/products/images/forceps.png`);

    expect(
      categorySchema.parse({
        children: [],
        description: "Operating room equipment.",
        id: "legacy-category-id",
        imageUrl: "<UNKNOWN>/catalog/categories/images/or.png",
        isActive: true,
        name: "Operating Room",
        parentId: null,
        slug: "operating-room",
        sortOrder: 1
      }).imageUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/categories/images/or.png`);

    expect(
      productSchema.parse({
        basePrice: 1000,
        brand: { id: "brand-id", name: "Acme Surgical", slug: "acme-surgical" },
        brandId: "brand-id",
        category: { id: "category-id", name: "Surgical Instruments", slug: "surgical-instruments" },
        categoryId: "category-id",
        createdAt: "2026-05-25T10:00:00.000Z",
        description: "Reusable operating room instrument.",
        disposable: false,
        documents: [],
        expirySensitive: false,
        id: "storage-product-id",
        images: [{ altText: null, id: "storage-image-id", isPrimary: true, sortOrder: 0, url: "https://pxseurailproxy-production-1f3a.up.railway.app/catalog/products/images/forceps.png" }],
        inStock: true,
        material: "Stainless steel",
        medicalSpecialty: "General Surgery",
        metaDescription: null,
        metaTitle: null,
        mrp: 1400,
        name: "Curved Artery Forceps",
        packSize: "1 pc",
        searchTags: ["forceps"],
        sellingPrice: 1200,
        shortDescription: "Curved artery forceps.",
        sku: "FORCEPS-STORAGE",
        slug: "curved-artery-forceps-storage",
        status: "ACTIVE",
        sterile: true,
        subcategory: null,
        subcategoryId: null,
        taxRate: 18,
        unit: "piece",
        updatedAt: "2026-05-25T10:00:00.000Z",
        variants: []
      }).images[0]?.url
    ).toBe(`${railwayStorageBaseUrl}/catalog/products/images/forceps.png`);

    expect(
      categorySchema.parse({
        children: [],
        description: "Operating room equipment.",
        id: "relative-storage-category-id",
        imageUrl: "/catalog/categories/images/or.png",
        isActive: true,
        name: "Operating Room",
        parentId: null,
        slug: "operating-room",
        sortOrder: 1
      }).imageUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/categories/images/or.png`);

    expect(
      categorySchema.parse({
        children: [],
        description: "Operating room equipment.",
        id: "encoded-legacy-category-id",
        imageUrl: "https://api.example.com/%3CUNKNOWN%3E/catalog/categories/images/or.png",
        isActive: true,
        name: "Operating Room",
        parentId: null,
        slug: "operating-room",
        sortOrder: 1
      }).imageUrl
    ).toBe(`${railwayStorageBaseUrl}/catalog/categories/images/or.png`);
  });
});
