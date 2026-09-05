import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "./product-management";
import type {
  AdminBrand,
  AdminCategory,
  AdminProduct
} from "../../lib/product-form";

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
      expect(screen.getByLabelText("Subcategory")).toHaveTextContent(
        "Operating Chair"
      );
    });
  }, 15000);

  it("shows an uploaded image URL in the image URL field immediately", async () => {
    requestAdminApiMock.mockResolvedValueOnce({
      key: "catalog/products/images/test-product.webp",
      mimeType: "image/webp",
      size: 1024,
      url: "https://cdn.example.com/catalog/products/images/test-product.webp"
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

    fireEvent.click(screen.getByRole("button", { name: "Add image" }));
    fireEvent.change(screen.getByLabelText("Upload"), {
      target: {
        files: [new File(["image"], "test-product.webp", { type: "image/webp" })]
      }
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Image URL")).toHaveValue(
        "https://cdn.example.com/catalog/products/images/test-product.webp"
      );
    });
  }, 15000);
});
