import { describe, expect, it } from "vitest";
import {
  brandFormSchema,
  brandToFormValues,
  buildBrandPayload,
  buildCategoryPayload,
  categoryFormSchema,
  categoryToFormValues,
  createEmptyBrandFormValues,
  createEmptyCategoryFormValues,
  flattenCategoryOptions,
  slugifyCatalogName,
  type AdminBrand,
  type AdminCategory
} from "./catalog-management";

const category: AdminCategory = {
  children: [
    {
      children: [],
      description: null,
      id: "category-child",
      imageUrl: null,
      isActive: true,
      name: "Forceps",
      parentId: "category-root",
      slug: "forceps",
      sortOrder: 2
    }
  ],
  description: "Reusable surgical instruments.",
  id: "category-root",
  imageUrl: "https://cdn.example.com/categories/instruments.png",
  isActive: true,
  name: "Surgical Instruments",
  parentId: null,
  slug: "surgical-instruments",
  sortOrder: 1
};

const brand: AdminBrand = {
  description: "Trusted supplier.",
  id: "brand-1",
  isActive: true,
  logoUrl: "https://cdn.example.com/brands/acme.png",
  name: "Acme Surgical",
  slug: "acme-surgical"
};

describe("catalog management helpers", () => {
  it("normalizes category forms into admin category payloads", () => {
    const parsed = categoryFormSchema.parse({
      ...createEmptyCategoryFormValues(),
      description: "Reusable surgical instruments.",
      imageUrl: "https://cdn.example.com/categories/instruments.png",
      isActive: true,
      name: " Surgical Instruments ",
      parentId: "category-parent",
      slug: "surgical-instruments",
      sortOrder: "10"
    });

    expect(buildCategoryPayload(parsed)).toEqual({
      description: "Reusable surgical instruments.",
      imageUrl: "https://cdn.example.com/categories/instruments.png",
      isActive: true,
      name: "Surgical Instruments",
      parentId: "category-parent",
      slug: "surgical-instruments",
      sortOrder: 10
    });
  });

  it("normalizes brand forms into admin brand payloads", () => {
    const parsed = brandFormSchema.parse({
      ...createEmptyBrandFormValues(),
      description: "",
      isActive: false,
      logoUrl: "",
      name: " Acme Surgical ",
      slug: "acme-surgical"
    });

    expect(buildBrandPayload(parsed)).toEqual({
      description: null,
      isActive: false,
      logoUrl: null,
      name: "Acme Surgical",
      slug: "acme-surgical"
    });
  });

  it("hydrates edit forms and flattens nested categories", () => {
    expect(categoryToFormValues(category)).toMatchObject({
      description: "Reusable surgical instruments.",
      imageUrl: "https://cdn.example.com/categories/instruments.png",
      name: "Surgical Instruments",
      parentId: "",
      slug: "surgical-instruments",
      sortOrder: "1"
    });
    expect(brandToFormValues(brand)).toMatchObject({
      description: "Trusted supplier.",
      logoUrl: "https://cdn.example.com/brands/acme.png",
      name: "Acme Surgical",
      slug: "acme-surgical"
    });
    expect(flattenCategoryOptions([category]).map((item) => item.depth)).toEqual([
      0,
      1
    ]);
  });

  it("generates URL slugs compatible with backend catalog DTOs", () => {
    expect(slugifyCatalogName("  Surgical Forceps & Clamps  ")).toBe(
      "surgical-forceps-clamps"
    );
  });
});
