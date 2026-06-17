import { describe, expect, it } from "vitest";
import type { Category } from "../api/schemas";
import {
  buildMarketplaceNavItems,
  buildCategoryNavigation,
  getFeaturedCategoryLinks
} from "./customer-navigation";

const categories: Category[] = [
  {
    children: [
      category({
        id: "dental-endo",
        name: "Endodontic Products",
        parentId: "dental",
        slug: "endodontic-products",
        sortOrder: 2
      }),
      category({
        id: "dental-instruments",
        name: "Dental Instruments",
        parentId: "dental",
        slug: "dental-instruments",
        sortOrder: 1
      })
    ],
    description: "Dental equipment and consumables",
    id: "dental",
    imageUrl: null,
    isActive: true,
    name: "Dental",
    parentId: null,
    slug: "dental",
    sortOrder: 3
  },
  category({
    id: "diagnostics",
    name: "Diagnostics",
    slug: "diagnostics",
    sortOrder: 1
  }),
  category({
    id: "hidden",
    isActive: false,
    name: "Hidden category",
    slug: "hidden-category",
    sortOrder: 2
  })
];

describe("customer navigation helpers", () => {
  it("builds sorted active category navigation with subcategory links", () => {
    const navigation = buildCategoryNavigation(categories);

    expect(navigation).toEqual([
      {
        children: [],
        description: null,
        href: "/categories/diagnostics",
        id: "diagnostics",
        imageUrl: null,
        label: "Diagnostics",
        slug: "diagnostics"
      },
      {
        children: [
            {
              href: "/categories/dental/dental-instruments",
              id: "dental-instruments",
              label: "Dental Instruments",
              slug: "dental-instruments"
            },
            {
              href: "/categories/dental/endodontic-products",
              id: "dental-endo",
              label: "Endodontic Products",
              slug: "endodontic-products"
          }
        ],
        description: "Dental equipment and consumables",
        href: "/categories/dental",
        id: "dental",
        imageUrl: null,
        label: "Dental",
        slug: "dental"
      }
    ]);
  });

  it("limits featured category links without dropping route data", () => {
    const featured = getFeaturedCategoryLinks(categories, 1);

    expect(featured).toEqual([
      {
        href: "/categories/diagnostics",
        id: "diagnostics",
        label: "Diagnostics",
        slug: "diagnostics"
      }
    ]);
  });

  it("builds marketplace navbar items from category data and route entries", () => {
    const items = buildMarketplaceNavItems(categories, 1);

    expect(items.map((item) => item.label)).toEqual([
      "All products",
      "Diagnostics",
      "Brands",
      "Bulk quotes"
    ]);
    expect(items[1]).toMatchObject({
      href: "/categories/diagnostics",
      source: "category"
    });
  });
});

function category(
  overrides: Partial<Category> & Pick<Category, "id" | "name" | "slug">
): Category {
  return {
    children: [],
    description: null,
    imageUrl: null,
    isActive: true,
    parentId: null,
    sortOrder: 0,
    ...overrides
  };
}
