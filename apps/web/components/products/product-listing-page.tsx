"use client";

import {
  Select as HeroSelect,
  SelectItem as HeroSelectItem,
  SelectSection as HeroSelectSection,
  type SelectProps as HeroSelectProps
} from "@heroui/select";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Key, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "../../lib/api/brands";
import { getBrands } from "../../lib/api/brands";
import { getCategories } from "../../lib/api/categories";
import { getCategory } from "../../lib/api/categories";
import type { Brand, Category } from "../../lib/api/schemas";
import type {
  ProductListingContext,
  ProductListingInitialData
} from "../../lib/catalog/listing-initial-data";
import {
  parseProductFilters,
  productFiltersToHref,
  productFiltersToProductQuery,
  productFiltersToSearchParams,
  SORT_OPTIONS,
  STOCK_OPTIONS,
  type ProductFilterOverrides,
  type ProductFilters
} from "../../lib/catalog/product-filters";
import { getProducts } from "../../lib/api/products";
import { getFriendlyApiErrorMessage } from "../../lib/api/error-messages";
import {
  mobileBottomSheetOverlayClassName,
  mobileBottomSheetPanelClassName
} from "../../lib/responsive/responsive-classes";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState, RetryButton } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { ProductGridSkeleton } from "./product-skeletons";

type ProductListingPageProps = {
  context: ProductListingContext;
  initialData?: ProductListingInitialData;
  initialFilters?: ProductFilters;
};

const LISTING_STALE_TIME_MS = 30_000;
const FILTER_SELECT_ALL_VALUE = "__all__";

export const filterSelectPopoverProps = {
  offset: 6,
  placement: "bottom-start",
  shouldBlockScroll: false,
  shouldFlip: true
} satisfies HeroSelectProps["popoverProps"];

type FilterSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

type FilterSelectSection = {
  label: string;
  options: FilterSelectOption[];
};

