import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../../lib/api/schemas";
import { AccountWishlist } from "./account-wishlist";

const mocks = vi.hoisted(() => ({
  getWishlist: vi.fn(),
  logout: vi.fn(),
  promptLogin: vi.fn(),
  removeWishlistItem: vi.fn(),
  replace: vi.fn(),
  setCartSummary: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace
  })
}));

vi.mock("../auth/protected-customer-route", () => ({
  ProtectedCustomerRoute: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  )
}));

vi.mock("../layout/header", () => ({
  Header: () => <header data-testid="header" />
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer data-testid="footer" />
}));

vi.mock("../../lib/stores/auth-store", () => ({
  useCustomerAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      logout: mocks.logout,
      promptLogin: mocks.promptLogin,
      session: {
        customer: {
          firstName: "Asha",
          mobileNumber: "+919800000001"
        }
      }
    })
}));

vi.mock("../../lib/stores/cart-store", () => ({
  useCartStore: (selector: (state: unknown) => unknown) =>
    selector({
      setSummary: mocks.setCartSummary
    })
}));

vi.mock("../../lib/api/wishlist", () => ({
  getWishlist: mocks.getWishlist,
  removeWishlistItem: mocks.removeWishlistItem
}));

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

describe("AccountWishlist", () => {
  beforeEach(() => {
    mocks.getWishlist.mockReset();
    mocks.logout.mockReset();
    mocks.promptLogin.mockReset();
    mocks.removeWishlistItem.mockReset();
    mocks.replace.mockReset();
    mocks.setCartSummary.mockReset();
    mocks.getWishlist.mockResolvedValue({
      items: [product],
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 20,
        page: 1,
        total: 1,
        totalPages: 1
      }
    });
  });

  it("hides service badges from wishlist product cards", async () => {
    renderAccountWishlist();

    expect(
      await screen.findByRole("heading", { name: "SurgiPro Artery Forceps" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByText(product.shortDescription)).not.toBeInTheDocument();
    expect(screen.queryByText("GST invoice ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Delivery at checkout")).not.toBeInTheDocument();
  });
});

function renderAccountWishlist() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountWishlist />
    </QueryClientProvider>
  );
}
