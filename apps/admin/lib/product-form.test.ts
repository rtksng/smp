import { describe, expect, it } from "vitest";
import {
  buildProductPayload,
  createEmptyProductFormValues,
  productFormSchema,
  productToFormValues,
  type AdminProduct
} from "./product-form";

function validFormValues() {
  return {
    ...createEmptyProductFormValues(),
    basePrice: "200",
    brandId: "brand-1",
    categoryId: "category-1",
    description: "Reusable surgical forceps for operating rooms.",
    disposable: false,
    expirySensitive: false,
    images: [
      {
        altText: "Main forceps image",
        isPrimary: true,
        sortOrder: "0",
        url: "https://cdn.example.com/products/forceps/main.jpg"
      },
      {
        altText: "",
        isPrimary: false,
        sortOrder: "1",
        url: ""
      }
    ],
    medicalSpecialty: "General Surgery",
    mrp: "300",
    name: "Curved Artery Forceps",
    searchTags: "forceps, artery, forceps",
    sellingPrice: "240",
    shortDescription: "Curved artery forceps.",
    sku: "FORCEPS-001",
    slug: "curved-artery-forceps",
    status: "ACTIVE",
    sterile: true,
    taxRate: "18",
    unit: "piece",
    variants: [
      {
        attributesText: "{\"size\":\"6 inch\",\"sterile\":true}",
        mrp: "175",
        name: "6 inch",
        sellingPrice: "140",
        sku: "FORCEPS-001-6IN",
        status: "ACTIVE"
      }
    ],
    documents: [
      {
        fileKey: "catalog/products/documents/manual.pdf",
        fileUrl: "https://cdn.example.com/products/forceps/manual.pdf",
        title: "User Manual",
        type: "MANUAL"
      }
    ]
  };
}

describe("product form helpers", () => {
  it("builds an admin product payload with normalized tags and nested assets", () => {
    const parsed = productFormSchema.parse(validFormValues());

    expect(buildProductPayload(parsed)).toEqual({
      basePrice: 200,
      brandId: "brand-1",
      categoryId: "category-1",
      description: "Reusable surgical forceps for operating rooms.",
      disposable: false,
      documents: [
        {
          fileKey: "catalog/products/documents/manual.pdf",
          fileUrl: "https://cdn.example.com/products/forceps/manual.pdf",
          title: "User Manual",
          type: "MANUAL"
        }
      ],
      expirySensitive: false,
      images: [
        {
          altText: "Main forceps image",
          isPrimary: true,
          sortOrder: 0,
          url: "https://cdn.example.com/products/forceps/main.jpg"
        }
      ],
      material: null,
      medicalSpecialty: "General Surgery",
      metaDescription: null,
      metaTitle: null,
      mrp: 300,
      name: "Curved Artery Forceps",
      packSize: null,
      searchTags: ["forceps", "artery"],
      sellingPrice: 240,
      shortDescription: "Curved artery forceps.",
      sku: "FORCEPS-001",
      slug: "curved-artery-forceps",
      status: "ACTIVE",
      sterile: true,
      taxRate: 18,
      unit: "piece",
      variants: [
        {
          attributes: {
            size: "6 inch",
            sterile: true
          },
          mrp: 175,
          name: "6 inch",
          sellingPrice: 140,
          sku: "FORCEPS-001-6IN",
          status: "ACTIVE"
        }
      ]
    });
  });

  it("rejects product and variant prices above MRP", () => {
    const productResult = productFormSchema.safeParse({
      ...validFormValues(),
      sellingPrice: "301"
    });
    const variantResult = productFormSchema.safeParse({
      ...validFormValues(),
      variants: [
        {
          attributesText: "{}",
          mrp: "100",
          name: "Invalid variant",
          sellingPrice: "101",
          sku: "FORCEPS-INVALID",
          status: "ACTIVE"
        }
      ]
    });

    expect(productResult.success).toBe(false);
    expect(productResult.error?.issues[0]?.message).toBe(
      "Selling price cannot be greater than MRP."
    );
    expect(variantResult.success).toBe(false);
    expect(variantResult.error?.issues[0]?.message).toBe(
      "Variant selling price cannot be greater than variant MRP."
    );
  });

  it("hydrates edit form values from an admin product", () => {
    const product: AdminProduct = {
      basePrice: 200,
      brand: {
        id: "brand-1",
        name: "Acme Surgical",
        slug: "acme-surgical"
      },
      brandId: "brand-1",
      category: {
        id: "category-1",
        name: "Surgical Instruments",
        slug: "surgical-instruments"
      },
      categoryId: "category-1",
      createdAt: "2026-05-25T10:00:00.000Z",
      description: "Reusable surgical forceps for operating rooms.",
      disposable: false,
      documents: [
        {
          fileKey: "catalog/products/documents/manual.pdf",
          fileUrl: "https://cdn.example.com/products/forceps/manual.pdf",
          id: "document-1",
          title: "User Manual",
          type: "MANUAL"
        }
      ],
      expirySensitive: false,
      id: "product-1",
      images: [
        {
          altText: "Main forceps image",
          id: "image-1",
          isPrimary: true,
          sortOrder: 0,
          url: "https://cdn.example.com/products/forceps/main.jpg"
        }
      ],
      inStock: true,
      material: null,
      medicalSpecialty: "General Surgery",
      metaDescription: null,
      metaTitle: null,
      mrp: 300,
      name: "Curved Artery Forceps",
      packSize: null,
      searchTags: ["forceps", "artery"],
      sellingPrice: 240,
      shortDescription: "Curved artery forceps.",
      sku: "FORCEPS-001",
      slug: "curved-artery-forceps",
      status: "ACTIVE",
      sterile: true,
      taxRate: 18,
      unit: "piece",
      updatedAt: "2026-05-25T10:00:00.000Z",
      variants: [
        {
          attributes: {
            size: "6 inch"
          },
          id: "variant-1",
          mrp: 175,
          name: "6 inch",
          sellingPrice: 140,
          sku: "FORCEPS-001-6IN",
          status: "ACTIVE"
        }
      ]
    };

    expect(productToFormValues(product)).toMatchObject({
      basePrice: "200",
      brandId: "brand-1",
      categoryId: "category-1",
      images: [
        {
          altText: "Main forceps image",
          isPrimary: true,
          sortOrder: "0",
          url: "https://cdn.example.com/products/forceps/main.jpg"
        }
      ],
      material: "",
      mrp: "300",
      searchTags: "forceps, artery",
      sellingPrice: "240",
      variants: [
        {
          attributesText: "{\n  \"size\": \"6 inch\"\n}",
          mrp: "175",
          name: "6 inch",
          sellingPrice: "140",
          sku: "FORCEPS-001-6IN",
          status: "ACTIVE"
        }
      ]
    });
  });
});
