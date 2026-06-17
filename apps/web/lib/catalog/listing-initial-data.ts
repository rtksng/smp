import { getBrand, getBrands } from "../api/brands";
import { getCategories, getCategory } from "../api/categories";
import { getProducts } from "../api/products";
import type { Brand, Category, ProductList } from "../api/schemas";
import {
  parseProductFilters,
  productFiltersToProductQuery,
  type ProductFilters
} from "./product-filters";

export type ProductListingContext =
  | {
      type: "all";
    }
  | {
      slug: string;
      type: "category";
    }
  | {
      slug: string;
      subcategorySlug: string;
      type: "subcategory";
    }
  | {
      slug: string;
      type: "brand";
    };

export type ProductListingSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type ProductListingInitialData = {
  brand?: Brand;
  brands?: Brand[];
  categories?: Category[];
  category?: Category;
  products?: ProductList;
};

export type ProductListingServerData = {
  data: ProductListingInitialData;
  filters: ProductFilters;
};

export async function getProductListingInitialData(
  context: ProductListingContext,
  rawSearchParams: ProductListingSearchParams = {}
): Promise<ProductListingServerData> {
  const lockedFilters = getLockedProductFilters(context);
  const categorySlug =
    context.type === "category" || context.type === "subcategory"
      ? context.slug
      : undefined;
  const filters = parseProductFilters(
    searchParamsToUrlSearchParams(rawSearchParams),
    lockedFilters
  );
  const [products, categories, brands, category, brand] = await Promise.all([
    safeRead(getProducts(productFiltersToProductQuery(filters))),
    safeRead(getCategories()),
    safeRead(getBrands()),
    categorySlug ? safeRead(getCategory(categorySlug)) : undefined,
    context.type === "brand" ? safeRead(getBrand(context.slug)) : undefined
  ]);

  return {
    data: {
      brand,
      brands,
      categories,
      category,
      products
    },
    filters
  };
}

export function getLockedProductFilters(context: ProductListingContext) {
  if (context.type === "category") {
    return {
      category: context.slug
    };
  }

  if (context.type === "subcategory") {
    return {
      category: context.slug,
      subcategory: context.subcategorySlug
    };
  }

  if (context.type === "brand") {
    return {
      brand: context.slug
    };
  }

  return {};
}

export function searchParamsToUrlSearchParams(
  rawSearchParams: ProductListingSearchParams
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        searchParams.append(key, entry);
      }
    } else if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

async function safeRead<T>(promise: Promise<T> | undefined): Promise<T | undefined> {
  if (!promise) {
    return undefined;
  }

  try {
    return await promise;
  } catch {
    return undefined;
  }
}
