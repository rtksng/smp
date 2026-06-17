import type { Brand, Category, ProductList } from "../api/schemas";
import {
  buildCategoryNavigation,
  type CategoryNavigationItem
} from "./customer-navigation";

const LANDING_CATEGORY_LIMIT = 10;
const FEATURED_CATEGORY_SECTION_LIMIT = 5;
const LANDING_PRODUCT_LIMIT = 4;
const HOME_BRAND_PREVIEW_LIMIT = 8;

export type BrandLogoFilter = "all" | "with-logo" | "without-logo";

export type BrandDirectoryFilters = {
  logo?: BrandLogoFilter;
  query?: string;
};

export function getLandingCategoryLimit() {
  return LANDING_CATEGORY_LIMIT;
}

export function getLandingProductLimit() {
  return LANDING_PRODUCT_LIMIT;
}

export function getFeaturedCategorySectionLimit() {
  return FEATURED_CATEGORY_SECTION_LIMIT;
}

export function getHomeBrandPreviewLimit() {
  return HOME_BRAND_PREVIEW_LIMIT;
}

export function selectLandingCategories(
  categories: Category[] | undefined,
  limit = LANDING_CATEGORY_LIMIT
): CategoryNavigationItem[] {
  return buildCategoryNavigation(categories, limit);
}

export function selectFeaturedCategorySections(
  categories: Category[] | undefined,
  limit = FEATURED_CATEGORY_SECTION_LIMIT
): CategoryNavigationItem[] {
  return buildCategoryNavigation(categories, limit);
}

export function selectProductReadyFeaturedCategories(
  categories: CategoryNavigationItem[],
  productsByCategorySlug: Record<string, ProductList | undefined>,
  limit = FEATURED_CATEGORY_SECTION_LIMIT,
  minimumProducts = LANDING_PRODUCT_LIMIT
) {
  return categories
    .filter(
      (category) =>
        (productsByCategorySlug[category.slug]?.items.length ?? 0) >= minimumProducts
    )
    .slice(0, limit);
}

export function selectPreviewBrands(
  brands: Brand[] | undefined,
  limit = HOME_BRAND_PREVIEW_LIMIT
) {
  return activeBrands(brands).slice(0, limit);
}

export function filterBrandsForDirectory(
  brands: Brand[] | undefined,
  filters: BrandDirectoryFilters = {}
) {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const logo = filters.logo ?? "all";

  return activeBrands(brands).filter((brand) => {
    const searchableText = [
      brand.name,
      brand.slug,
      brand.description ?? ""
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = query ? searchableText.includes(query) : true;
    const matchesLogo =
      logo === "with-logo"
        ? Boolean(brand.logoUrl)
        : logo === "without-logo"
          ? !brand.logoUrl
          : true;

    return matchesQuery && matchesLogo;
  });
}

function activeBrands(brands: Brand[] | undefined) {
  return (brands ?? [])
    .filter((brand) => brand.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
}
