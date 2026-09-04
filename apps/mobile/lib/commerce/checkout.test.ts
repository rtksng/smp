import { describe, expect, it } from "vitest";
import {
  buildCheckoutIdempotencyKey,
  buildCheckoutQuoteKey,
  buildOrderSubmission,
  calculateCheckoutTotal
} from "./checkout";

describe("buildCheckoutQuoteKey", () => {
  it("refreshes delivery when an address changes or its pincode is edited", () => {
    const key = buildCheckoutQuoteKey("address-1", "400001");
    expect(key.slice(0, 2)).toEqual(["customer", "cart"]);
    expect(buildCheckoutQuoteKey("address-1", "110001")).not.toEqual(key);
    expect(buildCheckoutQuoteKey("address-2", "400001")).not.toEqual(key);
    expect(buildCheckoutQuoteKey(null)).toEqual(["customer", "cart", "default", "checkout", null]);
  });
});

describe("calculateCheckoutTotal", () => {
  it("keeps the current delivery charge when a coupon is applied", () => {
    const totals = { subtotal: 1000, tax: 180, deliveryCharge: 50, discount: 0 };
    expect(calculateCheckoutTotal(totals, 100)).toBe(1130);
    expect(calculateCheckoutTotal({ ...totals, deliveryCharge: 150 }, 100)).toBe(1230);
    expect(calculateCheckoutTotal({ ...totals, deliveryCharge: 0 }, 100)).toBe(1080);
  });

  it("applies an existing discount once and rounds currency to two decimals", () => {
    expect(calculateCheckoutTotal({ subtotal: 1000, tax: 180, deliveryCharge: 50, discount: 20 })).toBe(1210);
    expect(calculateCheckoutTotal({ subtotal: 100.1, tax: 18.018, deliveryCharge: 50, discount: 0 })).toBe(168.12);
  });
});

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
