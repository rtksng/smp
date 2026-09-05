import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "../../lib/api/cart";
import { getRelatedProducts, getSimilarProducts } from "../../lib/api/products";
import type { Product, ProductList } from "../../lib/api/schemas";
import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { ProductDetailPage } from "./product-detail-page";

const routerPush = vi.fn();
const routerBack = vi.fn();
const cartMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(),
  buyNowCartItem: vi.fn()
}));
const wishlistMocks = vi.hoisted(() => ({
  addWishlistItem: vi.fn(),
  getWishlist: vi.fn(),
  removeWishlistItem: vi.fn()
}));
const feedbackMocks = vi.hoisted(() => ({
  createProductQuestion: vi.fn(),
  createProductReview: vi.fn(),
  getProductFeedback: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: routerBack,
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

vi.mock("../../lib/api/wishlist", () => ({
  addWishlistItem: wishlistMocks.addWishlistItem,
  getWishlist: wishlistMocks.getWishlist,
  removeWishlistItem: wishlistMocks.removeWishlistItem
}));

vi.mock("../../lib/api/product-feedback", () => ({
  createProductQuestion: feedbackMocks.createProductQuestion,
  createProductReview: feedbackMocks.createProductReview,
  getProductFeedback: feedbackMocks.getProductFeedback
}));

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

const relatedProductCards: Product[] = [
  relatedProduct,
  ...Array.from({ length: 4 }, (_, index) => ({
    ...relatedProduct,
    id: `related-product-${index + 2}`,
    name: `Related Surgical Clamp ${index + 2}`,
    sku: `REL-CLAMP-${index + 2}`,
    slug: `related-surgical-clamp-${index + 2}`
  }))
];

const similarProduct: Product = {
  ...product,
  id: "similar-product",
  name: "Similar Category Scissor",
  sellingPrice: 4300,
  shortDescription: "Similar scissor with long procurement copy.",
  sku: "SIM-SCISSOR-1",
  slug: "similar-category-scissor"
};

const similarProductCards: Product[] = [
  similarProduct,
  ...Array.from({ length: 4 }, (_, index) => ({
    ...similarProduct,
    id: `similar-product-${index + 2}`,
    name: `Similar Category Scissor ${index + 2}`,
    sku: `SIM-SCISSOR-${index + 2}`,
    slug: `similar-category-scissor-${index + 2}`
  }))
];

const emptyProducts: ProductList = {
  items: [],
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 5,
    page: 1,
    total: 0,
    totalPages: 0
  }
};

const relatedProducts: ProductList = {
  items: relatedProductCards,
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 5,
    page: 1,
    total: 5,
    totalPages: 1
  }
};

const similarProducts: ProductList = {
  items: similarProductCards,
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 5,
    page: 1,
    total: 5,
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
    routerBack.mockClear();
    cartMocks.addCartItem.mockReset();
    cartMocks.buyNowCartItem.mockReset();
    wishlistMocks.addWishlistItem.mockReset();
    feedbackMocks.createProductQuestion.mockReset();
    feedbackMocks.createProductReview.mockReset();
    feedbackMocks.getProductFeedback.mockReset();
    wishlistMocks.getWishlist.mockReset();
    wishlistMocks.removeWishlistItem.mockReset();
    cartMocks.addCartItem.mockResolvedValue(preparedCart);
    cartMocks.buyNowCartItem.mockResolvedValue(preparedCart);
    wishlistMocks.getWishlist.mockResolvedValue(emptyProducts);
    wishlistMocks.addWishlistItem.mockResolvedValue({
      ...emptyProducts,
      items: [product]
    });
    wishlistMocks.removeWishlistItem.mockResolvedValue(emptyProducts);
    feedbackMocks.getProductFeedback.mockResolvedValue({
      questions: [],
      reviews: []
    });
    feedbackMocks.createProductQuestion.mockResolvedValue({ questions: [], reviews: [] });
    feedbackMocks.createProductReview.mockResolvedValue({ questions: [], reviews: [] });
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

  it("removes visual shadows from the product detail page surfaces", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    expect(screen.getByTestId("product-detail-main")).toHaveClass(
      "productDetailNoShadows"
    );
  });

  it("presents feedback as buyer reviews and product questions", async () => {
    feedbackMocks.getProductFeedback.mockResolvedValueOnce({
      questions: [
        {
          answer: null,
          createdAt: "2026-06-15T10:00:00.000Z",
          customerName: "Asha Rao",
          id: "question-1",
          question: "Is this sterile?",
          status: "PENDING"
        }
      ],
      reviews: [
        {
          comment: "Matched the SKU.",
          createdAt: "2026-06-15T10:00:00.000Z",
          customerName: "Asha Rao",
          id: "review-1",
          rating: 5,
          title: "Reliable order"
        }
      ]
    });

    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    expect(await screen.findByText("Reliable order")).toBeInTheDocument();
    expect(screen.getByText("5.0/5")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao · Customer")).toBeInTheDocument();
    expect(screen.getByText("Product question")).toBeInTheDocument();
    expect(
      screen.getByText("Answer:", { exact: false }).parentElement
    ).toHaveTextContent("Awaiting answer from the team.");
    expect(screen.getByText("Write a review")).toBeInTheDocument();
    expect(screen.getByText("Ask a question")).toBeInTheDocument();
  });

  it("shows friendly inline feedback validation and submits trimmed values", async () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));

    expect(
      screen.getByText("Enter at least 5 characters for your review.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enter at least 5 characters for your question.")
    ).toBeInTheDocument();
    expect(feedbackMocks.createProductReview).not.toHaveBeenCalled();
    expect(feedbackMocks.createProductQuestion).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Review comment" }), {
      target: { value: "  Works well in theatre.  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(feedbackMocks.createProductReview).toHaveBeenCalledWith(
        product.slug,
        {
          comment: "Works well in theatre.",
          rating: 5
        }
      )
    );
    expect(
      await screen.findByText("Review submitted for moderation.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Product question" }), {
      target: { value: "  Is assembly included?  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask question" }));

    await waitFor(() =>
      expect(feedbackMocks.createProductQuestion).toHaveBeenCalledWith(
        product.slug,
        { question: "Is assembly included?" }
      )
    );
    expect(
      await screen.findByText("Question submitted for an answer.")
    ).toBeInTheDocument();
  });

  it("uses a tighter mobile product detail typography and spacing hierarchy", () => {
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
    const desktopSummary = screen.getByTestId("desktop-product-summary");
    const summaryHeading = within(desktopSummary).getByRole("heading", {
      level: 2,
      name: "Product summary"
    });
    const summaryBody = within(desktopSummary).getByTestId(
      "desktop-product-summary-body"
    );
    const mobileSummaryBody = screen.getByTestId("mobile-product-summary-full");
    const purchasePrice = screen.getByText("₹9,600");
    const signalTitle = screen.getByText("GST invoice");
    const signalValue = screen.getByText("12% tax rate");
    const signalCard = signalTitle.closest("div");
    const detailPanel = title.closest("section");
    const medicalDetails = screen.getByRole("heading", {
      level: 2,
      name: "Medical details"
    });

    expect(detailPanel?.className).toContain("p-4");
    expect(detailPanel?.className).toContain("sm:p-6");
    expect(title.className).toContain("mt-2");
    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("sm:text-3xl");
    expect(title.className).not.toContain("text-xl");
    expect(title.className).not.toContain("sm:text-4xl");
    expect(shortDescription.className).toContain("mt-3");
    expect(shortDescription.className).toContain("text-[13px]");
    expect(shortDescription.className).toContain("leading-5");
    expect(shortDescription.className).toContain("sm:text-sm");
    expect(shortDescription.className).toContain("sm:leading-6");
    expect(shortDescription.className).not.toContain("text-base");
    expect(summaryHeading.className).toContain("text-base");
    expect(summaryBody?.className).toContain("text-sm");
    expect(summaryBody?.className).toContain("leading-6");
    expect(mobileSummaryBody.className).toContain("text-[13px]");
    expect(mobileSummaryBody.className).toContain("leading-5");
    expect(purchasePrice.className).toContain("text-xl");
    expect(purchasePrice.className).toContain("sm:text-2xl");
    expect(purchasePrice.className).not.toContain("text-3xl");
    expect(signalCard?.className).toContain("p-2.5");
    expect(signalCard?.className).toContain("sm:p-3");
    expect(signalTitle.className).toContain("text-[11px]");
    expect(signalTitle.className).toContain("sm:text-xs");
    expect(signalValue.className).toContain("text-[11px]");
    expect(signalValue.className).toContain("leading-4");
    expect(medicalDetails.className).toContain("text-lg");
  });

  it("shows a back button before product breadcrumbs and returns to the previous page", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    const backButton = screen.getByRole("button", { name: "Back" });
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Product breadcrumbs"
    });

    expect(backButton.compareDocumentPosition(breadcrumbs)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    fireEvent.click(backButton);

    expect(routerBack).toHaveBeenCalledTimes(1);
  });

  it("collapses the product summary into a mobile dropdown preview", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    const mobileSummary = screen.getByTestId("mobile-product-summary");
    const preview = screen.getByTestId("mobile-product-summary-preview");
    const fullSummary = screen.getByTestId("mobile-product-summary-full");

    expect(mobileSummary).not.toHaveAttribute("open");
    expect(within(mobileSummary).getByText("Product summary")).toBeInTheDocument();
    expect(preview).toHaveClass("group-open:hidden");
    expect(preview).toHaveTextContent("Reusable forceps for operating rooms.");
    expect(screen.getByTestId("mobile-product-summary-ellipsis")).toHaveTextContent(
      "..."
    );
    expect(fullSummary).toHaveClass("hidden", "group-open:block");
    expect(fullSummary).toHaveTextContent("Reusable forceps for operating rooms.");

    fireEvent.click(within(mobileSummary).getByText("Product summary"));

    expect(mobileSummary).toHaveAttribute("open");
  });

  it("loads dynamic related and similar products in two-column landing-style cards", async () => {
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

    expect(getRelatedProducts).toHaveBeenCalledWith(product.slug, { limit: 5 });
    expect(getSimilarProducts).toHaveBeenCalledWith(product.slug, { limit: 5 });
    expect(relatedSection).not.toBeNull();
    expect(similarSection).not.toBeNull();
    const relatedCard = within(relatedSection as HTMLElement)
      .getByRole("heading", { name: "Related Surgical Clamp" })
      .closest("article");
    const similarCard = within(similarSection as HTMLElement)
      .getByRole("heading", { name: "Similar Category Scissor" })
      .closest("article");
    const relatedGrid = relatedCard?.parentElement;
    const similarGrid = similarCard?.parentElement;
    const relatedImagePanel = relatedCard?.children[1];

    expect(relatedGrid).toHaveClass(
      "grid-cols-2",
      "gap-3",
      "sm:gap-4",
      "xl:grid-cols-5"
    );
    expect(similarGrid).toHaveClass(
      "grid-cols-2",
      "gap-3",
      "sm:gap-4",
      "xl:grid-cols-5"
    );
    expect(relatedSection?.querySelectorAll("article")).toHaveLength(5);
    expect(similarSection?.querySelectorAll("article")).toHaveLength(5);
    expect(relatedCard).toHaveClass("min-h-[14.3rem]", "rounded-xl");
    expect(similarCard).toHaveClass("min-h-[14.3rem]", "rounded-xl");
    expect(relatedImagePanel).toHaveClass("h-24", "sm:h-36");
    expect(relatedImagePanel).not.toHaveClass("h-28");
  });

  it("prepares a one-product cart before routing buy now checkout", async () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    fireEvent.click(
      within(screen.getByTestId("desktop-purchase-actions")).getByRole("button", {
        name: "Buy now"
      })
    );

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

  it("keeps product purchase actions sticky at the bottom on mobile", () => {
    renderWithQueryClient(
      <ProductDetailPage initialProduct={product} slug={product.slug} />
    );

    const stickyActions = screen.getByTestId("mobile-sticky-product-actions");
    const desktopActions = screen.getByTestId("desktop-purchase-actions");
    const addToCartButton = within(stickyActions).getByRole("button", {
      name: "Add to cart"
    });
    const buyNowButton = within(stickyActions).getByRole("button", {
      name: "Buy now"
    });

    expect(stickyActions).toHaveClass("fixed", "bottom-0", "md:hidden");
    expect(desktopActions).toHaveClass("hidden", "md:grid");
    expect(addToCartButton).toBeEnabled();
    expect(addToCartButton).toHaveClass("bg-white", "!text-[#0f6f68]");
    expect(buyNowButton).toBeEnabled();
    expect(buyNowButton).toHaveClass("bg-[#0f6f68]", "text-white");
  });

  it("moves wishlist to a heart overlay on the product image and shows an auto-hiding toast", async () => {
    vi.useFakeTimers();

    try {
      renderWithQueryClient(
        <ProductDetailPage initialProduct={product} slug={product.slug} />
      );

      expect(
        screen.queryByRole("button", { name: "Save for later" })
      ).not.toBeInTheDocument();

      const heartButton = screen.getByRole("button", { name: "Add to wishlist" });
      const imagePanel = screen.getByTestId("product-main-image-panel");

      expect(imagePanel).toContainElement(heartButton);
      expect(heartButton).toHaveClass("absolute", "bottom-3", "right-3");

      await act(async () => {
        fireEvent.click(heartButton);
      });

      expect(wishlistMocks.addWishlistItem.mock.calls[0]?.[0]).toEqual({
        productId: product.id
      });
      expect(heartButton).toHaveAttribute("aria-pressed", "true");
      expect(heartButton).toHaveClass("text-[#d92d20]");
      expect(screen.getByRole("status")).toHaveTextContent("Added to wishlist");

      act(() => {
        vi.advanceTimersByTime(1800);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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
