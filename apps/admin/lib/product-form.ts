import { z } from "zod";

export const PRODUCT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "OUT_OF_STOCK"
] as const;

export const PRODUCT_DOCUMENT_TYPES = [
  "CERTIFICATE",
  "COMPLIANCE",
  "MANUAL",
  "WARRANTY"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductDocumentType = (typeof PRODUCT_DOCUMENT_TYPES)[number];

export type AdminProductAsset = {
  id: string;
};

export type AdminProduct = {
  basePrice: number;
  brand: {
    id: string;
    name: string;
    slug: string;
  };
  brandId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  categoryId: string;
  createdAt: Date | string;
  description: string;
  disposable: boolean;
  documents: Array<{
    fileKey: string;
    fileUrl: string;
    id: string;
    title: string;
    type: ProductDocumentType;
  }>;
  expirySensitive: boolean;
  id: string;
  images: Array<{
    altText: string | null;
    id: string;
    isPrimary: boolean;
    sortOrder: number;
    url: string;
  }>;
  inStock: boolean;
  material: string | null;
  medicalSpecialty: string | null;
  metaDescription: string | null;
  metaTitle: string | null;
  mrp: number;
  name: string;
  packSize: string | null;
  searchTags: string[];
  sellingPrice: number;
  shortDescription: string;
  sku: string;
  slug: string;
  status: ProductStatus;
  sterile: boolean;
  taxRate: number;
  unit: string;
  updatedAt: Date | string;
  variants: Array<{
    attributes: Record<string, unknown>;
    id: string;
    mrp: number;
    name: string;
    sellingPrice: number;
    sku: string;
    status: ProductStatus;
  }>;
};

export type ProductListResponse = {
  items: AdminProduct[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type AdminBrand = {
  id: string;
  isActive: boolean;
  logoUrl: string | null;
  name: string;
  slug: string;
};

export type AdminCategory = {
  children: AdminCategory[];
  id: string;
  isActive: boolean;
  name: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
};

const skuPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const intPattern = /^\d+$/;

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} is too long.`);

const optionalText = (label: string, maxLength: number) =>
  z.string().trim().max(maxLength, `${label} is too long.`);

const amountString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => amountPattern.test(value), `Enter a valid ${label.toLowerCase()}.`);

const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(2048, `${label} is too long.`)
    .refine((value) => value === "" || isHttpUrl(value), `${label} must be a valid URL.`);

export const productImageFormSchema = z
  .object({
    altText: optionalText("Image alt text", 180),
    isPrimary: z.boolean(),
    sortOrder: z
      .string()
      .trim()
      .refine((value) => value === "" || intPattern.test(value), "Sort order must be a whole number."),
    url: optionalUrl("Image URL")
  })
  .superRefine((value, context) => {
    if (value.url === "" && value.altText !== "") {
      context.addIssue({
        code: "custom",
        message: "Image URL is required when image details are filled.",
        path: ["url"]
      });
    }
  });

export const productVariantFormSchema = z
  .object({
    attributesText: z.string().trim(),
    mrp: z.string().trim(),
    name: z.string().trim().max(120, "Variant name is too long."),
    sellingPrice: z.string().trim(),
    sku: z.string().trim().max(80, "Variant SKU is too long."),
    status: z.enum(PRODUCT_STATUSES)
  })
  .superRefine((value, context) => {
    if (!isVariantFilled(value)) {
      return;
    }

    if (value.name === "") {
      context.addIssue({
        code: "custom",
        message: "Variant name is required.",
        path: ["name"]
      });
    }
    if (!skuPattern.test(value.sku)) {
      context.addIssue({
        code: "custom",
        message: "Variant SKU must start with a letter or number and use only letters, numbers, dots, underscores, or hyphens.",
        path: ["sku"]
      });
    }
    if (!amountPattern.test(value.sellingPrice)) {
      context.addIssue({
        code: "custom",
        message: "Variant selling price is required.",
        path: ["sellingPrice"]
      });
    }
    if (!amountPattern.test(value.mrp)) {
      context.addIssue({
        code: "custom",
        message: "Variant MRP is required.",
        path: ["mrp"]
      });
    }
    if (!parseAttributesText(value.attributesText).success) {
      context.addIssue({
        code: "custom",
        message: "Variant attributes must be a JSON object.",
        path: ["attributesText"]
      });
    }
  });

export const productDocumentFormSchema = z
  .object({
    fileKey: z.string().trim().max(512, "Document file key is too long."),
    fileUrl: optionalUrl("Document URL"),
    title: z.string().trim().max(160, "Document title is too long."),
    type: z.enum(PRODUCT_DOCUMENT_TYPES)
  })
  .superRefine((value, context) => {
    if (!isDocumentFilled(value)) {
      return;
    }

    if (value.fileKey === "") {
      context.addIssue({
        code: "custom",
        message: "Document file key is required.",
        path: ["fileKey"]
      });
    }
    if (value.fileUrl === "") {
      context.addIssue({
        code: "custom",
        message: "Document URL is required.",
        path: ["fileUrl"]
      });
    }
    if (value.title === "") {
      context.addIssue({
        code: "custom",
        message: "Document title is required.",
        path: ["title"]
      });
    }
  });

export const productFormSchema = z
  .object({
    basePrice: amountString("Base price"),
    brandId: requiredText("Brand", 120),
    categoryId: requiredText("Category", 120),
    description: requiredText("Description", 5000),
    disposable: z.boolean(),
    documents: z.array(productDocumentFormSchema).max(20, "Add no more than 20 documents."),
    expirySensitive: z.boolean(),
    images: z.array(productImageFormSchema).max(20, "Add no more than 20 images."),
    material: optionalText("Material", 120),
    medicalSpecialty: optionalText("Medical specialty", 120),
    metaDescription: optionalText("Meta description", 320),
    metaTitle: optionalText("Meta title", 160),
    mrp: amountString("MRP"),
    name: requiredText("Name", 180),
    packSize: optionalText("Pack size", 80),
    searchTags: z.string().trim(),
    sellingPrice: amountString("Selling price"),
    shortDescription: requiredText("Short description", 500),
    sku: requiredText("SKU", 80).regex(
      skuPattern,
      "SKU must start with a letter or number and use only letters, numbers, dots, underscores, or hyphens."
    ),
    slug: requiredText("Slug", 180).regex(
      slugPattern,
      "Slug must use lowercase letters, numbers, and hyphen separators."
    ),
    status: z.enum(PRODUCT_STATUSES),
    sterile: z.boolean(),
    taxRate: amountString("Tax rate"),
    unit: requiredText("Unit", 40),
    variants: z.array(productVariantFormSchema).max(50, "Add no more than 50 variants.")
  })
  .superRefine((value, context) => {
    const mrp = Number(value.mrp);
    const sellingPrice = Number(value.sellingPrice);
    const basePrice = Number(value.basePrice);
    const taxRate = Number(value.taxRate);

    if (taxRate > 100) {
      context.addIssue({
        code: "custom",
        message: "Tax rate cannot be greater than 100.",
        path: ["taxRate"]
      });
    }
    if (basePrice > mrp) {
      context.addIssue({
        code: "custom",
        message: "Base price cannot be greater than MRP.",
        path: ["basePrice"]
      });
    }
    if (sellingPrice > mrp) {
      context.addIssue({
        code: "custom",
        message: "Selling price cannot be greater than MRP.",
        path: ["sellingPrice"]
      });
    }

    const primaryImageCount = value.images.filter(
      (image) => image.url !== "" && image.isPrimary
    ).length;
    if (primaryImageCount > 1) {
      context.addIssue({
        code: "custom",
        message: "Only one product image can be primary.",
        path: ["images"]
      });
    }

    value.variants.forEach((variant, index) => {
      if (
        isVariantFilled(variant) &&
        amountPattern.test(variant.sellingPrice) &&
        amountPattern.test(variant.mrp) &&
        Number(variant.sellingPrice) > Number(variant.mrp)
      ) {
        context.addIssue({
          code: "custom",
          message: "Variant selling price cannot be greater than variant MRP.",
          path: ["variants", index, "sellingPrice"]
        });
      }
    });
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type ProductPayload = {
  basePrice: number;
  brandId: string;
  categoryId: string;
  description: string;
  disposable: boolean;
  documents: Array<{
    fileKey: string;
    fileUrl: string;
    title: string;
    type: ProductDocumentType;
  }>;
  expirySensitive: boolean;
  images: Array<{
    altText: string | null;
    isPrimary: boolean;
    sortOrder: number;
    url: string;
  }>;
  material: string | null;
  medicalSpecialty: string | null;
  metaDescription: string | null;
  metaTitle: string | null;
  mrp: number;
  name: string;
  packSize: string | null;
  searchTags: string[];
  sellingPrice: number;
  shortDescription: string;
  sku: string;
  slug: string;
  status: ProductStatus;
  sterile: boolean;
  taxRate: number;
  unit: string;
  variants: Array<{
    attributes: Record<string, unknown>;
    mrp: number;
    name: string;
    sellingPrice: number;
    sku: string;
    status: ProductStatus;
  }>;
};

export function createEmptyProductFormValues(): ProductFormValues {
  return {
    basePrice: "",
    brandId: "",
    categoryId: "",
    description: "",
    disposable: false,
    documents: [],
    expirySensitive: false,
    images: [],
    material: "",
    medicalSpecialty: "",
    metaDescription: "",
    metaTitle: "",
    mrp: "",
    name: "",
    packSize: "",
    searchTags: "",
    sellingPrice: "",
    shortDescription: "",
    sku: "",
    slug: "",
    status: "DRAFT",
    sterile: false,
    taxRate: "0",
    unit: "piece",
    variants: []
  };
}

export function createEmptyImageFormValue(): ProductFormValues["images"][number] {
  return {
    altText: "",
    isPrimary: false,
    sortOrder: "0",
    url: ""
  };
}

export function createEmptyVariantFormValue(): ProductFormValues["variants"][number] {
  return {
    attributesText: "{}",
    mrp: "",
    name: "",
    sellingPrice: "",
    sku: "",
    status: "ACTIVE"
  };
}

export function createEmptyDocumentFormValue(): ProductFormValues["documents"][number] {
  return {
    fileKey: "",
    fileUrl: "",
    title: "",
    type: "MANUAL"
  };
}

export function buildProductPayload(values: ProductFormValues): ProductPayload {
  return {
    basePrice: Number(values.basePrice),
    brandId: values.brandId,
    categoryId: values.categoryId,
    description: values.description,
    disposable: values.disposable,
    documents: values.documents.filter(isDocumentFilled).map((document) => ({
      fileKey: document.fileKey,
      fileUrl: document.fileUrl,
      title: document.title,
      type: document.type
    })),
    expirySensitive: values.expirySensitive,
    images: values.images.filter((image) => image.url !== "").map((image) => ({
      altText: blankToNull(image.altText),
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder === "" ? 0 : Number(image.sortOrder),
      url: image.url
    })),
    material: blankToNull(values.material),
    medicalSpecialty: blankToNull(values.medicalSpecialty),
    metaDescription: blankToNull(values.metaDescription),
    metaTitle: blankToNull(values.metaTitle),
    mrp: Number(values.mrp),
    name: values.name,
    packSize: blankToNull(values.packSize),
    searchTags: normalizeTags(values.searchTags),
    sellingPrice: Number(values.sellingPrice),
    shortDescription: values.shortDescription,
    sku: values.sku,
    slug: values.slug,
    status: values.status,
    sterile: values.sterile,
    taxRate: Number(values.taxRate),
    unit: values.unit,
    variants: values.variants.filter(isVariantFilled).map((variant) => ({
      attributes: parseAttributesText(variant.attributesText).value ?? {},
      mrp: Number(variant.mrp),
      name: variant.name,
      sellingPrice: Number(variant.sellingPrice),
      sku: variant.sku,
      status: variant.status
    }))
  };
}

export function productToFormValues(product: AdminProduct): ProductFormValues {
  return {
    basePrice: numberToString(product.basePrice),
    brandId: product.brandId,
    categoryId: product.categoryId,
    description: product.description,
    disposable: product.disposable,
    documents: product.documents.map((document) => ({
      fileKey: document.fileKey,
      fileUrl: document.fileUrl,
      title: document.title,
      type: document.type
    })),
    expirySensitive: product.expirySensitive,
    images: product.images.map((image) => ({
      altText: image.altText ?? "",
      isPrimary: image.isPrimary,
      sortOrder: numberToString(image.sortOrder),
      url: image.url
    })),
    material: product.material ?? "",
    medicalSpecialty: product.medicalSpecialty ?? "",
    metaDescription: product.metaDescription ?? "",
    metaTitle: product.metaTitle ?? "",
    mrp: numberToString(product.mrp),
    name: product.name,
    packSize: product.packSize ?? "",
    searchTags: product.searchTags.join(", "),
    sellingPrice: numberToString(product.sellingPrice),
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    status: product.status,
    sterile: product.sterile,
    taxRate: numberToString(product.taxRate),
    unit: product.unit,
    variants: product.variants.map((variant) => ({
      attributesText: JSON.stringify(variant.attributes ?? {}, null, 2),
      mrp: numberToString(variant.mrp),
      name: variant.name,
      sellingPrice: numberToString(variant.sellingPrice),
      sku: variant.sku,
      status: variant.status
    }))
  };
}

export function slugifyProductName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function flattenCategories(categories: AdminCategory[]) {
  const flattened: Array<AdminCategory & { depth: number }> = [];

  const visit = (category: AdminCategory, depth: number) => {
    flattened.push({ ...category, depth });
    category.children.forEach((child) => visit(child, depth + 1));
  };

  categories.forEach((category) => visit(category, 0));

  return flattened;
}

function normalizeTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const tag of value.split(/[,\n]/)) {
    const normalizedTag = tag.trim().replace(/\s+/g, " ").toLowerCase();

    if (normalizedTag && !seen.has(normalizedTag)) {
      seen.add(normalizedTag);
      tags.push(normalizedTag);
    }
  }

  return tags;
}

function blankToNull(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function numberToString(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isVariantFilled(value: {
  attributesText: string;
  mrp: string;
  name: string;
  sellingPrice: string;
  sku: string;
}) {
  return Boolean(
    value.name ||
      value.sku ||
      value.sellingPrice ||
      value.mrp ||
      (value.attributesText && value.attributesText !== "{}")
  );
}

function isDocumentFilled(value: {
  fileKey: string;
  fileUrl: string;
  title: string;
}) {
  return Boolean(value.fileKey || value.fileUrl || value.title);
}

function parseAttributesText(value: string):
  | { success: true; value: Record<string, unknown> }
  | { success: false; value?: undefined } {
  if (value === "") {
    return {
      success: true,
      value: {}
    };
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { success: false };
    }

    return {
      success: true,
      value: parsed as Record<string, unknown>
    };
  } catch {
    return { success: false };
  }
}