export function ProductListingPage({
  context,
  initialData,
  initialFilters
}: ProductListingPageProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lockedFilters = useMemo(
    () => ({
      brand: context.type === "brand" ? context.slug : undefined,
      category:
        context.type === "category" || context.type === "subcategory"
          ? context.slug
          : undefined,
      subcategory:
        context.type === "subcategory" ? context.subcategorySlug : undefined
    }),
    [context]
  );
  const filters = useMemo(
    () =>
      parseProductFilters(new URLSearchParams(searchParams.toString()), lockedFilters),
    [lockedFilters, searchParams]
  );
  const isInitialFilterState = useMemo(() => {
    if (!initialFilters) {
      return false;
    }

    return (
      productFiltersToSearchParams(filters, lockedFilters).toString() ===
      productFiltersToSearchParams(initialFilters, lockedFilters).toString()
    );
  }, [filters, initialFilters, lockedFilters]);

  const productsQuery = useQuery({
    initialData: isInitialFilterState ? initialData?.products : undefined,
    queryFn: () => getProducts(productFiltersToProductQuery(filters)),
    queryKey: ["products", filters],
    staleTime: LISTING_STALE_TIME_MS
  });
  const categoriesQuery = useQuery({
    initialData: initialData?.categories,
    queryFn: getCategories,
    queryKey: ["categories"],
    staleTime: LISTING_STALE_TIME_MS
  });
  const brandsQuery = useQuery({
    initialData: initialData?.brands,
    queryFn: getBrands,
    queryKey: ["brands"],
    staleTime: LISTING_STALE_TIME_MS
  });
  const categoryQuery = useQuery({
    enabled: context.type === "category" || context.type === "subcategory",
    initialData:
      (context.type === "category" || context.type === "subcategory") &&
        initialData?.category?.slug === context.slug
        ? initialData.category
        : undefined,
    queryFn: () =>
      getCategory(
        context.type === "category" || context.type === "subcategory"
          ? context.slug
          : ""
      ),
    queryKey: [
      "category",
      context.type === "category" || context.type === "subcategory"
        ? context.slug
        : ""
    ],
    staleTime: LISTING_STALE_TIME_MS
  });
  const brandQuery = useQuery({
    enabled: context.type === "brand",
    initialData:
      context.type === "brand" && initialData?.brand?.slug === context.slug
        ? initialData.brand
        : undefined,
    queryFn: () => getBrand(context.type === "brand" ? context.slug : ""),
    queryKey: ["brand", context.type === "brand" ? context.slug : ""],
    staleTime: LISTING_STALE_TIME_MS
  });
  const subcategoryName = findSubcategoryName(
    categoryQuery.data,
    context.type === "subcategory" ? context.subcategorySlug : filters.subcategory
  );
  const pageHeading = buildHeading(
    context,
    categoryQuery.data?.name,
    brandQuery.data?.name,
    subcategoryName
  );
  const pageDescription = buildDescription(context, filters.search, categoryQuery.data?.name);
  const availableHref = productFiltersToHref(
    pathname,
    { ...filters, availability: "available", page: 1 },
    lockedFilters
  );
  const clearFiltersHref = getClearFiltersHref(context, pathname);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [filtersOpen]);

  function handleFiltersChange(nextFilters: ProductFilters) {
    const href = productFiltersToHref(pathname, nextFilters, lockedFilters);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    window.history.pushState(null, "", href);
    window.requestAnimationFrame(() => {
      if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
        window.scrollTo(scrollX, scrollY);
      }
    });
  }

  return (
    <>
      <Header />
      <main className="bg-[#f4fbf5]">
        <section className="border-b border-[#cfe9d2] bg-[#f4fbf5] pt-5 sm:pt-6 lg:py-7">
          <Container>
            <div className="grid gap-5" data-testid="catalog-hero">
              <div className="max-w-2xl lg:max-w-md">
                <h1 className="text-2xl font-semibold leading-tight text-[#173b1d] sm:text-3xl lg:text-4xl">
                  {pageHeading}
                </h1>
                <p className="mt-2 max-w-md text-sm font-semibold leading-5 text-[#556b57] sm:text-base sm:leading-6">
                  {pageDescription}
                </p>
              </div>
              {(context.type === "category" || context.type === "subcategory") &&
              categoryQuery.data ? (
                <SubcategoryNav
                  category={categoryQuery.data}
                  filters={filters}
                  lockedFilters={lockedFilters}
                />
              ) : null}
              {categoryQuery.isError ? (
                <div className="lg:col-span-2">
                  <ErrorState
                    action={<RetryButton onRetry={() => categoryQuery.refetch()} />}
                    message={getFriendlyApiErrorMessage(
                      categoryQuery.error,
                      "Unable to load this category."
                    )}
                    title="Unable to load category"
                  />
                </div>
              ) : null}
              {brandQuery.isError ? (
                <div className="lg:col-span-2">
                  <ErrorState
                    action={<RetryButton onRetry={() => brandQuery.refetch()} />}
                    message={getFriendlyApiErrorMessage(
                      brandQuery.error,
                      "Unable to load this brand."
                    )}
                    title="Unable to load brand"
                  />
                </div>
              ) : null}
            </div>
          </Container>
        </section>

        <Container className="grid gap-5 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:py-6">
          <div
            className="grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2 lg:hidden"
            data-testid="mobile-catalog-controls"
          >
            <a
              aria-label="Show in-stock products"
              className="flex min-h-11 min-w-0 items-center justify-center rounded-full bg-[#287c30] px-4 text-xs font-semibold text-white shadow-sm shadow-[#287c30]/20"
              href={availableHref}
            >
              In-stock only
            </a>
            <button
              aria-label="Open filters"
              className={mobileCatalogIconButtonClassName}
              onClick={() => setFiltersOpen(true)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
            </button>
            <a
              aria-label="Clear catalog filters"
              className={mobileCatalogIconButtonClassName}
              href={clearFiltersHref}
            >
              <RotateCcw aria-hidden="true" className="h-5 w-5" />
            </a>
          </div>

          <aside
            aria-label="Product filters"
            className="hidden lg:sticky lg:top-20 lg:block lg:self-start"
            data-testid="desktop-product-filters"
          >
            <FiltersForm
              brandName={brandQuery.data?.name}
              brands={brandsQuery.data}
              categories={categoriesQuery.data}
              categoryName={categoryQuery.data?.name}
              filters={filters}
              lockedFilters={lockedFilters}
              onFiltersChange={handleFiltersChange}
              pathname={pathname}
              clearHref={clearFiltersHref}
              subcategoryName={subcategoryName}
            />
          </aside>

          <section
            className="min-h-0"
            data-testid="product-results-panel"
          >

            <ActiveFilterSummary
              filters={filters}
              lockedFilters={lockedFilters}
              clearHref={clearFiltersHref}
            />

            <div
              className="min-h-0"
              data-testid="product-results-scroll"
            >
              {productsQuery.isLoading ? <ProductGridSkeleton /> : null}

              {productsQuery.isError ? (
                <ErrorState
                  action={<RetryButton onRetry={() => productsQuery.refetch()} />}
                  message={getFriendlyApiErrorMessage(
                    productsQuery.error,
                    "Unable to load products."
                  )}
                  title="Unable to load products"
                />
              ) : null}

              {productsQuery.isSuccess && productsQuery.data.items.length === 0 ? (
                <EmptyState
                  action={<Button href="/products">Clear filters</Button>}
                  description="Try removing filters or searching a different product, SKU, brand, or specialty."
                  title="No products found"
                />
              ) : null}

              {productsQuery.isSuccess && productsQuery.data.items.length > 0 ? (
                <>
                  <div
                    className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4"
                    data-testid="product-results-grid"
                  >
                    {productsQuery.data.items.map((product) => (
                      <ProductCard compact key={product.id} product={product} />
                    ))}
                  </div>
                  <Pagination
                    filters={filters}
                    lockedFilters={lockedFilters}
                    pathname={pathname}
                    totalPages={productsQuery.data.pagination.totalPages}
                  />
                </>
              ) : null}
            </div>
          </section>
        </Container>
        {filtersOpen ? (
          <div className={mobileBottomSheetOverlayClassName}>
            <button
              aria-label="Close filters"
              className="absolute inset-0 h-full w-full cursor-default"
              onClick={() => setFiltersOpen(false)}
              type="button"
            />
            <section
              aria-label="Product filters"
              aria-modal="true"
              className={mobileBottomSheetPanelClassName}
              role="dialog"
            >
              <div
                className="mb-3 flex items-center justify-between gap-3 border-b border-[#cfe9d2] pb-3"
                data-testid="mobile-filter-sheet-header"
              >
                <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-[#17211f]">
                  <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
                  Filters and sort
                </h2>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <ClearFiltersLink
                    className="min-h-10 rounded-full border border-[#a9ddae] bg-[#f8fbfa] px-3"
                    href={clearFiltersHref}
                    pathname={pathname}
                  />
                  <button
                    aria-label="Close filters"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#cfe9d2] bg-white text-[#17211f] shadow-sm shadow-[#287c30]/5"
                    onClick={() => setFiltersOpen(false)}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <FiltersForm
                brandName={brandQuery.data?.name}
                brands={brandsQuery.data}
                categories={categoriesQuery.data}
                categoryName={categoryQuery.data?.name}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
                fieldsClassName="grid min-h-0 flex-1 gap-3 overflow-x-hidden overflow-y-auto pb-6 pr-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#a9ddae] [&::-webkit-scrollbar-track]:bg-[#eaf7eb]"
                filters={filters}
                lockedFilters={lockedFilters}
                onFiltersChange={handleFiltersChange}
                onApply={() => setFiltersOpen(false)}
                pathname={pathname}
                clearHref={clearFiltersHref}
                showApplyButton
                showClearLink={false}
                showTitle={false}
                subcategoryName={subcategoryName}
              />
            </section>
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  );
}

function FiltersForm({
  brandName,
  brands,
  categories,
  categoryName,
  clearHref,
  className = "grid gap-3 overflow-visible rounded-lg border border-[#cfe9d2] bg-white p-3 shadow-sm shadow-[#287c30]/5",
  fieldsClassName = "grid gap-3 overflow-visible pb-1 pr-1",
  filters,
  lockedFilters,
  onFiltersChange,
  onApply,
  pathname,
  showApplyButton = false,
  showClearLink = true,
  showTitle = true,
  subcategoryName
}: {
  brandName?: string;
  brands?: Brand[];
  categories?: Category[];
  categoryName?: string;
  clearHref: string;
  className?: string;
  fieldsClassName?: string;
  filters: ProductFilters;
  lockedFilters: ProductFilterOverrides;
  onApply?: () => void;
  onFiltersChange: (filters: ProductFilters) => void;
  pathname: string;
  showApplyButton?: boolean;
  showClearLink?: boolean;
  showTitle?: boolean;
  subcategoryName?: string;
}) {
  const activeCategory = lockedFilters.category ?? filters.category ?? "";
  const [selectedCategory, setSelectedCategory] = useState(activeCategory);
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    filters.subcategory ?? ""
  );
  const subcategoryGroups = getSubcategoryGroups(
    categories,
    selectedCategory || undefined
  );

  useEffect(() => {
    setSelectedCategory(activeCategory);
    setSelectedSubcategory(filters.subcategory ?? "");
  }, [activeCategory, filters.subcategory]);

  function updateFilters(nextPatch: Partial<ProductFilters>) {
    const nextFilters: ProductFilters = {
      ...filters,
      ...nextPatch,
      page: 1
    };

    if (lockedFilters.brand) {
      nextFilters.brand = lockedFilters.brand;
    }

    if (lockedFilters.category) {
      nextFilters.category = lockedFilters.category;
    }

    if (lockedFilters.subcategory) {
      nextFilters.subcategory = lockedFilters.subcategory;
    }

    onFiltersChange(nextFilters);
  }

  return (
    <form
      aria-label="Product filters"
      className={className}
    >
      {showTitle ? (
        <div className="shrink-0 pb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#17211f]">
              <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
              Filters
            </h2>
            <p className="mt-1 text-xs font-semibold leading-4 text-[#687773]">
              Narrow catalog results.
            </p>
          </div>
          {showClearLink ? (
            <ClearFiltersLink href={clearHref} pathname={pathname} />
          ) : null}
        </div>
      ) : showClearLink ? (
        <div className="flex shrink-0 justify-end pb-3">
          <ClearFiltersLink href={clearHref} pathname={pathname} />
        </div>
      ) : null}

      <div className={fieldsClassName} data-testid="filter-fields-scroll">
        <Field label="Search query">
          <input
            className={inputClassName}
            defaultValue={filters.search ?? ""}
            name="q"
            onChange={(event) =>
              updateFilters({ search: readFilterText(event.target.value) })
            }
            placeholder="Product, SKU, brand, specialty"
          />
        </Field>

        {lockedFilters.category ? (
          <LockedField label="Category" value={categoryName ?? lockedFilters.category} />
        ) : (
          <Field label="Category">
            <HeroFilterSelect
              label="Category"
              name="category"
              onChange={(value) => {
                setSelectedCategory(value);
                setSelectedSubcategory("");
                updateFilters({
                  category: readFilterText(value),
                  subcategory: undefined
                });
              }}
              options={[
                {
                  label: "All categories",
                  value: ""
                },
                ...(categories?.map((category) => ({
                  label: category.name,
                  value: category.slug
                })) ?? [])
              ]}
              placeholder="All categories"
              value={selectedCategory}
            />
          </Field>
        )}

        {lockedFilters.subcategory ? (
          <LockedField
            label="Subcategory"
            value={subcategoryName ?? lockedFilters.subcategory}
          />
        ) : (
          <Field label="Subcategory">
            <HeroFilterSelect
              disabled={subcategoryGroups.length === 0}
              label="Subcategory"
              name="subcategory"
              onChange={(value) => {
                setSelectedSubcategory(value);
                updateFilters({ subcategory: readFilterText(value) });
              }}
              options={[
                {
                  label: "All subcategories",
                  value: ""
                }
              ]}
              placeholder="All subcategories"
              sections={subcategoryGroups.map((group) => ({
                label: group.category.name,
                options: group.subcategories.map((subcategory) => ({
                  label: subcategory.name,
                  value: subcategory.slug
                }))
              }))}
              value={selectedSubcategory}
            />
          </Field>
        )}

        {lockedFilters.brand ? (
          <LockedField label="Brand" value={brandName ?? lockedFilters.brand} />
        ) : (
          <Field label="Brand">
            <HeroFilterSelect
              label="Brand"
              name="brand"
              onChange={(value) => updateFilters({ brand: readFilterText(value) })}
              options={[
                {
                  label: "All brands",
                  value: ""
                },
                ...(brands?.map((brand) => ({
                  label: brand.name,
                  value: brand.slug
                })) ?? [])
              ]}
              placeholder="All brands"
              value={filters.brand ?? ""}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Min price">
            <input
              className={inputClassName}
              defaultValue={filters.minPrice ?? ""}
              min={0}
              name="minPrice"
              onChange={(event) =>
                updateFilters({ minPrice: readFilterNumber(event.target.value) })
              }
              placeholder="0"
              type="number"
            />
          </Field>
          <Field label="Max price">
            <input
              className={inputClassName}
              defaultValue={filters.maxPrice ?? ""}
              min={0}
              name="maxPrice"
              onChange={(event) =>
                updateFilters({ maxPrice: readFilterNumber(event.target.value) })
              }
              placeholder="5000"
              type="number"
            />
          </Field>
        </div>

        <Field label="Stock status">
          <HeroFilterSelect
            label="Stock status"
            name="stock"
            onChange={(value) =>
              updateFilters({ stock: readFilterStock(value) })
            }
            options={STOCK_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value
            }))}
            placeholder="All stock"
            value={filters.stock ?? ""}
          />
        </Field>

        <Field label="Clinical specialty">
          <input
            className={inputClassName}
            defaultValue={filters.medicalSpecialty ?? ""}
            name="medicalSpecialty"
            onChange={(event) =>
              updateFilters({
                medicalSpecialty: readFilterText(event.target.value)
              })
            }
            placeholder="General Surgery, ICU, OT"
          />
        </Field>

        <div className="grid gap-1.5">
          <Checkbox
            defaultChecked={filters.availability === "available"}
            label="Only available products"
            name="availability"
            onChange={(checked) =>
              updateFilters({ availability: checked ? "available" : undefined })
            }
            value="available"
          />
          <Checkbox
            defaultChecked={filters.expirySensitive === true}
            label="Expiry sensitive"
            name="expirySensitive"
            onChange={(checked) =>
              updateFilters({ expirySensitive: checked ? true : undefined })
            }
          />
          <Checkbox
            defaultChecked={filters.sterile === true}
            label="Sterile"
            name="sterile"
            onChange={(checked) =>
              updateFilters({ sterile: checked ? true : undefined })
            }
          />
          <Checkbox
            defaultChecked={filters.disposable === true}
            label="Disposable"
            name="disposable"
            onChange={(checked) =>
              updateFilters({ disposable: checked ? true : undefined })
            }
          />
        </div>

        <Field label="Sort">
          <HeroFilterSelect
            label="Sort"
            name="sort"
            onChange={(value) =>
              updateFilters({ sort: readFilterSort(value) ?? "latest" })
            }
            options={SORT_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value
            }))}
            placeholder="Sort products"
            value={filters.sort}
          />
        </Field>
      </div>

      {showApplyButton ? (
        <Button
          className="sticky bottom-0 z-10 mt-1 w-full !min-h-11 rounded-full text-sm shadow-[0_-8px_18px_rgba(40,124,48,0.12)]"
          onClick={onApply}
          type="button"
        >
          Apply Filters
        </Button>
      ) : null}
    </form>
  );
}

