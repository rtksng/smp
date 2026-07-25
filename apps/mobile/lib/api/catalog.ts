import { z } from "zod";
import {
  brandSchema,
  categorySchema,
  productListSchema,
  productSchema
} from "./schemas";
import { requestApi, type QueryParams } from "./client";

export type ProductQuery = {
  brand?: string;
  category?: string;
  inStock?: boolean;
  limit?: number;
  maxPrice?: number;
  minPrice?: number;
  page?: number;
  search?: string;
  sort?: "latest" | "name_az" | "price_high_to_low" | "price_low_to_high";
  subcategory?: string;
};

export function getProducts(query: ProductQuery = {}) {
  return requestApi("/products", productListSchema, {
    query: query as QueryParams
  });
}

export function getProduct(slug: string) {
  return requestApi(`/products/${encodeURIComponent(slug)}`, productSchema);
}

export function getCategories() {
  return requestApi("/categories", z.array(categorySchema));
}

export function getBrands() {
  return requestApi("/brands", z.array(brandSchema));
}
