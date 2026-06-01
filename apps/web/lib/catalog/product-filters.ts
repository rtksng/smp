import type { ProductQuery } from "../api/products";

export const SORT_OPTIONS = [
  { label: "Latest", value: "latest" },
  { label: "Price low to high", value: "price_low_to_high" },
  { label: "Price high to low", value: "price_high_to_low" },
  { label: "Name A-Z", value: "name_az" }
] as const;

export const STOCK_OPTIONS = [
  { label: "Any stock status", value: "" },
  { label: "In stock", value: "in_stock" },
  { label: "Out of stock", value: "out_of_stock" }
] as const;

export type ProductSort = (typeof SORT_OPTIONS)[number]["value"];
export type ProductStockFilter = "in_stock" | "out_of_stock";
export type ProductAvailabilityFilter = "available";

export type ProductFilters = {
  availability?: ProductAvailabilityFilter;
  brand?: string;
  category?: string;
  disposable?: boolean;
  expirySensitive?: boolean;
  maxPrice?: number;
  medicalSpecialty?: string;
  minPrice?: number;
  page: number;
  search?: string;
  sort: ProductSort;
  sterile?: boolean;
  stock?: ProductStockFilter;
  subcategory?: string;
};

type ProductFilterOverrides = {
  brand?: string;
  category?: string;
  subcategory?: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const DEFAULT_SORT: ProductSort = "latest";
const sortValues = new Set<ProductSort>(SORT_OPTIONS.map((option) => option.value));
const stockValues = new Set<ProductStockFilter>(["in_stock", "out_of_stock"]);

export function parseProductFilters(
  searchParams: URLSearchParams,
  overrides: ProductFilterOverrides = {}
): ProductFilters {
  return compactFilters({
    availability:
      searchParams.get("availability") === "available" ? "available" : undefined,
    brand: overrides.brand ?? readString(searchParams, "brand"),
    category: overrides.category ?? readString(searchParams, "category"),
    disposable: readBoolean(searchParams, "disposable"),
    expirySensitive: readBoolean(searchParams, "expirySensitive"),
    maxPrice: readNumber(searchParams, "maxPrice"),
    medicalSpecialty: readString(searchParams, "medicalSpecialty"),
    minPrice: readNumber(searchParams, "minPrice"),
    page: readPositiveInteger(searchParams, "page") ?? DEFAULT_PAGE,
    search: readString(searchParams, "q"),
    sort: readSort(searchParams) ?? DEFAULT_SORT,
    sterile: readBoolean(searchParams, "sterile"),
    stock: readStock(searchParams),
    subcategory: overrides.subcategory ?? readString(searchParams, "subcategory")
  });
}

export function productFiltersToProductQuery(filters: ProductFilters): ProductQuery {
  const inStock =
    filters.availability === "available"
      ? true
      : filters.stock === "in_stock"
        ? true
        : filters.stock === "out_of_stock"
          ? false
          : undefined;

  return removeUndefined({
    brand: filters.brand,
    category: filters.category,
    disposable: filters.disposable === true ? true : undefined,
    expirySensitive: filters.expirySensitive === true ? true : undefined,
    inStock,
    limit: DEFAULT_LIMIT,
    maxPrice: filters.maxPrice,
    medicalSpecialty: filters.medicalSpecialty,
    minPrice: filters.minPrice,
    page: filters.page,
    search: filters.search,
    sort: filters.sort,
    sterile: filters.sterile === true ? true : undefined,
    subcategory: filters.subcategory
  });
}

export function productFiltersToSearchParams(
  filters: ProductFilters,
  locked: ProductFilterOverrides = {}
) {
  const params = new URLSearchParams();

  appendString(params, "q", filters.search);
  appendString(params, "category", locked.category ? undefined : filters.category);
  appendString(
    params,
    "subcategory",
    locked.subcategory ? undefined : filters.subcategory
  );
  appendString(params, "brand", locked.brand ? undefined : filters.brand);
  appendNumber(params, "minPrice", filters.minPrice);
  appendNumber(params, "maxPrice", filters.maxPrice);
  appendString(params, "stock", filters.stock);
  appendString(params, "availability", filters.availability);
  appendBoolean(params, "expirySensitive", filters.expirySensitive);
  appendBoolean(params, "sterile", filters.sterile);
  appendBoolean(params, "disposable", filters.disposable);
  appendString(params, "medicalSpecialty", filters.medicalSpecialty);

  if (filters.sort !== DEFAULT_SORT) {
    params.set("sort", filters.sort);
  }

  if (filters.page > DEFAULT_PAGE) {
    params.set("page", String(filters.page));
  }

  return params;
}

export function productFiltersToHref(
  pathname: string,
  filters: ProductFilters,
  locked?: ProductFilterOverrides
) {
  const params = productFiltersToSearchParams(filters, locked).toString();

  return params ? `${pathname}?${params}` : pathname;
}

function compactFilters(filters: ProductFilters): ProductFilters {
  const nextFilters = { ...filters };

  if (
    nextFilters.minPrice !== undefined &&
    nextFilters.maxPrice !== undefined &&
    nextFilters.minPrice > nextFilters.maxPrice
  ) {
    const minPrice = nextFilters.maxPrice;
    nextFilters.maxPrice = nextFilters.minPrice;
    nextFilters.minPrice = minPrice;
  }

  return nextFilters;
}

function readString(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();

  return value ? value.slice(0, 160) : undefined;
}

function readNumber(params: URLSearchParams, key: string) {
  const rawValue = params.get(key);
  const value = rawValue === null ? Number.NaN : Number(rawValue);

  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function readPositiveInteger(params: URLSearchParams, key: string) {
  const rawValue = params.get(key);
  const value = rawValue === null ? Number.NaN : Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function readBoolean(params: URLSearchParams, key: string) {
  return params.get(key) === "true" ? true : undefined;
}

function readSort(params: URLSearchParams) {
  const value = params.get("sort") as ProductSort | null;

  return value && sortValues.has(value) ? value : undefined;
}

function readStock(params: URLSearchParams) {
  const value = params.get("stock") as ProductStockFilter | null;

  return value && stockValues.has(value) ? value : undefined;
}

function appendString(params: URLSearchParams, key: string, value: string | undefined) {
  if (value) {
    params.set(key, value);
  }
}

function appendNumber(params: URLSearchParams, key: string, value: number | undefined) {
  if (value !== undefined) {
    params.set(key, String(value));
  }
}

function appendBoolean(params: URLSearchParams, key: string, value: boolean | undefined) {
  if (value === true) {
    params.set(key, "true");
  }
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}
