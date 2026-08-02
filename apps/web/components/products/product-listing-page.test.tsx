import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeroUIProvider } from "@heroui/system";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Brand, Category, Product, ProductList } from "../../lib/api/schemas";
import {
  filterSelectPopoverProps,
  ProductListingPage
} from "./product-listing-page";

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

    expect(screen.getByTestId("product-results-grid")).toHaveClass(
      "grid-cols-2",
      "items-stretch",
      "xl:grid-cols-4"
    );
    expect(
      screen.getByRole("heading", { name: "SurgiPro Artery Forceps" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/products/surgipro-artery-forceps"
    );
    expect(
      screen.getByRole("link", { name: "View SurgiPro Artery Forceps" })
    ).toHaveClass("sm:hidden");
    expect(
      screen.getByRole("button", { name: "Add SurgiPro Artery Forceps to cart" })
    ).toHaveClass("hidden", "sm:inline-flex");
    expect(screen.queryByText("Hospital price")).not.toBeInTheDocument();
    expect(screen.queryByText("GST invoice ready")).not.toBeInTheDocument();
    expect(screen.queryByText("12% GST")).not.toBeInTheDocument();
  });

  it("places mobile in-stock, filter, and reset controls in one row", () => {
    renderListing();

    const controls = screen.getByTestId("mobile-catalog-controls");
    const stockLink = screen.getByRole("link", {
      name: "Show in-stock products"
    });
    const filterButton = screen.getByRole("button", { name: "Open filters" });
    const resetLink = screen.getByRole("link", {
      name: "Clear catalog filters"
    });

    expect(controls).toHaveClass(
      "grid-cols-[minmax(0,1fr)_2.75rem_2.75rem]"
    );
    expect(stockLink).toHaveAttribute("href", "/products?availability=available");
    expect(filterButton).toHaveClass("h-11", "w-11", "rounded-full");
    expect(resetLink).toHaveClass("h-11", "w-11", "rounded-full");
    expect(screen.queryByRole("button", { name: "Open sort" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Filters and sort" }))
      .not.toBeInTheDocument();
  });

  it("keeps mobile filter fields scrollable with a sticky apply action", () => {
    renderListing();

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));

    const dialog = screen.getByRole("dialog", { name: "Product filters" });
    const sheetHeader = within(dialog).getByTestId("mobile-filter-sheet-header");
    const filterFields = within(dialog).getByTestId("filter-fields-scroll");
    const applyButton = within(dialog).getByRole("button", {
      name: "Apply Filters"
    });
    const headerClearLink = within(sheetHeader).getByRole("link", {
      name: "Clear"
    });

    expect(dialog).toHaveClass("overflow-hidden");
    expect(sheetHeader).toHaveClass("justify-between");
    expect(headerClearLink).toHaveAttribute("href", "/products");
    expect(within(dialog).getAllByRole("link", { name: "Clear" }))
      .toHaveLength(1);
    expect(filterFields).toHaveClass("overflow-y-auto", "pb-6");
    expect(filterFields).toHaveClass("[scrollbar-width:thin]");
    expect(applyButton).toHaveClass("sticky", "bottom-0");
  });

  it("allows mobile filter dropdown popovers to flip within the viewport", () => {
    expect(filterSelectPopoverProps).toMatchObject({
      offset: 6,
      placement: "bottom-start",
      shouldBlockScroll: false,
      shouldFlip: true
    });
  });

  it("renders compact active filter badges after sheet selections", () => {
    searchParams = new URLSearchParams({
      category: "dental",
      stock: "in_stock"
    });

    renderListing();

    const categoryBadge = screen.getByText("Category: dental");
    const stockBadge = screen
      .getAllByText("In stock")
      .find((element) => element.className.includes("rounded-full"));

    expect(stockBadge).toBeDefined();

    expect(categoryBadge).toHaveClass("px-2", "py-1", "text-[10px]");
    expect(stockBadge).toHaveClass("px-2", "py-1", "text-[10px]");
    expect(screen.getByText("Active filters")).toHaveClass("text-[10px]");
  });

  it("shows category navigation without redundant desktop hero actions", () => {
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

    const hero = screen.getByTestId("catalog-hero");
    const subcategoryNav = screen.getByRole("navigation", {
      name: "Dental subcategories"
    });

    expect(hero).toHaveClass("grid", "gap-5");
    expect(screen.queryByRole("link", { name: "In-stock only" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reset filters" })).not.toBeInTheDocument();
    expect(subcategoryNav).toHaveClass("lg:max-w-[68rem]");
    expect(subcategoryNav).not.toHaveClass("mt-6");
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
    const subcategoryNav = screen.getByRole("navigation", {
      name: "Dental subcategories"
    });
    const subcategoryRail = subcategoryNav.firstElementChild;

    expect(subcategoryNav).toHaveClass("max-w-full", "overflow-hidden");
    expect(subcategoryRail).toHaveClass(
      "flex-nowrap",
      "overflow-x-auto",
      "sm:flex-wrap",
      "[scrollbar-width:none]"
    );
    expect(screen.getByRole("link", { name: "All Dental" })).toHaveClass(
      "shrink-0",
      "whitespace-nowrap"
    );
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
      .toHaveClass("text-[#287c30]");
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
