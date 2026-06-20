import { z } from "zod";
import {
  resolveCustomerUploadUrl,
  resolveNullableCustomerUploadUrl
} from "../media/upload-url";

const uploadUrlSchema = z.string().transform(resolveCustomerUploadUrl);
const nullableUploadUrlSchema = z
  .string()
  .nullable()
  .transform(resolveNullableCustomerUploadUrl);

export const productStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "OUT_OF_STOCK"
]);

export const productImageSchema = z.object({
  altText: z.string().nullable(),
  id: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
  url: uploadUrlSchema
});

export const productBrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const productCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const productVariantSchema = z.object({
  attributes: z.record(z.string(), z.unknown()),
  id: z.string(),
  mrp: z.number(),
  name: z.string(),
  sellingPrice: z.number(),
  sku: z.string(),
  status: productStatusSchema
});

export const productDocumentSchema = z.object({
  fileKey: z.string(),
  fileUrl: uploadUrlSchema,
  id: z.string(),
  title: z.string(),
  type: z.string()
});

export const productSchema = z.object({
  basePrice: z.number(),
  brand: productBrandSchema,
  brandId: z.string(),
  category: productCategorySchema,
  categoryId: z.string(),
  createdAt: z.string(),
  description: z.string(),
  disposable: z.boolean(),
  documents: z.array(productDocumentSchema),
  expirySensitive: z.boolean(),
  id: z.string(),
  images: z.array(productImageSchema),
  inStock: z.boolean(),
  material: z.string().nullable(),
  medicalSpecialty: z.string().nullable(),
  metaDescription: z.string().nullable(),
  metaTitle: z.string().nullable(),
  mrp: z.number(),
  name: z.string(),
  packSize: z.string().nullable(),
  searchTags: z.array(z.string()),
  sellingPrice: z.number(),
  shortDescription: z.string(),
  sku: z.string(),
  slug: z.string(),
  status: productStatusSchema,
  sterile: z.boolean(),
  subcategory: productCategorySchema.nullable(),
  subcategoryId: z.string().nullable(),
  taxRate: z.number(),
  unit: z.string(),
  updatedAt: z.string(),
  variants: z.array(productVariantSchema)
});

export const productPaginationSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  limit: z.number(),
  page: z.number(),
  total: z.number(),
  totalPages: z.number()
});

export const productListSchema = z.object({
  items: z.array(productSchema),
  pagination: productPaginationSchema
});

const categoryBaseSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  imageUrl: nullableUploadUrlSchema,
  isActive: z.boolean(),
  name: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  sortOrder: z.number()
});

export type Category = z.infer<typeof categoryBaseSchema> & {
  children: Category[];
};

export const categorySchema: z.ZodType<Category> = categoryBaseSchema.extend({
  children: z.lazy(() => z.array(categorySchema))
});

export const brandSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  isActive: z.boolean(),
  logoUrl: nullableUploadUrlSchema,
  name: z.string(),
  slug: z.string()
});

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type ProductDocument = z.infer<typeof productDocumentSchema>;
