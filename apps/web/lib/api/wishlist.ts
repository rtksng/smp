import { z } from "zod";
import { productListSchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

export const wishlistItemInputSchema = z.object({
  productId: z.string().min(1)
});

export type WishlistItemInput = z.infer<typeof wishlistItemInputSchema>;

export function getWishlist() {
  return requestCustomerApi("/wishlist", productListSchema);
}

export function addWishlistItem(input: WishlistItemInput) {
  const parsedInput = wishlistItemInputSchema.parse(input);

  return requestCustomerApi("/wishlist", productListSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function removeWishlistItem(productId: string) {
  return requestCustomerApi(
    `/wishlist/${encodeURIComponent(productId)}`,
    productListSchema,
    {
      method: "DELETE"
    }
  );
}
