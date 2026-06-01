import { describe, expect, it } from "vitest";
import {
  brandSchema,
  categorySchema,
  productListSchema,
  productSchema
} from "./schemas";

describe("customer catalog schemas", () => {
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
});
