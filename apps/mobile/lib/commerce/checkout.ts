export type PaymentMethod = "COD" | "ONLINE";

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
