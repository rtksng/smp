import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import { getRelatedProducts, getSimilarProducts } from "../../lib/api/products";
import type { Product, ProductList } from "../../lib/api/schemas";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { ProductDetailPage } from "./product-detail-page";

const routerPush = vi.fn();
const cartMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(),
  buyNowCartItem: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

vi.mock("../../lib/api/products", () => ({
  getProduct: vi.fn(async () => product),
  getProducts: vi.fn(async () => emptyProducts),
  getRelatedProducts: vi.fn(async () => relatedProducts),
  getSimilarProducts: vi.fn(async () => similarProducts)
}));

vi.mock("../../lib/api/cart", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api/cart")>(
    "../../lib/api/cart"
  );

  return {
    ...actual,
    addCartItem: cartMocks.addCartItem,
    buyNowCartItem: cartMocks.buyNowCartItem
  };
});

vi.mock("../layout/header", () => ({
  Header: () => <header>Header</header>
}));

vi.mock("../layout/footer", () => ({
  Footer: () => <footer>Footer</footer>
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
  description: "<p>Reusable forceps for operating rooms.</p>",
  disposable: false,
  documents: [],
  expirySensitive: false,
  id: "product-1",
  images: [
    {
      altText: "Forceps pack",
      id: "image-1",
      isPrimary: true,
      sortOrder: 0,
      url: "http://localhost:4000/forceps.png"
    }
  ],
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
  variants: [
    {
      attributes: {
        size: "6 inch"
      },
      id: "variant-1",
      mrp: 12500,
      name: "6 inch",
      sellingPrice: 9800,
      sku: "SP-FOR-10-6",
      status: "ACTIVE"
    }
  ]
};

const relatedProduct: Product = {
  ...product,
  id: "related-product",
  name: "Related Surgical Clamp",
  sellingPrice: 5200,
  shortDescription: "Related clamp with long procurement copy.",
  sku: "REL-CLAMP-1",
  slug: "related-surgical-clamp"
};

const similarProduct: Product = {
  ...product,
  id: "similar-product",
  name: "Similar Category Scissor",
  sellingPrice: 4300,
  shortDescription: "Similar scissor with long procurement copy.",
  sku: "SIM-SCISSOR-1",
  slug: "similar-category-scissor"
};

const emptyProducts: ProductList = {
  items: [],
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 4,
    page: 1,
    total: 0,
    totalPages: 0
  }
};

const relatedProducts: ProductList = {
  items: [relatedProduct],
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 4,
    page: 1,
    total: 1,
    totalPages: 1
  }
};

const similarProducts: ProductList = {
  items: [similarProduct],
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 4,
    page: 1,
    total: 1,
    totalPages: 1
  }
};

