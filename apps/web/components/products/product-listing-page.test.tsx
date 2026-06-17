import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/system";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Brand, Category, Product, ProductList } from "../../lib/api/schemas";
import { ProductListingPage } from "./product-listing-page";

const routerPush = vi.fn();
let pathname = "/products";
let searchParams = new URLSearchParams();
let historyPushState: ReturnType<typeof vi.spyOn> | undefined;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    push: routerPush
  }),
  useSearchParams: () => searchParams
}));

vi.mock("../../lib/api/products", () => ({
  getProducts: vi.fn(async () => products)
}));

vi.mock("../../lib/api/categories", () => ({
  getCategories: vi.fn(async () => categories),
  getCategory: vi.fn(async (slug: string) =>
    categories.find((category) => category.slug === slug)
  )
}));

vi.mock("../../lib/api/brands", () => ({
  getBrand: vi.fn(async (slug: string) =>
    brands.find((brand) => brand.slug === slug)
  ),
  getBrands: vi.fn(async () => brands)
}));

const categories: Category[] = [
  {
    children: [
      {
        children: [],
        description: null,
        id: "sutures",
        imageUrl: null,
        isActive: true,
        name: "Sutures",
        parentId: "consumables",
        slug: "sutures",
        sortOrder: 1
      }
    ],
    description: null,
    id: "consumables",
    imageUrl: null,
    isActive: true,
    name: "Consumables",
    parentId: null,
    slug: "consumables",
    sortOrder: 1
  },
  {
    children: [
      {
        children: [],
        description: null,
        id: "endodontics",
        imageUrl: null,
        isActive: true,
        name: "Endodontics",
        parentId: "dental",
        slug: "endodontics",
        sortOrder: 1
      }
    ],
    description: null,
    id: "dental",
    imageUrl: null,
    isActive: true,
    name: "Dental",
    parentId: null,
    slug: "dental",
    sortOrder: 2
  }
];

const brands: Brand[] = [
  {
    description: null,
    id: "brand-1",
    isActive: true,
    logoUrl: null,
    name: "SurgiPro",
    slug: "surgipro"
  }
];

const product: Product = {
  basePrice: 8800,
  brand: {
    id: "brand-1",
    name: "SurgiPro",
    slug: "surgipro"
  },
  brandId: "brand-1",
  category: {
    id: "dental",
    name: "Dental",
    slug: "dental"
  },
  categoryId: "dental",
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
    id: "endodontics",
    name: "Endodontics",
    slug: "endodontics"
  },
  subcategoryId: "endodontics",
  taxRate: 12,
  unit: "box",
  updatedAt: "2026-05-26T00:00:00.000Z",
  variants: []
};

const products: ProductList = {
  items: [product],
  pagination: {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 12,
    page: 1,
    total: 1,
    totalPages: 1
  }
};

