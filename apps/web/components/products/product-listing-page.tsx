"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { SectionHeader } from "../ui/section-header";
import { ProductGridSkeleton } from "./product-skeletons";

type ProductListingPageProps = {
  context: ProductListingContext;
  initialData?: ProductListingInitialData;
  initialFilters?: ProductFilters;
};

const LISTING_STALE_TIME_MS = 30_000;

export function ProductListingPage({
  context,
  initialData,
  initialFilters
}: ProductListingPageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lockedFilters = useMemo(
    () => ({
      brand: context.type === "brand" ? context.slug : undefined,
      category: context.type === "category" ? context.slug : undefined
    }),
    [context]
  );
  const filters = useMemo(
    () => parseProductFilters(new URLSearchParams(searchParams.toString()), lockedFilters),
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
    enabled: context.type === "category",
    initialData:
      context.type === "category" && initialData?.category?.slug === context.slug
        ? initialData.category
        : undefined,
    queryFn: () => getCategory(context.type === "category" ? context.slug : ""),
    queryKey: ["category", context.type === "category" ? context.slug : ""],
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
  const pageHeading = buildHeading(context, categoryQuery.data?.name, brandQuery.data?.name);
  const pageDescription = buildDescription(context, filters.search);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextFilters = filtersFromForm(formData, filters, lockedFilters);

    setFiltersOpen(false);
    router.push(productFiltersToHref(pathname, nextFilters, lockedFilters));
  }

  return (
    <>
      <Header />
      <main className="bg-[#f5f8f7]">
        <section className="border-b border-[#d8e2df] bg-white py-10">
          <Container>
            <SectionHeader
              description={pageDescription}
              eyebrow="Product browsing"
              title={pageHeading}
              action={
                <Button href="/products" variant="outline">
                  All products
                </Button>
              }
            />
            <div className="grid gap-3 md:grid-cols-3">
              {["SKU-aware search", "GST and stock visible", "Bulk-ready filtering"].map((item) => (
                <div
                  className="rounded-lg border border-[#d8e2df] bg-[#f8fbfa] px-4 py-3 text-sm font-extrabold text-[#31413d]"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
            {categoryQuery.isError ? (
              <ErrorState
                action={<RetryButton onRetry={() => categoryQuery.refetch()} />}
                message={getFriendlyApiErrorMessage(
                  categoryQuery.error,
                  "Unable to load this category."
                )}
                title="Unable to load category"
              />
            ) : null}
            {brandQuery.isError ? (
              <ErrorState
                action={<RetryButton onRetry={() => brandQuery.refetch()} />}
                message={getFriendlyApiErrorMessage(
                  brandQuery.error,
                  "Unable to load this brand."
                )}
                title="Unable to load brand"
              />
            ) : null}
          </Container>
        </section>

        <Container className="grid gap-6 py-6 lg:grid-cols-[300px_1fr] lg:gap-8 lg:py-8">
          <div className="lg:hidden">
            <Button
              className="w-full"
              onClick={() => setFiltersOpen(true)}
              variant="secondary"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              Filters and sort
            </Button>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
            <FiltersForm
              brandName={brandQuery.data?.name}
              brands={brandsQuery.data}
              categories={categoriesQuery.data}
              categoryName={categoryQuery.data?.name}
              filters={filters}
              lockedFilters={lockedFilters}
              onSubmit={handleSubmit}
              pathname={pathname}
            />
          </aside>

          <section>
            <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#d8e2df] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-[#17211f]">
                  {productsQuery.data
                    ? `${productsQuery.data.pagination.total} matching purchase options`
                    : "Loading products"}
                </p>
                <p className="mt-1 text-xs font-bold text-[#687773]">
                  Use filters for department, brand, stock, sterile, disposable, and price.
                </p>
              </div>
              <Button href="/products" variant="outline">
                Reset all filters
              </Button>
            </div>

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
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {productsQuery.data.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
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
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#d8e2df] pb-4">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#17211f]">
                  <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
                  Filters and sort
                </h2>
                <button
                  aria-label="Close filters"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#d8e2df] bg-white text-[#17211f]"
                  onClick={() => setFiltersOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            <FiltersForm
                brandName={brandQuery.data?.name}
                brands={brandsQuery.data}
                categories={categoriesQuery.data}
                categoryName={categoryQuery.data?.name}
                className="grid gap-5"
                filters={filters}
                lockedFilters={lockedFilters}
                onSubmit={handleSubmit}
                pathname={pathname}
                showTitle={false}
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
  className = "grid gap-5 rounded-lg border border-[#d8e2df] bg-white p-5",
  filters,
  lockedFilters,
  onSubmit,
  pathname,
  showTitle = true
}: {
  brandName?: string;
  brands?: Brand[];
  categories?: Category[];
  categoryName?: string;
  className?: string;
  filters: ProductFilters;
  lockedFilters: { brand?: string; category?: string };
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pathname: string;
  showTitle?: boolean;
}) {
  return (
    <form
      className={className}
      key={productFiltersToHref(pathname, filters, lockedFilters)}
      onSubmit={onSubmit}
    >
      {showTitle ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#17211f]">
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
            Procurement filters
          </h2>
          <ClearFiltersLink pathname={pathname} />
        </div>
      ) : (
        <div className="flex justify-end">
          <ClearFiltersLink pathname={pathname} />
        </div>
      )}

      <Field label="Search query">
        <input
          className={inputClassName}
          defaultValue={filters.search ?? ""}
          name="q"
          placeholder="Product, SKU, brand, specialty"
        />
      </Field>

      {lockedFilters.category ? (
        <LockedField label="Category" value={categoryName ?? lockedFilters.category} />
      ) : (
        <Field label="Category">
          <select
            className={inputClassName}
            defaultValue={filters.category ?? ""}
            name="category"
          >
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {lockedFilters.brand ? (
        <LockedField label="Brand" value={brandName ?? lockedFilters.brand} />
      ) : (
        <Field label="Brand">
          <select
            className={inputClassName}
            defaultValue={filters.brand ?? ""}
            name="brand"
          >
            <option value="">All brands</option>
            {brands?.map((brand) => (
              <option key={brand.id} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Min price">
          <input
            className={inputClassName}
            defaultValue={filters.minPrice ?? ""}
            min={0}
            name="minPrice"
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
            placeholder="5000"
            type="number"
          />
        </Field>
      </div>

      <Field label="Stock status">
        <select
          className={inputClassName}
          defaultValue={filters.stock ?? ""}
          name="stock"
        >
          {STOCK_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Clinical specialty">
        <input
          className={inputClassName}
          defaultValue={filters.medicalSpecialty ?? ""}
          name="medicalSpecialty"
          placeholder="General Surgery, ICU, OT"
        />
      </Field>

      <div className="grid gap-3">
        <Checkbox
          defaultChecked={filters.availability === "available"}
          label="Only available products"
          name="availability"
          value="available"
        />
        <Checkbox
          defaultChecked={filters.expirySensitive === true}
          label="Expiry sensitive"
          name="expirySensitive"
        />
        <Checkbox
          defaultChecked={filters.sterile === true}
          label="Sterile"
          name="sterile"
        />
        <Checkbox
          defaultChecked={filters.disposable === true}
          label="Disposable"
          name="disposable"
        />
      </div>

      <Field label="Sort">
        <select className={inputClassName} defaultValue={filters.sort} name="sort">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Button className="w-full" type="submit">
        <Filter aria-hidden="true" className="h-4 w-4" />
        Apply filters
      </Button>
    </form>
  );
}

function ClearFiltersLink({ pathname }: { pathname: string }) {
  return (
    <a
      className="inline-flex min-h-12 items-center gap-1 text-sm font-extrabold text-[#006d77]"
      href={pathname}
    >
      <RotateCcw aria-hidden="true" className="h-4 w-4" />
      Clear
    </a>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-extrabold text-[#31413d]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 text-sm font-extrabold text-[#31413d]">
      <span>{label}</span>
      <span className="rounded-lg border border-[#d8e2df] bg-[#eef3f1] px-3 py-2 text-[#084c61]">
        {value}
      </span>
    </div>
  );
}

function Checkbox({
  defaultChecked,
  label,
  name,
  value = "true"
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 text-sm font-bold text-[#31413d]">
      <input
        className="h-5 w-5 rounded border-[#cfdcda] accent-[#006d77]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value={value}
      />
      <span>{label}</span>
    </label>
  );
}

function Pagination({
  filters,
  lockedFilters,
  pathname,
  totalPages
}: {
  filters: ProductFilters;
  lockedFilters: { brand?: string; category?: string };
  pathname: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, filters.page - 1);
  const nextPage = Math.min(totalPages, filters.page + 1);

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-3" aria-label="Product pagination">
      <Button
        href={productFiltersToHref(pathname, { ...filters, page: previousPage }, lockedFilters)}
        variant="outline"
      >
        Previous
      </Button>
      <span className="text-sm font-extrabold text-[#31413d]">
        Page {filters.page} of {totalPages}
      </span>
      <Button
        href={productFiltersToHref(pathname, { ...filters, page: nextPage }, lockedFilters)}
        variant="outline"
      >
        Next
      </Button>
    </nav>
  );
}

function filtersFromForm(
  formData: FormData,
  currentFilters: ProductFilters,
  lockedFilters: { brand?: string; category?: string }
): ProductFilters {
  return {
    availability:
      readFormString(formData, "availability") === "available" ? "available" : undefined,
    brand: lockedFilters.brand ?? readFormString(formData, "brand"),
    category: lockedFilters.category ?? readFormString(formData, "category"),
    disposable: readFormBoolean(formData, "disposable"),
    expirySensitive: readFormBoolean(formData, "expirySensitive"),
    maxPrice: readFormNumber(formData, "maxPrice"),
    medicalSpecialty: readFormString(formData, "medicalSpecialty"),
    minPrice: readFormNumber(formData, "minPrice"),
    page: 1,
    search: readFormString(formData, "q"),
    sort: readFormSort(formData) ?? currentFilters.sort,
    sterile: readFormBoolean(formData, "sterile"),
    stock: readFormStock(formData)
  };
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readFormNumber(formData: FormData, key: string) {
  const value = readFormString(formData, key);
  const numberValue = value === undefined ? Number.NaN : Number(value);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
}

function readFormBoolean(formData: FormData, key: string) {
  return formData.get(key) === "true" ? true : undefined;
}

function readFormSort(formData: FormData) {
  const value = readFormString(formData, "sort");

  return SORT_OPTIONS.some((option) => option.value === value)
    ? (value as ProductFilters["sort"])
    : undefined;
}

function readFormStock(formData: FormData) {
  const value = readFormString(formData, "stock");

  return value === "in_stock" || value === "out_of_stock" ? value : undefined;
}

function buildHeading(
  context: ProductListingContext,
  categoryName: string | undefined,
  brandName: string | undefined
) {
  if (context.type === "category") {
    return categoryName ? `${categoryName} products` : "Category products";
  }

  if (context.type === "brand") {
    return brandName ? `${brandName} products` : "Brand products";
  }

  return "All surgical and medical products";
}

function buildDescription(context: ProductListingContext, search: string | undefined) {
  if (search) {
    return `Showing catalog results for "${search}" with filters and sorting preserved in the page URL.`;
  }

  if (context.type === "category") {
    return "Browse products in this category with price, stock, specialty, and clinical-use filters.";
  }

  if (context.type === "brand") {
    return "Browse products from this brand with price, stock, specialty, and clinical-use filters.";
  }

  return "Browse the customer catalog with procurement filters, sorting, pagination, and shareable searches.";
}

const inputClassName =
  "min-h-11 w-full rounded-lg border border-[#cfdcda] bg-white px-3 text-sm font-semibold text-[#17211f] outline-none transition focus:border-[#006d77] focus:ring-2 focus:ring-[#006d77]/20";
