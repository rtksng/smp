import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { Product } from "../../lib/api/schemas";
import { ProductCard } from "./product-card";

const product: Product = {
  basePrice: 8800,
  brand: {
    id: "brand-1",
    name: "SurgiPro",
    slug: "surgipro"
  },
  brandId: "brand-1",
  category: {
    id: "category-1",
    name: "Surgical Instruments",
    slug: "surgical-instruments"
  },
  categoryId: "category-1",
  createdAt: "2026-05-26T00:00:00.000Z",
  description: "Reusable forceps for operating-room procurement.",
  disposable: false,
  documents: [],
  expirySensitive: false,
  id: "product-1",
  images: [],
  inStock: true,
  material: "Stainless steel",
  medicalSpecialty: "General Surgery",
  metaDescription: null,
  metaTitle: null,
  mrp: 12000,
  name: "SurgiPro Artery Forceps",
  packSize: "Box of 10",
  searchTags: ["forceps"],
  sellingPrice: 9600,
  shortDescription: "Precision forceps for hospital and clinic purchase lists.",
  sku: "SP-FOR-10",
  slug: "surgipro-artery-forceps",
  status: "ACTIVE",
  sterile: true,
  subcategory: {
    id: "subcategory-1",
    name: "Endodontics",
    slug: "endodontics"
  },
  subcategoryId: "subcategory-1",
  taxRate: 12,
  unit: "box",
  updatedAt: "2026-05-26T00:00:00.000Z",
  variants: []
};

describe("ProductCard", () => {
  it("surfaces procurement pricing, savings, GST, SKU, and full add-to-cart action", () => {
    renderWithQueryClient(<ProductCard product={product} />);

    expect(screen.getByText("Hospital price")).toBeInTheDocument();
    expect(screen.getByText("Save ₹2,400")).toBeInTheDocument();
    expect(screen.getByText("SKU SP-FOR-10")).toBeInTheDocument();
    expect(screen.getByText("GST invoice ready")).toBeInTheDocument();
    expect(screen.getByText("12% GST")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add SurgiPro Artery Forceps to cart/i }))
      .toHaveTextContent("Add to cart");
  });

  it("replaces failed product images with the equipment fallback", () => {
    renderWithQueryClient(
      <ProductCard
        product={{
          ...product,
          images: [
            {
              altText: "Forceps pack",
              id: "image-1",
              isPrimary: true,
              sortOrder: 0,
              url: "http://localhost:4000/missing.png"
            }
          ]
        }}
      />
    );

    fireEvent.error(screen.getByAltText("Forceps pack"));

    expect(screen.getByText("Product image unavailable")).toBeInTheDocument();
  });

  it("matches the landing-page mobile card spacing when compact", () => {
    renderWithQueryClient(<ProductCard compact product={product} />);

    const title = screen.getByRole("heading", {
      name: "SurgiPro Artery Forceps"
    });
    const article = title.closest("article");
    const imagePanel = article?.firstElementChild;
    const contentPanel = article?.children[1];

    expect(article).toHaveClass("min-h-[14.3rem]", "min-w-0", "rounded-xl");
    expect(imagePanel).toHaveClass("h-24", "sm:h-36");
    expect(contentPanel).toHaveClass("gap-1", "p-3", "sm:gap-3", "sm:p-4");
    expect(screen.getByRole("link", { name: "SurgiPro" })).toHaveClass(
      "text-[#556b57]"
    );
    expect(title).toHaveClass(
      "min-h-9",
      "break-words",
      "text-xs",
      "font-semibold",
      "leading-[1.15rem]"
    );
    expect(title).not.toHaveClass("mt-2");
    expect(screen.getByText(/9,600/)).toHaveClass(
      "text-base",
      "font-black",
      "leading-5",
      "text-[#111827]"
    );
    expect(screen.getByText(/MRP/)).toHaveClass(
      "text-[11px]",
      "font-semibold",
      "text-[#556b57]"
    );
  });
});

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
