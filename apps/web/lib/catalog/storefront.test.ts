import { describe, expect, it } from "vitest";
import type { Brand, Category, ProductList } from "../api/schemas";
import {
  filterBrandsForDirectory,
  getFeaturedCategoryProductLimit,
  getFeaturedCategorySectionLimit,
  getLandingCategoryLimit,
  getLandingProductLimit,
  selectFeaturedCategorySections,
  selectLandingCategories,
  selectProductReadyFeaturedCategories,
  selectPreviewBrands
} from "./storefront";

function category(index: number, isActive = true): Category {
  return {
    children: [],
    description: null,
    id: `category-${index}`,
    imageUrl: null,
    isActive,
    name: `Category ${index}`,
    parentId: null,
    slug: `category-${index}`,
    sortOrder: index
  };
}

const brands: Brand[] = [
  {
    description: "Critical care monitors",
    id: "contec",
    isActive: true,
    logoUrl: "https://cdn.example.com/contec.svg",
    name: "Contec",
    slug: "contec"
  },
  {
    description: "Surgical consumables",
    id: "healthium",
    isActive: true,
    logoUrl: null,
    name: "Healthium",
    slug: "healthium"
  },
  {
    description: "Inactive supplier",
    id: "inactive",
    isActive: false,
    logoUrl: null,
    name: "Dormant Brand",
    slug: "dormant"
  }
];

describe("storefront catalog helpers", () => {
  it("selects eight active landing categories for the twelve-column catalog grid", () => {
    const selected = selectLandingCategories([
      category(1),
      category(2, false),
      ...Array.from({ length: 12 }, (_, index) => category(index + 3))
    ]);

    expect(getLandingCategoryLimit()).toBe(8);
    expect(selected).toHaveLength(8);
    expect(selected.every((item) => item.href.startsWith("/categories/"))).toBe(true);
    expect(selected.map((item) => item.label)).not.toContain("Category 2");
  });

  it("uses four latest products and five products per featured category section", () => {
    expect(getLandingProductLimit()).toBe(4);
    expect(getFeaturedCategoryProductLimit()).toBe(5);
  });

  it("limits featured product sections to five main categories", () => {
    const selected = selectFeaturedCategorySections(
      Array.from({ length: 10 }, (_, index) => category(index + 1))
    );

    expect(getFeaturedCategorySectionLimit()).toBe(5);
    expect(selected).toHaveLength(5);
    expect(selected.map((item) => item.slug)).toEqual([
      "category-1",
      "category-2",
      "category-3",
      "category-4",
      "category-5"
    ]);
  });

  it("keeps featured category sections product-ready", () => {
    const selected = selectLandingCategories(
      Array.from({ length: 7 }, (_, index) => category(index + 1))
    );
    const productsByCategorySlug = Object.fromEntries(
      selected.map((item, index) => [
        item.slug,
        productList(index === 4 ? 1 : 5)
      ])
    );

    expect(
      selectProductReadyFeaturedCategories(selected, productsByCategorySlug).map(
        (item) => item.slug
      )
    ).toEqual([
      "category-1",
      "category-2",
      "category-3",
      "category-4",
      "category-6"
    ]);
  });

  it("expands the home brand preview and filters the brand directory", () => {
    expect(selectPreviewBrands(brands).map((brand) => brand.slug)).toEqual([
      "contec",
      "healthium"
    ]);

    expect(
      filterBrandsForDirectory(brands, {
        logo: "with-logo",
        query: "monitor"
      }).map((brand) => brand.slug)
    ).toEqual(["contec"]);

    expect(
      filterBrandsForDirectory(brands, {
        logo: "without-logo",
        query: "health"
      }).map((brand) => brand.slug)
    ).toEqual(["healthium"]);
  });
});

function productList(count: number) {
  return {
    items: Array.from({ length: count }, (_, index) => ({
      id: `product-${index}`
    })),
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: 4,
      page: 1,
      total: count,
      totalPages: 1
    }
  } as ProductList;
}