const preparedCart: Cart = {
  id: "cart-1",
  itemCount: 1,
  items: [
    {
      availableQuantity: 8,
      brand: product.brand,
      category: product.category,
      createdAt: "2026-06-01T00:00:00.000Z",
      id: "cart-item-1",
      imageUrl: "http://localhost:4000/forceps.png",
      isAvailable: true,
      name: product.name,
      productId: product.id,
      productStatus: "ACTIVE",
      quantity: 1,
      sku: product.sku,
      slug: product.slug,
      subcategory: product.subcategory,
      subtotal: product.sellingPrice,
      tax: 1152,
      taxRate: product.taxRate,
      total: 10752,
      unitPrice: product.sellingPrice,
      updatedAt: "2026-06-01T00:00:00.000Z",
      variantId: null,
      variantName: null,
      variantStatus: null
    }
  ],
  totalQuantity: 1,
  totals: {
    deliveryCharge: 0,
    discount: 0,
    grandTotal: 10752,
    subtotal: product.sellingPrice,
    tax: 1152
  },
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("ProductDetailPage", () => {
  beforeEach(() => {
    routerPush.mockClear();
    cartMocks.addCartItem.mockReset();
    cartMocks.buyNowCartItem.mockReset();
    cartMocks.addCartItem.mockResolvedValue(preparedCart);
    cartMocks.buyNowCartItem.mockResolvedValue(preparedCart);
    vi.mocked(getRelatedProducts).mockClear();
    vi.mocked(getSimilarProducts).mockClear();
    useCustomerAuthStore.setState({
      isHydrated: true,
      isLoginOpen: false,
      loginRedirectTo: null,
      pendingMobileNumber: null,
      session: {
        customer: {
          email: null,
          firstName: "Asha",
          id: "customer-1",
          lastName: "Rao",
          mobileNumber: "+919876543210"
        },
        tokens: {
          accessToken: "access-token",
          accessTokenExpiresAt: "2026-06-01T01:00:00.000Z",
          accessTokenExpiresInSeconds: 3600,
          refreshToken: "refresh-token",
          refreshTokenExpiresAt: "2026-06-08T00:00:00.000Z",
          refreshTokenExpiresInSeconds: 604800,
          tokenType: "Bearer"
        }
      }
    });
  });

  it("keeps the media area normal while making variant cards compact", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    const mediaSection = screen
      .getByLabelText("Product image thumbnails")
      .closest("section");
    const variantCard = screen.getByText("6 inch").closest("article");

    expect(mediaSection?.className).not.toContain("sticky");
    expect(variantCard?.className).toContain("p-3");
    expect(variantCard?.className).not.toContain("p-4");
  });

  it("uses a compact product detail typography hierarchy", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    const title = screen.getByRole("heading", {
      level: 1,
      name: "SurgiPro Artery Forceps"
    });
    const shortDescription = screen.getByText(
      "Precision forceps for hospital and clinic purchase lists."
    );
    const summaryHeading = screen.getByRole("heading", {
      level: 2,
      name: "Product summary"
    });
    const summaryBody = screen
      .getByText("Reusable forceps for operating rooms.")
      .closest(".productDescriptionRichText");
    const purchasePrice = screen.getByText("₹9,600");
    const signalTitle = screen.getByText("GST invoice");
    const signalValue = screen.getByText("12% tax rate");
    const medicalDetails = screen.getByRole("heading", {
      level: 2,
      name: "Medical details"
    });

    expect(title.className).toContain("text-xl");
    expect(title.className).toContain("sm:text-3xl");
    expect(title.className).not.toContain("sm:text-4xl");
    expect(shortDescription.className).toContain("text-sm");
    expect(shortDescription.className).not.toContain("text-base");
    expect(summaryHeading.className).toContain("text-base");
    expect(summaryBody?.className).toContain("text-sm");
    expect(summaryBody?.className).toContain("leading-6");
    expect(purchasePrice.className).toContain("text-2xl");
    expect(purchasePrice.className).not.toContain("text-3xl");
    expect(signalTitle.className).toContain("text-xs");
    expect(signalValue.className).toContain("text-xs");
    expect(medicalDetails.className).toContain("text-lg");
  });

  it("loads dynamic related and similar products with compact recommendation cards", async () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    expect(await screen.findByText("Related Surgical Clamp")).toBeInTheDocument();
    expect(await screen.findByText("Similar Category Scissor")).toBeInTheDocument();
    const relatedSection = screen
      .getByRole("heading", { name: "Related products" })
      .closest("section");
    const similarSection = screen
      .getByRole("heading", { name: "Similar category products" })
      .closest("section");

    expect(getRelatedProducts).toHaveBeenCalledWith(product.slug, { limit: 4 });
    expect(getSimilarProducts).toHaveBeenCalledWith(product.slug, { limit: 4 });
    expect(relatedSection).not.toBeNull();
    expect(similarSection).not.toBeNull();
    expect(within(relatedSection as HTMLElement).queryByText("Hospital price"))
      .not.toBeInTheDocument();
    expect(within(relatedSection as HTMLElement).queryByText("GST invoice ready"))
      .not.toBeInTheDocument();
    expect(within(relatedSection as HTMLElement).queryByText("12% GST"))
      .not.toBeInTheDocument();
    expect(within(relatedSection as HTMLElement).queryByText("Add to cart"))
      .not.toBeInTheDocument();
    expect(within(similarSection as HTMLElement).queryByText("Hospital price"))
      .not.toBeInTheDocument();
    expect(within(similarSection as HTMLElement).queryByText("Add to cart"))
      .not.toBeInTheDocument();
    expect(within(similarSection as HTMLElement).getByRole("link", { name: "View" }))
      .toBeInTheDocument();
  });

  it("prepares a one-product cart before routing buy now checkout", async () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));

    await waitFor(() => {
      expect(cartMocks.buyNowCartItem).toHaveBeenCalled();
    });
    expect(cartMocks.buyNowCartItem.mock.calls[0]?.[0]).toEqual({
      productId: product.id,
      quantity: 1,
      variantId: null
    });
    expect(cartMocks.addCartItem).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/checkout");
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
