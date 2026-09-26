import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "./product-management";
import type { AdminBrand, AdminCategory, AdminProduct } from "../../lib/product-form";

const { requestAdminApiMock } = vi.hoisted(() => ({
  requestAdminApiMock: vi.fn()
}));

vi.mock("../../lib/admin-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/admin-api")>();

  return {
    ...actual,
    requestAdminApi: requestAdminApiMock
  };
});

const brands: AdminBrand[] = [
  {
    id: "brand-1",
    isActive: true,
    logoUrl: null,
    name: "Acme Surgical",
    slug: "acme-surgical"
  }
];

const categories: AdminCategory[] = [
  {
    children: [],
    id: "category-1",
    isActive: true,
    name: "Surgical Instruments",
    parentId: null,
    slug: "surgical-instruments",
    sortOrder: 1
  }
];

const productWithSubcategory: AdminProduct = {
  basePrice: 100,
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
  createdAt: "2026-09-05T00:00:00.000Z",
  description: "A product used to verify edit form initialization.",
  disposable: false,
  documents: [],
  expirySensitive: false,
  id: "product-1",
  images: [],
  inStock: false,
  material: null,
  medicalSpecialty: null,
  metaDescription: null,
  metaTitle: null,
  mrp: 150,
  name: "Operating Chair",
  packSize: null,
  searchTags: [],
  sellingPrice: 120,
  shortDescription: "Operating chair for surgical use.",
  sku: "OPERATING-CHAIR",
  slug: "operating-chair",
  status: "ACTIVE",
  sterile: false,
  subcategory: {
    id: "subcategory-1",
    name: "Operating Chair",
    slug: "operating-chair"
  },
  subcategoryId: "subcategory-1",
  taxRate: 18,
  unit: "piece",
  updatedAt: "2026-09-05T00:00:00.000Z",
  variants: []
};

const categoriesWithSubcategory: AdminCategory[] = [
  {
    children: [
      {
        children: [],
        id: "subcategory-1",
        isActive: true,
        name: "Operating Chair",
        parentId: "category-1",
        slug: "operating-chair",
        sortOrder: 1
      }
    ],
    id: "category-1",
    isActive: true,
    name: "Surgical Instruments",
    parentId: null,
    slug: "surgical-instruments",
    sortOrder: 1
  }
];

describe("ProductForm", () => {
  beforeEach(() => {
    requestAdminApiMock.mockReset();
  });

  it("auto-fills the slug from the product name in create mode", async () => {
    render(
      <ProductForm
        brands={brands}
        canSave
        categories={categories}
        editingProduct={null}
        isLookupLoading={false}
        isSaving={false}
        onSave={vi.fn()}
        onUploadError={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {
        value: "Curved Artery Forceps"
      }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Slug")).toHaveValue("curved-artery-forceps");
    });
  }, 15000);

  it("generates the slug from the product name in create mode", () => {
    render(
      <ProductForm
        brands={brands}
        canSave
        categories={categories}
        editingProduct={null}
        isLookupLoading={false}
        isSaving={false}
        onSave={vi.fn()}
        onUploadError={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {
        value: "Curved Artery Forceps"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByLabelText("Slug")).toHaveValue("curved-artery-forceps");
  }, 15000);

  it("normalizes manual slug edits and keeps them when the name changes", async () => {
    render(
      <ProductForm
        brands={brands}
        canSave
        categories={categories}
        editingProduct={null}
        isLookupLoading={false}
        isSaving={false}
        onSave={vi.fn()}
        onUploadError={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {
        value: "Curved Artery Forceps"
      }
    });
    fireEvent.change(screen.getByLabelText("Slug"), {
      target: {
        value: "Custom Slug 2026"
      }
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: {
        value: "Straight Artery Forceps"
      }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Slug")).toHaveValue("custom-slug-2026");
    });
  }, 15000);

  it("preserves the existing subcategory when an edit form initializes", async () => {
    render(
      <ProductForm
        brands={brands}
        canSave
        categories={categoriesWithSubcategory}
        editingProduct={productWithSubcategory}
        isLookupLoading={false}
        isSaving={false}
        onSave={vi.fn()}
        onUploadError={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Subcategory")).toHaveTextContent("Operating Chair");
    });
  }, 15000);

  it("uploads several images into a thumbnail gallery and manages the main image", async () => {
    requestAdminApiMock.mockResolvedValueOnce({
      key: "catalog/products/images/front.webp",
      mimeType: "image/webp",
      size: 1024,
      url: "https://cdn.example.com/catalog/products/images/front.webp"
    });
    requestAdminApiMock.mockResolvedValueOnce({
      key: "catalog/products/images/side.webp",
      mimeType: "image/webp",
      size: 2048,
      url: "https://cdn.example.com/catalog/products/images/side.webp"
    });

    render(
      <ProductForm
        brands={brands}
        canSave
        categories={categories}
        editingProduct={null}
        isLookupLoading={false}
        isSaving={false}
        onSave={vi.fn()}
        onUploadError={vi.fn()}
      />
    );

    const uploadInput = screen.getByLabelText("Upload product images");
    expect(uploadInput).toHaveAttribute("multiple");

    fireEvent.change(uploadInput, {
      target: {
        files: [
          new File(["front"], "front.webp", { type: "image/webp" }),
          new File(["side"], "side.webp", { type: "image/webp" })
        ]
      }
    });

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "front" })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "side" })).toBeInTheDocument();
    });

    const frontCard = screen.getByRole("img", { name: "front" }).closest("article");
    const sideCard = screen.getByRole("img", { name: "side" }).closest("article");

    expect(frontCard).not.toBeNull();
    expect(sideCard).not.toBeNull();
    expect(within(frontCard!).getByText("Main image")).toBeInTheDocument();
    expect(screen.getAllByText("Main image")).toHaveLength(1);
    expect(screen.getByLabelText("Image URL 1")).toHaveValue(
      "https://cdn.example.com/catalog/products/images/front.webp"
    );
    expect(screen.getByLabelText("Image URL 2")).toHaveValue(
      "https://cdn.example.com/catalog/products/images/side.webp"
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand front" }));

    await waitFor(() => {
      expect(screen.getByText("Large product image preview.")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "front" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByText("Large product image preview.")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Set side as main image" }));

    await waitFor(() => {
      expect(within(sideCard!).getByText("Main image")).toBeInTheDocument();
      expect(within(frontCard!).queryByText("Main image")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove side" }));

    await waitFor(() => {
      expect(screen.queryByRole("img", { name: "side" })).not.toBeInTheDocument();
      const remainingFrontCard = screen
        .getByRole("img", { name: "front" })
        .closest("article");
      expect(remainingFrontCard).not.toBeNull();
      expect(within(remainingFrontCard!).getByText("Main image")).toBeInTheDocument();
    });
    expect(requestAdminApiMock).toHaveBeenCalledTimes(2);
  }, 15000);
});
