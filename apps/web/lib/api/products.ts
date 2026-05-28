import { z } from "zod";
import { requestApi } from "./client";
import { productListSchema, productSchema } from "./schemas";

export const productQuerySchema = z.object({
  brand: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().min(1).max(160).optional(),
  disposable: z.boolean().optional(),
  expirySensitive: z.boolean().optional(),
  inStock: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  maxPrice: z.number().min(0).optional(),
  medicalSpecialty: z.string().trim().min(1).max(160).optional(),
  minPrice: z.number().min(0).optional(),
  page: z.number().int().min(1).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  sort: z
    .enum(["latest", "name_az", "price_high_to_low", "price_low_to_high"])
    .optional(),
  sterile: z.boolean().optional()
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export function getProducts(query: ProductQuery = {}) {
  const parsedQuery = productQuerySchema.parse(query);

  return requestApi("/products", productListSchema, {
    query: parsedQuery
  });
}

export function getProduct(slug: string) {
  return requestApi(`/products/${encodeURIComponent(slug)}`, productSchema);
}
