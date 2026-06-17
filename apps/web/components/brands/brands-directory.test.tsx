import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Brand, Product, ProductList } from "../../lib/api/schemas";
import { BrandsDirectory } from "./brands-directory";

const brands: Brand[] = [
  {
    description: "Critical care monitors and diagnostics.",
    id: "contec",
    isActive: true,
    logoUrl: "https://cdn.example.com/contec.svg",
    name: "Contec",
    slug: "contec"
  },
  {
    description: "Procedure-ready surgical consumables.",
    id: "healthium",
    isActive: true,
    logoUrl: null,
    name: "Healthium",
    slug: "healthium"
  }
];

const product = {
  basePrice: 1000,
  brand: {
    id: "contec",
    name: "Contec",
    slug: "contec"
  },
  brandId: "contec",
  category: {
    id: "diagnostics",
    name: "Diagnostics",
    slug: "diagnostics"
  },
  categoryId: "diagnostics",
  createdAt: "2026-06-01T00:00:00.000Z",
  description: "Monitor for clinical procurement.",
  disposable: false,
  documents: [],
  expirySensitive: false,
  id: "product",
  images: [],
  inStock: true,
  material: null,
  medicalSpecialty: "Critical Care",
  metaDescription: null,
  metaTitle: null,
  mrp: 1200,
  name: "Contec Patient Monitor",
  packSize: null,
  searchTags: ["monitor"],
  sellingPrice: 950,
  shortDescription: "Compact monitor for hospitals.",
  sku: "CON-MON",
  slug: "contec-patient-monitor",
  status: "ACTIVE",
  sterile: false,
  subcategory: null,
  subcategoryId: null,
  taxRate: 18,
  unit: "piece",
  updatedAt: "2026-06-01T00:00:00.000Z",
  variants: []
} satisfies Product;

const brandProducts: Record<string, ProductList | undefined> = {
  contec: {
    items: [product],
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: 4,
      page: 1,
      total: 1,
      totalPages: 1
    }
  }
};

describe("BrandsDirectory", () => {
  it("searches brands, filters by logo availability, and links to brand products", () => {
    render(<BrandsDirectory brandProducts={brandProducts} brands={brands} />);

    expect(screen.getByRole("heading", { name: "Contec" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Healthium" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Contec products" }))
      .toHaveAttribute("href", "/brands/contec");
    expect(screen.getByRole("heading", { name: "Contec Patient Monitor" }))
      .toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search brands" }), {
      target: {
        value: "health"
      }
    });

    expect(screen.queryByRole("heading", { name: "Contec" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Healthium" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Brand logo filter"), {
      target: {
        value: "with-logo"
      }
    });

    expect(screen.getByText("No brands match the current filters."))
      .toBeInTheDocument();
  });
});