describe("ProductListingPage", () => {
  beforeEach(() => {
    historyPushState?.mockRestore();
    historyPushState = vi.spyOn(window.history, "pushState");
    window.history.replaceState(null, "", "/products");
    pathname = "/products";
    searchParams = new URLSearchParams();
    routerPush.mockClear();
  });

  it("renders listing products with compact card content", () => {
    renderListing();

    expect(
      screen.getByRole("heading", { name: "SurgiPro Artery Forceps" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/products/surgipro-artery-forceps"
    );
    expect(screen.queryByText("Hospital price")).not.toBeInTheDocument();
    expect(screen.queryByText("GST invoice ready")).not.toBeInTheDocument();
    expect(screen.queryByText("12% GST")).not.toBeInTheDocument();
  });

  it("resets filters without leaving the current category route", () => {
    pathname = "/categories/dental";

    renderListing({
      context: {
        slug: "dental",
        type: "category"
      },
      initialData: {
        category: categories[1]
      }
    });

    expect(screen.getAllByRole("link", { name: "Reset filters" })).toHaveLength(1);
    for (const resetLink of screen.getAllByRole("link", { name: "Reset filters" })) {
      expect(resetLink).toHaveAttribute("href", "/categories/dental");
    }
  });

  it("locks subcategory routes while preserving category navigation", () => {
    pathname = "/categories/dental/endodontics";

    renderListing({
      context: {
        slug: "dental",
        subcategorySlug: "endodontics",
        type: "subcategory"
      },
      initialData: {
        category: categories[1]
      },
      initialFilters: {
        category: "dental",
        page: 1,
        sort: "latest",
        subcategory: "endodontics"
      }
    });

    expect(screen.getByRole("heading", { name: "Endodontics products" }))
      .toBeInTheDocument();
    expect(screen.getAllByText("Endodontics").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "All Dental" })).toHaveAttribute(
      "href",
      "/categories/dental"
    );
    expect(screen.getAllByRole("link", { name: "Reset filters" })[0])
      .toHaveAttribute("href", "/categories/dental/endodontics");
  });

  it("updates subcategory choices when the category filter changes", async () => {
    searchParams = new URLSearchParams({
      category: "consumables"
    });

    renderListing();

    const subcategorySelect = getNativeFilterSelect("Subcategory");

    expect(
      within(subcategorySelect).getByRole("option", {
        hidden: true,
        name: "Sutures"
      })
    )
      .toBeInTheDocument();

    fireEvent.click(getHeroFilterTrigger("Category"));
    fireEvent.click(await screen.findByRole("option", { name: "Dental" }));

    await waitFor(() => {
      const updatedSubcategorySelect = getNativeFilterSelect("Subcategory");

      expect(
        within(updatedSubcategorySelect).queryByRole("option", {
          hidden: true,
          name: "Sutures"
        })
      )
        .not.toBeInTheDocument();
      expect(
        within(updatedSubcategorySelect).getByRole("option", {
          hidden: true,
        name: "Endodontics"
      })
    ).toBeInTheDocument();
    });
    expect(historyPushState).toHaveBeenLastCalledWith(
      null,
      "",
      "/products?category=dental"
    );
  });

  it("keeps desktop filters compact without internal listing scrollbars", () => {
    renderListing();

    const sidebar = screen.getByTestId("desktop-product-filters");
    const filterForm = screen.getByRole("form", { name: "Product filters" });
    const filterFields = screen.getByTestId("filter-fields-scroll");
    const resultsPanel = screen.getByTestId("product-results-panel");
    const resultsScroll = screen.getByTestId("product-results-scroll");

    expect(sidebar).toHaveClass("lg:sticky");
    expect(sidebar).toHaveClass("lg:self-start");
    expect(filterForm).toHaveClass("overflow-visible");
    expect(filterForm).not.toHaveClass("overflow-hidden");
    expect(filterFields).toHaveClass("overflow-visible");
    expect(filterFields).not.toHaveClass("overflow-y-auto");
    expect(resultsPanel).not.toHaveClass("lg:overflow-hidden");
    expect(resultsScroll).not.toHaveClass("lg:overflow-y-auto");
    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.queryByText("Procurement filters")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply filters" }))
      .not.toBeInTheDocument();
  });

  it("updates filters in real time without an apply action", () => {
    renderListing();

    fireEvent.change(screen.getByPlaceholderText("Product, SKU, brand, specialty"), {
      target: {
        value: "forceps"
      }
    });

    expect(historyPushState).toHaveBeenLastCalledWith(
      null,
      "",
      "/products?q=forceps"
    );

    fireEvent.click(screen.getByLabelText("Sterile"));

    expect(historyPushState).toHaveBeenLastCalledWith(
      null,
      "",
      "/products?sterile=true"
    );
  });

  it("renders visible dropdown arrows for Hero UI filter selects", () => {
    renderListing();

    expect(screen.getByTestId("category-filter-select-arrow"))
      .toHaveClass("text-[#006d77]");
    expect(getHeroFilterTrigger("Category")).toHaveClass("pr-10");
  });

  it("opens filter dropdowns without locking page scroll", async () => {
    document.body.style.overflow = "";

    renderListing();

    fireEvent.click(getHeroFilterTrigger("Category"));

    expect(await screen.findByRole("option", { name: "Dental" }))
      .toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});

function renderListing({
  context = { type: "all" },
  initialData,
  initialFilters
}: Partial<Parameters<typeof ProductListingPage>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <ProductListingPage
          context={context}
          initialData={{
            brands,
            categories,
            products,
            ...initialData
          }}
          initialFilters={
            initialFilters ?? {
              page: 1,
              sort: "latest"
            }
          }
        />
      </HeroUIProvider>
    </QueryClientProvider>
  );
}

function getNativeFilterSelect(label: string) {
  const select = screen
    .getAllByLabelText(label)
    .find((element) => element.tagName === "SELECT");

  expect(select).toBeDefined();

  return select as HTMLSelectElement;
}

function getHeroFilterTrigger(label: string) {
  const trigger = screen
    .getAllByLabelText(label)
    .find((element) => element.tagName === "BUTTON");

  expect(trigger).toBeDefined();

  return trigger as HTMLButtonElement;
}