function ClearFiltersLink({
  className,
  href,
  pathname
}: {
  className?: string;
  href?: string;
  pathname: string;
}) {
  return (
    <a
      className={[
        "inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#287c30]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      href={href ?? pathname}
    >
      <RotateCcw aria-hidden="true" className="h-4 w-4" />
      Clear
    </a>
  );
}

function SubcategoryNav({
  category,
  filters,
  lockedFilters
}: {
  category: Category;
  filters: ProductFilters;
  lockedFilters: ProductFilterOverrides;
}) {
  if (category.children.length === 0) {
    return null;
  }

  return (
    <nav
      className="max-w-full overflow-hidden lg:max-w-[68rem] mb-4"
      aria-label={`${category.name} subcategories`}
    >
      <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <a
          className={[
            "shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] md:text-xs font-semibold transition",
            filters.subcategory
              ? "border-[#cfe9d2] bg-white text-[#31413d] shadow-sm shadow-[#287c30]/5"
              : "border-[#287c30] bg-[#eaf7eb] text-[#287c30]"
          ].join(" ")}
          href={productFiltersToHref(
            `/categories/${category.slug}`,
            { ...filters, page: 1, subcategory: undefined },
            {
              ...lockedFilters,
              category: category.slug,
              subcategory: undefined
            }
          )}
        >
          All {category.name}
        </a>
        {category.children.map((subcategory) => (
          <a
            className={[
              "shrink-0 whitespace-nowrap rounded-full border  px-2 py-1 text-[10px] md:text-xs font-semibold transition",
              filters.subcategory === subcategory.slug
                ? "border-[#287c30] bg-[#eaf7eb] text-[#287c30]"
                : "border-[#cfe9d2] bg-white text-[#31413d] shadow-sm shadow-[#287c30]/5"
            ].join(" ")}
            href={productFiltersToHref(
              `/categories/${category.slug}/${subcategory.slug}`,
              { ...filters, page: 1, subcategory: subcategory.slug },
              {
                ...lockedFilters,
                category: category.slug,
                subcategory: subcategory.slug
              }
            )}
            key={subcategory.id}
          >
            {subcategory.name}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#31413d]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5 text-xs font-semibold text-[#31413d]">
      <span>{label}</span>
      <span className="rounded-lg border border-[#cfe9d2] bg-[#eef3f1] px-3 py-2 text-sm text-[#23702a] shadow-sm shadow-[#287c30]/5">
        {value}
      </span>
    </div>
  );
}

function Checkbox({
  defaultChecked,
  label,
  name,
  onChange,
  value = "true"
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
  onChange?: (checked: boolean) => void;
  value?: string;
}) {
  return (
    <label className="flex min-h-8 items-center gap-2 text-xs font-semibold text-[#31413d]">
      <input
        className="h-4 w-4 rounded border-[#cfdcda] accent-[#287c30]"
        defaultChecked={defaultChecked}
        name={name}
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
        value={value}
      />
      <span>{label}</span>
    </label>
  );
}

function ActiveFilterSummary({
  clearHref,
  filters,
  lockedFilters
}: {
  clearHref: string;
  filters: ProductFilters;
  lockedFilters: ProductFilterOverrides;
}) {
  const chips = getActiveFilterChips(filters, lockedFilters);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
      <span className="text-[10px] font-semibold uppercase leading-3 text-[#9b6a1e] sm:text-xs sm:leading-4">
        Active filters
      </span>
      {chips.map((chip) => (
        <span
          className="rounded-full border border-[#cfe9d2] bg-[#f8fbfa] px-2 py-1 text-[10px] font-semibold leading-3 text-[#31413d] shadow-sm shadow-[#287c30]/5 sm:px-3 sm:py-1.5 sm:text-xs sm:leading-4"
          key={chip}
        >
          {chip}
        </span>
      ))}
      <a
        className="text-[10px] font-semibold leading-3 text-[#287c30] sm:text-xs sm:leading-4"
        href={clearHref}
      >
        Clear
      </a>
    </div>
  );
}

function Pagination({
  filters,
  lockedFilters,
  pathname,
  totalPages
}: {
  filters: ProductFilters;
  lockedFilters: ProductFilterOverrides;
  pathname: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, filters.page - 1);
  const nextPage = Math.min(totalPages, filters.page + 1);

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3"
      aria-label="Product pagination"
    >
      <Button
        href={productFiltersToHref(
          pathname,
          { ...filters, page: previousPage },
          lockedFilters
        )}
        variant="outline"
      >
        Previous
      </Button>
      <span className="text-sm font-semibold text-[#31413d]">
        Page {filters.page} of {totalPages}
      </span>
      <Button
        href={productFiltersToHref(
          pathname,
          { ...filters, page: nextPage },
          lockedFilters
        )}
        variant="outline"
      >
        Next
      </Button>
    </nav>
  );
}

function readFilterText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue && trimmedValue !== FILTER_SELECT_ALL_VALUE
    ? trimmedValue
    : undefined;
}

function readFilterNumber(value: string) {
  const textValue = readFilterText(value);
  const numberValue = textValue === undefined ? Number.NaN : Number(textValue);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function readFilterSort(value: string) {
  const nextValue = readFilterText(value);

  return SORT_OPTIONS.some((option) => option.value === nextValue)
    ? (nextValue as ProductFilters["sort"])
    : undefined;
}

function readFilterStock(value: string) {
  const nextValue = readFilterText(value);

  return nextValue === "in_stock" || nextValue === "out_of_stock"
    ? nextValue
    : undefined;
}

function getSubcategoryGroups(
  categories: Category[] | undefined,
  categorySlug: string | undefined
) {
  const roots = categories ?? [];
  const filteredRoots = categorySlug
    ? roots.filter((category) => category.slug === categorySlug)
    : roots;

  return filteredRoots
    .map((category) => ({
      category,
      subcategories: category.children
    }))
    .filter((group) => group.subcategories.length > 0);
}

function buildHeading(
  context: ProductListingContext,
  categoryName: string | undefined,
  brandName: string | undefined,
  subcategoryName: string | undefined
) {
  if (context.type === "subcategory") {
    return subcategoryName ? `${subcategoryName} products` : "Subcategory products";
  }

  if (context.type === "category") {
    return categoryName ? `${categoryName} products` : "Category products";
  }

  if (context.type === "brand") {
    return brandName ? `${brandName} products` : "Brand products";
  }

  return "All products";
}

function buildDescription(
  context: ProductListingContext,
  search: string | undefined,
  categoryName: string | undefined
) {
  if (search) {
    return `Results for "${search}" with filters saved in the URL.`;
  }

  if (context.type === "subcategory") {
    return categoryName
      ? `Browse this ${categoryName} subcategory with price, stock, specialty, and brand filters.`
      : "Browse this subcategory with price, stock, specialty, and brand filters.";
  }

  if (context.type === "category") {
    return "Browse this department with price, stock, specialty, and brand filters.";
  }

  if (context.type === "brand") {
    return "Browse this brand with price, stock, specialty, and department filters.";
  }

  return "Find surgical and medical supplies with simple filters and clear pricing.";
}

function getClearFiltersHref(context: ProductListingContext, pathname: string) {
  return context.type === "all" ? pathname : "/products";
}

function getActiveFilterChips(
  filters: ProductFilters,
  lockedFilters: ProductFilterOverrides
) {
  return [
    filters.search ? `Search: ${filters.search}` : undefined,
    !lockedFilters.category && filters.category
      ? `Category: ${filters.category}`
      : undefined,
    !lockedFilters.subcategory && filters.subcategory
      ? `Subcategory: ${filters.subcategory}`
      : undefined,
    !lockedFilters.brand && filters.brand ? `Brand: ${filters.brand}` : undefined,
    filters.minPrice !== undefined ? `Min Rs ${filters.minPrice}` : undefined,
    filters.maxPrice !== undefined ? `Max Rs ${filters.maxPrice}` : undefined,
    filters.stock === "in_stock" ? "In stock" : undefined,
    filters.stock === "out_of_stock" ? "Out of stock" : undefined,
    filters.availability === "available" ? "Available only" : undefined,
    filters.sterile ? "Sterile" : undefined,
    filters.disposable ? "Disposable" : undefined,
    filters.expirySensitive ? "Expiry sensitive" : undefined,
    filters.medicalSpecialty ? `Specialty: ${filters.medicalSpecialty}` : undefined,
    filters.sort !== "latest"
      ? `Sort: ${SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? filters.sort}`
      : undefined
  ].filter(Boolean) as string[];
}

function findSubcategoryName(
  category: Category | undefined,
  subcategorySlug: string | undefined
) {
  if (!category || !subcategorySlug) {
    return undefined;
  }

  return category.children.find((subcategory) => subcategory.slug === subcategorySlug)
    ?.name;
}

const inputClassName =
  "min-h-10 w-full rounded-lg border border-[#cfdcda] bg-white px-3 text-sm font-semibold text-[#17211f] outline-none transition focus:border-[#287c30] focus:ring-2 focus:ring-[#287c30]/20";

const mobileCatalogIconButtonClassName =
  "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#a9ddae] bg-white text-[#287c30] shadow-sm shadow-[#287c30]/5 transition active:scale-95";

const heroSelectClassNames = {
  base: "w-full min-w-0",
  listbox: "p-1",
  popoverContent: "z-[80] rounded-lg border border-[#cfdcda] bg-white shadow-lg",
  selectorIcon: "pointer-events-none end-3 h-4 w-4 text-[#287c30] opacity-100",
  trigger:
    "min-h-10 rounded-lg border border-[#cfdcda] bg-white px-3 pr-10 text-sm font-semibold text-[#17211f] shadow-none data-[focus=true]:border-[#287c30] data-[focus=true]:ring-2 data-[focus=true]:ring-[#287c30]/20",
  value: "text-sm text-[#17211f] group-data-[has-value=false]:text-[#687773]"
};

function HeroFilterSelect({
  disabled = false,
  label,
  name,
  onChange,
  options,
  placeholder,
  sections = [],
  value
}: {
  disabled?: boolean;
  label: string;
  name: string;
  onChange?: (value: string) => void;
  options: FilterSelectOption[];
  placeholder: string;
  sections?: FilterSelectSection[];
  value: string;
}) {
  const [selectedKey, setSelectedKey] = useState(valueToSelectKey(value));
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuInteractive, setIsMenuInteractive] = useState(false);
  const menuInteractiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const selectClassNames = useMemo(
    () => ({
      ...heroSelectClassNames,
      listbox: [
        heroSelectClassNames.listbox,
        isOpen && !isMenuInteractive ? "pointer-events-none" : undefined
      ]
        .filter(Boolean)
        .join(" ")
    }),
    [isMenuInteractive, isOpen]
  );
  const selectChildren = [
    ...options.map(renderFilterSelectOption),
    ...sections.map((section) => (
      <HeroSelectSection key={section.label} title={section.label}>
        {section.options.map(renderFilterSelectOption)}
      </HeroSelectSection>
    ))
  ] as unknown as HeroSelectProps["children"];

  useEffect(() => {
    setSelectedKey(valueToSelectKey(value));
  }, [value]);

  useEffect(() => {
    return () => {
      if (menuInteractiveTimerRef.current) {
        clearTimeout(menuInteractiveTimerRef.current);
      }
    };
  }, []);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (menuInteractiveTimerRef.current) {
      clearTimeout(menuInteractiveTimerRef.current);
      menuInteractiveTimerRef.current = null;
    }

    if (!open) {
      setIsMenuInteractive(false);
      return;
    }

    setIsMenuInteractive(false);
    menuInteractiveTimerRef.current = setTimeout(() => {
      setIsMenuInteractive(true);
      menuInteractiveTimerRef.current = null;
    }, 180);
  }

  return (
    <HeroSelect
      aria-label={label}
      classNames={selectClassNames}
      isDisabled={disabled}
      isOpen={isOpen}
      itemHeight={34}
      maxListboxHeight={240}
      name={name}
      onOpenChange={handleOpenChange}
      onSelectionChange={(keys) => {
        if (keys === "all") {
          return;
        }

        const [nextKey] = Array.from(keys as Set<Key>);

        if (nextKey !== undefined) {
          const normalizedKey = String(nextKey);

          setSelectedKey(normalizedKey);
          onChange?.(selectKeyToValue(normalizedKey));
        }
      }}
      placeholder={placeholder}
      popoverProps={{
        ...filterSelectPopoverProps
      }}
      radius="sm"
      selectedKeys={new Set([selectedKey])}
      selectorIcon={
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 text-[#287c30] opacity-100"
          data-testid={`${name}-filter-select-arrow`}
        />
      }
      size="sm"
      variant="bordered"
    >
      {selectChildren}
    </HeroSelect>
  );
}

function renderFilterSelectOption(option: FilterSelectOption) {
  const optionKey = valueToSelectKey(option.value);

  return (
    <HeroSelectItem
      key={optionKey}
      className="rounded-md text-sm text-[#17211f] data-[hover=true]:bg-[#eaf7eb]"
      isDisabled={option.disabled}
      textValue={option.label}
    >
      {option.label}
    </HeroSelectItem>
  );
}

function valueToSelectKey(value: string) {
  return value || FILTER_SELECT_ALL_VALUE;
}

function selectKeyToValue(key: string) {
  return key === FILTER_SELECT_ALL_VALUE ? "" : key;
}
