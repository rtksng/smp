import { z } from "zod";
import { productListSchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

const wishlistItemInputSchema = z.object({
  productId: z.string().min(1)
});

export function getWishlist() {
  return requestCustomerApi("/wishlist", productListSchema);
}

export function addWishlistItem(productId: string) {
  return requestCustomerApi("/wishlist", productListSchema, {
    body: wishlistItemInputSchema.parse({ productId }),
    method: "POST"
  });
}

export function removeWishlistItem(productId: string) {
  return requestCustomerApi(
    `/wishlist/${encodeURIComponent(productId)}`,
    productListSchema,
    { method: "DELETE" }
  );
}
