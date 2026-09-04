import { queryKeys } from "../query";

export type PaymentMethod = "COD" | "ONLINE";

export function buildCheckoutQuoteKey(addressId: string | null, pincode?: string | null) {
  return [...queryKeys.cart(addressId), "checkout", pincode ?? null] as const;
}

export function calculateCheckoutTotal(
  totals: { subtotal: number; tax: number; deliveryCharge: number; discount: number },
  couponDiscount?: number | null
) {
  const discount = couponDiscount ?? totals.discount;
  return Math.max(0, Math.round((totals.subtotal + totals.tax + totals.deliveryCharge - discount) * 100) / 100);
}

export function buildCheckoutIdempotencyKey(
  timestamp = Date.now(),
  random = Math.random()
): string {
  const nonce = random.toString(36).slice(2, 8).padEnd(6, "0");

  return `mobile-checkout-${timestamp}-${nonce}`;
}

export function buildOrderSubmission(input: {
  couponCode?: string | null;
  idempotencyKey: string;
  paymentMethod: PaymentMethod;
  shippingAddressId: string;
}) {
  const couponCode = input.couponCode?.trim().toUpperCase() || null;

  return {
    body: {
      billingAddressId: null,
      couponCode,
      idempotencyKey: input.idempotencyKey,
      paymentMethod: input.paymentMethod,
      shippingAddressId: input.shippingAddressId
    },
    headers: {
      "Idempotency-Key": input.idempotencyKey
    }
  };
}
