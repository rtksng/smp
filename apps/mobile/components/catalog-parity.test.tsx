// @vitest-environment jsdom
import { cloneElement, type PropsWithChildren, type ReactElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductListingScreen } from "../app/(tabs)/search";
import ProductDetailScreen from "../app/products/[slug]";
import { ProductCard } from "./product-card";
import { CatalogFilterSheet, defaultCatalogFilters } from "./catalog-filter-sheet";
import type { Product } from "../lib/api/schemas";
import { cartFixture } from "../lib/testing/commerce-fixtures";

const mocks = vi.hoisted(() => ({
  params: {} as Record<string, string>, push: vi.fn(), products: vi.fn(), product: vi.fn(),
  addCart: vi.fn(), buyNow: vi.fn(), review: vi.fn(), question: vi.fn(), wishlist: vi.fn()
}));
vi.mock("expo-router", () => ({
  router: { push: mocks.push, back: vi.fn() },
  usePathname: () => "/search",
  useLocalSearchParams: () => mocks.params,
  Link: ({ children, href }: PropsWithChildren<{ href: unknown }>) =>
    cloneElement(children as ReactElement<Record<string, unknown>>, {
      accessibilityRole: "link",
      onPress: () => mocks.push(href)
    })
}));
vi.mock("expo-haptics", () => ({ selectionAsync: vi.fn() }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null, Feather: () => null }));
vi.mock("expo-image", () => ({ Image: ({ accessibilityLabel, contentFit, onError }: { accessibilityLabel: string; contentFit: string; onError?: () => void }) => <img alt={accessibilityLabel} data-fit={contentFit} onError={onError} /> }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
vi.mock("react-native-keyboard-controller", () => ({ KeyboardAwareScrollView: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ session: { customer: { id: "customer-1" } } }) }));
vi.mock("@/lib/api/catalog", () => ({
  getProducts: mocks.products, getProduct: mocks.product, getBrands: async () => [{ id: "brand-1", slug: "clinic", name: "Clinic", isActive: true, logoUrl: null, description: null }],
  getCategories: async () => [{ id: "category-1", name: "Kits", slug: "kits", isActive: true, sortOrder: 0, children: [], imageUrl: null, parentId: null, description: null }],
  getRelatedProducts: async () => ({ items: [] }), getSimilarProducts: async () => ({ items: [] })
}));
vi.mock("@/lib/api/cart", () => ({ addCartItem: mocks.addCart, buyNow: mocks.buyNow }));
vi.mock("@/lib/api/product-feedback", () => ({ getProductFeedback: async () => ({ questions: [], reviews: [] }), createProductReview: mocks.review, createProductQuestion: mocks.question }));
vi.mock("@/lib/api/wishlist", () => ({ getWishlist: async () => ({ items: [] }), addWishlistItem: mocks.wishlist, removeWishlistItem: vi.fn() }));

