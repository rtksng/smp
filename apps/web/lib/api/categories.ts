import { z } from "zod";
import { requestApi } from "./client";
import { categorySchema } from "./schemas";

export function getCategories() {
  return requestApi("/categories", z.array(categorySchema));
}

export function getCategory(slug: string) {
  return requestApi(`/categories/${encodeURIComponent(slug)}`, categorySchema);
}
