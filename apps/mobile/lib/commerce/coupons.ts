import type { AvailableCoupon, CouponValidation } from "../api/coupons";
import type { Cart } from "../api/schemas";

export type CouponSelection = { cartKey: string; validation: CouponValidation };

export function getCouponCartKey(cart?: Cart) {
  return JSON.stringify([
    cart?.id, cart?.totals.subtotal, cart?.totals.tax,
    cart?.items.map(item => [item.id, item.quantity, item.unitPrice, item.subtotal, item.tax])
  ]);
}

export function isCouponSelectionStale(selection: CouponSelection | null, cart?: Cart) {
  return Boolean(selection && (
    selection.cartKey !== getCouponCartKey(cart) ||
    selection.validation.subtotal !== cart?.totals.subtotal ||
    selection.validation.tax !== cart?.totals.tax
  ));
}

export function getAvailableCouponState(coupon: AvailableCoupon, subtotal: number, appliedCode: string | null) {
  const remaining = Math.max(0, (coupon.minOrderAmount ?? 0) - subtotal);
  const isApplied = appliedCode?.toUpperCase() === coupon.code.toUpperCase();
  return { remaining, isApplied, canApply: !isApplied && remaining === 0 };
}
