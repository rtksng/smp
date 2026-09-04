import { describe, expect, it } from "vitest";
import { availableCouponFixture, cartFixture, couponValidationFixture } from "../testing/commerce-fixtures";
import { getAvailableCouponState, getCouponCartKey, isCouponSelectionStale } from "./coupons";
import { calculateCheckoutTotal } from "./checkout";

describe("mobile promo pricing", () => {
  it("keeps quoted shipping while applying a coupon and restores totals when removed", () => {
    const cart = cartFixture();
    expect(calculateCheckoutTotal(cart.totals, 50)).toBe(565.5);
    expect(calculateCheckoutTotal(cart.totals, null)).toBe(615.5);
  });

  it("invalidates a discount when cart contents or quoted prices change, but not shipping alone", () => {
    const cart = cartFixture();
    const selection = { cartKey: getCouponCartKey(cart), validation: couponValidationFixture };
    expect(isCouponSelectionStale(selection, cart)).toBe(false);
    cart.totals.deliveryCharge = 75;
    expect(isCouponSelectionStale(selection, cart)).toBe(false);
    cart.items[0]!.quantity = 2;
    expect(isCouponSelectionStale(selection, cart)).toBe(true);
    cart.items[0]!.quantity = 1;
    cart.items[0]!.unitPrice = 700;
    expect(isCouponSelectionStale(selection, cart)).toBe(true);
    expect(isCouponSelectionStale({ ...selection, validation: { ...couponValidationFixture, tax: 100 } }, cartFixture())).toBe(true);
  });

  it("enforces minimum spend and recognizes the currently applied code", () => {
    expect(getAvailableCouponState(availableCouponFixture, 499, null)).toMatchObject({ remaining: 1, canApply: false });
    expect(getAvailableCouponState(availableCouponFixture, 500, null).canApply).toBe(true);
    expect(getAvailableCouponState(availableCouponFixture, 500, "save50")).toMatchObject({ isApplied: true, canApply: false });
  });
});
