import { z } from "zod";
import { productBrandSchema, productCategorySchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

const productStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "OUT_OF_STOCK"
]);

export const cartTotalsSchema = z.object({
  deliveryCharge: z.number(),
  discount: z.number(),
  grandTotal: z.number(),
  subtotal: z.number(),
  tax: z.number()
});

export const cartItemSchema = z.object({
  availableQuantity: z.number(),
  brand: productBrandSchema,
  category: productCategorySchema,
  createdAt: z.string(),
  id: z.string(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  name: z.string(),
  productId: z.string(),
  productStatus: productStatusSchema,
  quantity: z.number(),
  sku: z.string(),
  slug: z.string(),
  subcategory: productCategorySchema.nullable(),
  subtotal: z.number(),
  tax: z.number(),
  taxRate: z.number(),
  total: z.number(),
  unitPrice: z.number(),
  updatedAt: z.string(),
  variantId: z.string().nullable(),
  variantName: z.string().nullable(),
  variantStatus: productStatusSchema.nullable()
});

export const cartSchema = z.object({
  id: z.string(),
  itemCount: z.number(),
  items: z.array(cartItemSchema),
  totalQuantity: z.number(),
  totals: cartTotalsSchema,
  updatedAt: z.string()
});

export const addCartItemInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).max(999),
  variantId: z.string().nullable().optional()
});

export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type CartTotals = z.infer<typeof cartTotalsSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>;

export function getCart(shippingAddressId?: string | null) {
  return requestCustomerApi("/cart", cartSchema, {
    query: {
      shippingAddressId: shippingAddressId ?? undefined
    }
  });
}

export function addCartItem(input: AddCartItemInput) {
  const parsedInput = addCartItemInputSchema.parse(input);

  return requestCustomerApi("/cart/items", cartSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function buyNowCartItem(input: AddCartItemInput) {
  const parsedInput = addCartItemInputSchema.parse(input);

  return requestCustomerApi("/cart/buy-now", cartSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function updateCartItem(itemId: string, quantity: number) {
  return requestCustomerApi(`/cart/items/${encodeURIComponent(itemId)}`, cartSchema, {
    body: JSON.stringify({ quantity }),
    method: "PATCH"
  });
}

export function removeCartItem(itemId: string) {
  return requestCustomerApi(`/cart/items/${encodeURIComponent(itemId)}`, cartSchema, {
    method: "DELETE"
  });
}

export function clearCart() {
  return requestCustomerApi("/cart", cartSchema, {
    method: "DELETE"
  });
}
