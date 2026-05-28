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
  logoUrl: optionalUrl("Logo URL"),
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

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}
