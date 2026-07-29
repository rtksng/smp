import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "./product-management";
import type { AdminBrand, AdminCategory } from "../../lib/product-form";

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