const product: Product = {
  id: "product-1", slug: "sterile-kit", name: "Sterile kit", sku: "KIT-001", brandId: "brand-1", categoryId: "category-1", subcategoryId: null,
  brand: { id: "brand-1", name: "Clinic", slug: "clinic" }, category: { id: "category-1", name: "Kits", slug: "kits" }, subcategory: null,
  basePrice: 500, sellingPrice: 500, mrp: 600, inStock: true, sterile: true, disposable: false, expirySensitive: false, material: null, medicalSpecialty: null,
  packSize: null, unit: "kit", status: "ACTIVE", description: "Sterile equipment for clinical use.", shortDescription: "Sterile equipment", documents: [], variants: [],
  metaDescription: null, metaTitle: null, searchTags: [], taxRate: 18, createdAt: "2026-09-01", updatedAt: "2026-09-01",
  images: [{ id: "image-1", url: "https://catalog.example/kit.png", altText: "Sterile kit photo", isPrimary: true, sortOrder: 0 }]
};
const clients: QueryClient[] = [];
function renderCatalog(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = {};
  mocks.products.mockImplementation(async ({ page = 1 }: { page?: number }) => ({ items: [{ ...product, id: `product-${page}` }], pagination: { page, limit: 12, total: 13, totalPages: 2, hasNextPage: page === 1, hasPreviousPage: page > 1 } }));
  mocks.product.mockResolvedValue(product);
  mocks.addCart.mockResolvedValue(cartFixture());
  mocks.review.mockResolvedValue({ questions: [], reviews: [] });
  mocks.question.mockResolvedValue({ questions: [], reviews: [] });
  mocks.wishlist.mockResolvedValue({ items: [product] });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe("mobile catalog parity", () => {
  it("uses filled product media and handles a failed image", () => {
    renderCatalog(<ProductCard compact product={product} />);
    const image = screen.getByAltText("Sterile kit photo");
    expect(image.getAttribute("data-fit")).toBe("cover");
    fireEvent.error(image);
    expect(screen.queryByAltText("Sterile kit photo")).toBeNull();
    expect(screen.getByText("Sterile kit")).toBeTruthy();
  });

  it("opens home rail details through View without adding a cart item", () => {
    renderCatalog(<ProductCard compact product={product} variant="rail" />);
    fireEvent.click(screen.getByText("View"));
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/products/[slug]", params: { slug: "sterile-kit" } });
    expect(screen.queryByRole("button", { name: "Add Sterile kit to cart" })).toBeNull();
    expect(mocks.addCart).not.toHaveBeenCalled();
  });

  it("loads later product pages and resets the page after changing category", async () => {
    renderCatalog(<ProductListingScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 2")).toBeTruthy();
    expect(mocks.products).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 12 }));
    fireEvent.click(screen.getByRole("button", { name: "Kits" }));
    await waitFor(() => expect(mocks.products).toHaveBeenLastCalledWith(expect.objectContaining({ category: "kits", page: 1 })));
  });

  it("honors subcategory links and keeps brand pages scoped to their brand", async () => {
    mocks.params = { category: "kits", subcategory: "sterile", brand: "other-brand" };
    renderCatalog(<ProductListingScreen brand="clinic" />);
    await waitFor(() => expect(mocks.products).toHaveBeenCalledWith(expect.objectContaining({ brand: "clinic", category: "kits", subcategory: "sterile" })));
  });

  it("preserves a locked brand when clearing the filter sheet", () => {
    const apply = vi.fn();
    renderCatalog(<CatalogFilterSheet brands={[]} categories={[]} filters={{ ...defaultCatalogFilters, brand: "clinic", search: "kit" }} lockedBrand="clinic" onApply={apply} onClose={vi.fn()} visible />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(apply).toHaveBeenCalledWith({ ...defaultCatalogFilters, brand: "clinic" });
    expect(screen.queryByRole("button", { name: /Brand:/ })).toBeNull();
  });

  it("validates feedback lengths and trims a review before submission", async () => {
    mocks.params = { slug: "sterile-kit" };
    renderCatalog(<ProductDetailScreen />);
    const submit = await screen.findByRole("button", { name: "Submit review" });
    fireEvent.click(submit);
    expect(screen.getByText("Enter at least 5 characters for your review.")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Review comment" }), { target: { value: "x".repeat(1201) } });
    fireEvent.click(submit);
    expect(screen.getByText("Keep your review to 1,200 characters or fewer.")).toBeTruthy();
    expect(mocks.review).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Review comment" }), { target: { value: "  Useful sterile kit  " } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.review).toHaveBeenCalledWith("sterile-kit", { comment: "Useful sterile kit", rating: 5 }));
    expect(await screen.findByText("Review submitted for moderation.")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Product question" }), { target: { value: "x".repeat(801) } });
    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));
    expect(screen.getByText("Keep your question to 800 characters or fewer.")).toBeTruthy();
    expect(mocks.question).not.toHaveBeenCalled();
  });

  it("shows wishlist failures and prevents opposing cart actions during submission", async () => {
    mocks.params = { slug: "sterile-kit" };
    mocks.wishlist.mockRejectedValue(new Error("Wishlist temporarily unavailable"));
    let resolveCart!: (cart: ReturnType<typeof cartFixture>) => void;
    mocks.addCart.mockReturnValue(new Promise((resolve) => { resolveCart = resolve; }));
    renderCatalog(<ProductDetailScreen />);
    fireEvent.click(await screen.findByLabelText("Add to wishlist"));
    expect(await screen.findByText("Wishlist temporarily unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Buy now" }).getAttribute("aria-disabled")).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(mocks.buyNow).not.toHaveBeenCalled();
    await act(async () => resolveCart(cartFixture()));
    expect(await screen.findByText("Added to cart.")).toBeTruthy();
  });
});
