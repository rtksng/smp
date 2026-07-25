import { cartSchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

export function getCart(shippingAddressId?: string | null) {
  return requestCustomerApi("/cart", cartSchema, {
    query: { shippingAddressId: shippingAddressId ?? undefined }
  });
}

export function addCartItem(input: {
  productId: string;
  quantity: number;
  variantId?: string | null;
}) {
  return requestCustomerApi("/cart/items", cartSchema, {
    body: input,
    method: "POST"
  });
}

export function buyNow(input: {
  productId: string;
  quantity: number;
  variantId?: string | null;
}) {
  return requestCustomerApi("/cart/buy-now", cartSchema, {
    body: input,
    method: "POST"
  });
}

export function updateCartItem(itemId: string, quantity: number) {
  return requestCustomerApi(
    `/cart/items/${encodeURIComponent(itemId)}`,
    cartSchema,
    {
      body: { quantity },
      method: "PATCH"
    }
  );
}

export function removeCartItem(itemId: string) {
  return requestCustomerApi(
    `/cart/items/${encodeURIComponent(itemId)}`,
    cartSchema,
    { method: "DELETE" }
  );
}
