import { z } from "zod";

export type AdminCategory = {
  children: AdminCategory[];
  description?: string | null;
  id: string;
  imageUrl?: string | null;
  isActive: boolean;
  name: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
};

export type AdminBrand = {
  description?: string | null;
  id: string;
  isActive: boolean;
  logoUrl: string | null;
  name: string;
  slug: string;
};

export type CategoryOption = AdminCategory & {
  depth: number;
};

export const BRAND_LIST_PATH = "/brands";
export const BRAND_CREATE_PATH = "/brands/create";
export const BRAND_BULK_CREATE_PATH = "/brands/bulk-create";
export const CATEGORY_LIST_PATH = "/categories";
export const CATEGORY_CREATE_PATH = "/categories/create";
export const CATEGORY_BULK_CREATE_PATH = "/categories/bulk-create";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.string().url().safeParse(value).success,
      `${label} must be a valid URL.`
    );

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} is too long.`);

const optionalText = (label: string, maxLength: number) =>
  z.string().trim().max(maxLength, `${label} is too long.`);

const optionalWholeNumberString = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: `${label} must be a whole number.`
    });

export const categoryFormSchema = z.object({
  description: optionalText("Description", 1000),
  imageUrl: optionalUrl("Image URL"),
  isActive: z.boolean(),
  name: requiredText("Name", 120),
  parentId: z.string().trim(),
  slug: requiredText("Slug", 160).regex(
    slugPattern,
    "Slug must use lowercase letters, numbers, and hyphen separators."
  ),
  sortOrder: optionalWholeNumberString("Sort order")
});

export const brandFormSchema = z.object({
  description: optionalText("Description", 1000),
  isActive: z.boolean(),
  logoUrl: optionalUrl("Brand image"),
  name: requiredText("Name", 120),
  slug: requiredText("Slug", 160).regex(
    slugPattern,
    "Slug must use lowercase letters, numbers, and hyphen separators."
  )
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
export type ParsedCategoryFormValues = z.output<typeof categoryFormSchema>;
export type BrandFormValues = z.input<typeof brandFormSchema>;
export type ParsedBrandFormValues = z.output<typeof brandFormSchema>;

export function createEmptyCategoryFormValues(): CategoryFormValues {
  return {
    description: "",
    imageUrl: "",
    isActive: true,
    name: "",
    parentId: "",
    slug: "",
    sortOrder: "0"
  };
}

export function createEmptyBrandFormValues(): BrandFormValues {
  return {
    description: "",
    isActive: true,
    logoUrl: "",
    name: "",
    slug: ""
  };
}

export function buildCategoryPayload(values: ParsedCategoryFormValues) {
  return {
    description: blankToNull(values.description),
    imageUrl: blankToNull(values.imageUrl),
    isActive: values.isActive,
    name: values.name.trim(),
    parentId: blankToNull(values.parentId),
    slug: values.slug.trim(),
    sortOrder: values.sortOrder === "" ? 0 : Number(values.sortOrder)
  };
}

export function buildBrandPayload(values: ParsedBrandFormValues) {
  return {
    description: blankToNull(values.description),
    isActive: values.isActive,
    logoUrl: blankToNull(values.logoUrl),
    name: values.name.trim(),
    slug: values.slug.trim()
  };
}

export function categoryToFormValues(category: AdminCategory): CategoryFormValues {
  return {
    description: category.description ?? "",
    imageUrl: category.imageUrl ?? "",
    isActive: category.isActive,
    name: category.name,
    parentId: category.parentId ?? "",
    slug: category.slug,
    sortOrder: String(category.sortOrder)
  };
}

export function brandToFormValues(brand: AdminBrand): BrandFormValues {
  return {
    description: brand.description ?? "",
    isActive: brand.isActive,
    logoUrl: brand.logoUrl ?? "",
    name: brand.name,
    slug: brand.slug
  };
}

export function flattenCategoryOptions(
  categories: AdminCategory[],
  depth = 0
): CategoryOption[] {
  return categories.flatMap((category) => [
    {
      ...category,
      depth
    },
    ...flattenCategoryOptions(category.children ?? [], depth + 1)
  ]);
}

export function getRootCategoryOptions(
  categories: AdminCategory[],
  excludedCategoryId?: string | null
): CategoryOption[] {
  return categories
    .filter((category) => category.id !== excludedCategoryId)
    .map((category) => ({
      ...category,
      depth: 0
    }));
}

export function filterRootCategories(categories: AdminCategory[], search: string) {
  const searchText = search.trim().toLowerCase();

  if (!searchText) {
    return categories;
  }

  return categories.filter(
    (category) =>
      categoryMatchesSearch(category, searchText) ||
      category.children.some((child) => categoryMatchesSearch(child, searchText))
  );
}

export function formatChildCategoryCount(count: number) {
  return `${count} child ${count === 1 ? "category" : "categories"}`;
}

export function slugifyCatalogName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatCatalogStatus(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}

export function buildBrandEditPath(brandId: string) {
  return `${BRAND_LIST_PATH}/${encodeURIComponent(brandId)}/edit`;
}

export function buildCategoryEditPath(categoryId: string) {
  return `${CATEGORY_LIST_PATH}/${encodeURIComponent(categoryId)}/edit`;
}

export function getBrandRouteId(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const brandId = rawValue?.trim();

  return brandId ? brandId : null;
}

export function getCategoryRouteId(value: string | string[] | null | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const categoryId = rawValue?.trim();

  return categoryId ? categoryId : null;
}

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function categoryMatchesSearch(category: AdminCategory, searchText: string) {
  return (
    category.name.toLowerCase().includes(searchText) ||
    category.slug.toLowerCase().includes(searchText)
  );
}
