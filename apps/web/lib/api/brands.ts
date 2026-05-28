import { z } from "zod";
import { requestApi } from "./client";
import { brandSchema } from "./schemas";

export function getBrands() {
  return requestApi("/brands", z.array(brandSchema));
}

export function getBrand(slug: string) {
  return requestApi(`/brands/${encodeURIComponent(slug)}`, brandSchema);
}
