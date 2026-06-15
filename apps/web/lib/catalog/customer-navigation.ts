import type { Category } from "../api/schemas";

export type CategoryNavigationChild = {
  href: string;
  id: string;
  label: string;
  slug: string;
};

export type CategoryNavigationItem = CategoryNavigationChild & {
  children: CategoryNavigationChild[];
  description: string | null;
  imageUrl: string | null;
};

export type MarketplaceNavItem = CategoryNavigationChild & {
  source: "category" | "route";
};

export function buildCategoryNavigation(
  categories: Category[] | undefined,
  limit?: number
): CategoryNavigationItem[] {
  const activeCategories = sortCategories(categories ?? [])
    .filter((category) => category.isActive)
    .slice(0, limit);

  return activeCategories.map((category) => ({
    children: sortCategories(category.children)
      .filter((subcategory) => subcategory.isActive)
      .map((subcategory) => ({
        href: `/categories/${category.slug}?subcategory=${subcategory.slug}`,
        id: subcategory.id,
        label: subcategory.name,
        slug: subcategory.slug
      })),
    description: category.description,
    href: `/categories/${category.slug}`,
    id: category.id,
    imageUrl: category.imageUrl,
    label: category.name,
    slug: category.slug
  }));
}

export function getFeaturedCategoryLinks(
  categories: Category[] | undefined,
  limit = 8
): CategoryNavigationChild[] {
  return buildCategoryNavigation(categories, limit).map(
    ({ href, id, label, slug }) => ({
      href,
      id,
      label,
      slug
    })
  );
}

export function buildMarketplaceNavItems(
  categories: Category[] | undefined,
  categoryLimit = 6
): MarketplaceNavItem[] {
  return [
    {
      href: "/products",
      id: "all-products",
      label: "All products",
      slug: "products",
      source: "route"
    },
    ...getFeaturedCategoryLinks(categories, categoryLimit).map((category) => ({
      ...category,
      source: "category" as const
    })),
    {
      href: "/#brands",
      id: "brands",
      label: "Brands",
      slug: "brands",
      source: "route"
    },
    {
      href: "/#bulk",
      id: "bulk-quotes",
      label: "Bulk quotes",
      slug: "bulk-quotes",
      source: "route"
    }
  ];
}

function sortCategories(categories: Category[]) {
  return [...categories].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}
