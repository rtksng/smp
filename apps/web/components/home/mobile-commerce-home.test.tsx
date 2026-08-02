import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Brand, Category, Product, ProductList } from "../../lib/api/schemas";
import { buildCategoryNavigation } from "../../lib/catalog/customer-navigation";
import { MobileCommerceHome } from "./mobile-commerce-home";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

const categories: Category[] = [
  category("consumables", "Consumables", "Daily-use supplies"),
  category("equipment", "Equipment", "Hospital equipment"),
  category("diagnostics", "Diagnostics", "Diagnostic devices")
];

const brands: Brand[] = [
  brand("abbott", "Abbott"),
  brand("contec", "Contec"),
  brand("healthium", "Healthium")
];

const products = [
  product("nitrile-gloves", "Nitrile Examination Gloves", "Consumables"),
  product("syringe-pump", "Syringe Pump", "Equipment"),
  product("rapid-card", "Dengue Rapid Card", "Diagnostics")
];
const featuredCategories = buildCategoryNavigation(categories, 2);
const featuredCategoryProducts: Record<string, ProductList | undefined> = {
  consumables: productList([
    product("nitrile-gloves", "Nitrile Examination Gloves", "Consumables"),
    product("surgical-mask", "Surgical Face Mask", "Consumables")
  ]),
  equipment: productList([product("syringe-pump", "Syringe Pump", "Equipment")])
};

describe("MobileCommerceHome", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a mobile-only auto-scrolling banner carousel with nav dots", () => {
    vi.useFakeTimers();

    renderMobileCommerceHome();

    const carousel = screen.getByRole("region", {
      name: "Mobile promotional banners"
    });
    const slides = within(carousel).getAllByTestId(/^mobile-banner-slide-/);

    expect(carousel).toHaveClass("md:hidden");
    expect(slides).toHaveLength(5);
    expect(slides[0]).toHaveAttribute("data-active", "true");
    expect(slides[1]).toHaveAttribute("data-active", "false");
    expect(
      within(carousel).getByRole("button", { name: "Show banner 1" })
    ).toHaveAttribute("aria-current", "true");

    act(() => {
      vi.advanceTimersByTime(4500);
    });

    expect(slides[1]).toHaveAttribute("data-active", "true");

    fireEvent.click(within(carousel).getByRole("button", { name: "Show banner 5" }));

    expect(slides[4]).toHaveAttribute("data-active", "true");

  });

  it("renders the mobile shopping structure with native horizontal rails", () => {
    renderMobileCommerceHome();

    expect(screen.getByTestId("mobile-commerce-home")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /hospital supplies ordered simply banner/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Shop by Category" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("mobile-category-rail")).getByRole("link", {
        name: /Consumables/i
      })
    ).toHaveAttribute(
      "href",
      "/categories/consumables"
    );
    expect(screen.getByRole("heading", { name: "Top Brands" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all brands" })).toHaveAttribute(
      "href",
      "/brands"
    );
    expect(
      screen.getByRole("heading", { name: "Latest additions" })
    ).toBeInTheDocument();
    expect(screen.getByText("GST Ready")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-category-rail")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("mobile-brand-rail")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("mobile-product-rail")).toHaveClass("overflow-x-auto");
  }, 15000);

  it("renders featured products by category on mobile with scrollable product rails", () => {
    renderMobileCommerceHome();

    expect(
      screen.getByRole("heading", { name: "Featured products by category" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Consumables" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Consumables catalog" }))
      .toHaveAttribute("href", "/categories/consumables");
    const consumablesRail = screen.getByTestId("mobile-featured-rail-consumables");

    expect(within(consumablesRail).getByText("Nitrile Examination Gloves"))
      .toBeInTheDocument();
    expect(within(consumablesRail).getByText("Surgical Face Mask"))
      .toBeInTheDocument();
    expect(consumablesRail).toHaveClass("overflow-x-auto");
  }, 15000);

  it("highlights landing catalog actions without allowing their labels to wrap", () => {
    renderMobileCommerceHome();

    const categoryCard = within(screen.getByTestId("mobile-category-rail"))
      .getByRole("link", { name: /Consumables/i });
    const categoryCardAction = within(categoryCard).getByText("Open catalog");

    expect(categoryCardAction).toHaveClass("whitespace-nowrap", "rounded-full");

    expect(
      screen.getByRole("link", { name: "Open Consumables catalog" })
    ).toHaveClass("whitespace-nowrap", "rounded-full");

    for (const action of screen.getAllByRole("link", { name: /View all/i })) {
      expect(action).toHaveClass("whitespace-nowrap", "rounded-full");
    }
  }, 15000);
});

function renderMobileCommerceHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MobileCommerceHome
        brands={brands}
        categories={categories}
        featuredCategories={featuredCategories}
        featuredCategoryProducts={featuredCategoryProducts}
        products={products}
      />
    </QueryClientProvider>
  );
}

function category(slug: string, name: string, description: string): Category {
  return {
    children: [],
    description,
    id: slug,
    imageUrl: null,
    isActive: true,
    name,
    parentId: null,
    slug,
    sortOrder: 1
  };
}

function brand(slug: string, name: string): Brand {
  return {
    description: null,
    id: slug,
    isActive: true,
    logoUrl: null,
    name,
    slug
  };
}

function product(slug: string, name: string, categoryName: string): Product {
  return {
    basePrice: 1000,
    brand: { id: "brand", name: "Medika", slug: "medika" },
    brandId: "brand",
    category: {
      id: categoryName.toLowerCase(),
      name: categoryName,
      slug: categoryName.toLowerCase()
    },
    categoryId: categoryName.toLowerCase(),
    createdAt: "2026-06-20T00:00:00.000Z",
    description: `${name} long description`,
    disposable: true,
    documents: [],
    expirySensitive: false,
    id: slug,
    images: [],
    inStock: true,
    material: null,
    medicalSpecialty: null,
    metaDescription: null,
    metaTitle: null,
    mrp: 1500,
    name,
    packSize: null,
    searchTags: [],
    sellingPrice: 999,
    shortDescription: `${name} short description`,
    sku: slug.toUpperCase(),
    slug,
    status: "ACTIVE",
    sterile: false,
    subcategory: null,
    subcategoryId: null,
    taxRate: 18,
    unit: "box",
    updatedAt: "2026-06-20T00:00:00.000Z",
    variants: []
  };
}

function productList(items: Product[]): ProductList {
  return {
    items,
    pagination: {
      hasNextPage: false,
      hasPreviousPage: false,
      limit: items.length,
      page: 1,
      total: items.length,
      totalPages: 1
    }
  };
}
