import { describe, expect, it } from "vitest";
import {
  buildCheckoutIdempotencyKey,
  buildOrderSubmission
} from "./checkout";

describe("buildCheckoutIdempotencyKey", () => {
  it("returns an API-safe stable key for one checkout attempt", () => {
    expect(buildCheckoutIdempotencyKey(1_721_862_400_000, 0.123456)).toBe(
      "mobile-checkout-1721862400000-4fzyo8"
    );
  });
});

describe("buildOrderSubmission", () => {
  it("includes the idempotency key in both body and header", () => {
    expect(
      buildOrderSubmission({
        couponCode: " save10 ",
        idempotencyKey: "mobile-checkout-1-abc",
        paymentMethod: "COD",
        shippingAddressId: "address-1"
      })
    ).toEqual({
      body: {
        billingAddressId: null,
        couponCode: "SAVE10",
        idempotencyKey: "mobile-checkout-1-abc",
        paymentMethod: "COD",
        shippingAddressId: "address-1"
      },
      headers: {
        "Idempotency-Key": "mobile-checkout-1-abc"
      }
    });
  });
});
