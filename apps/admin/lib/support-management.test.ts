import { describe, expect, it } from "vitest";
import {
  buildCouponPayload,
  buildCouponQuery,
  buildProductFeedbackQuery,
  buildQuoteRequestQuery,
  couponToFormValues,
  createEmptyCouponFilters,
  createEmptyCouponFormValues,
  createEmptyProductFeedbackFilters,
  createEmptyQuoteRequestFilters,
  formatSupportDateTime,
  formatSupportLabel,
  type AdminCoupon
} from "./support-management";

describe("admin support management helpers", () => {
  it("builds quote, coupon, and feedback queries without empty filters", () => {
    expect(
      buildQuoteRequestQuery(
        { ...createEmptyQuoteRequestFilters(), status: "CONTACTED" },
        2,
        15
      )
    ).toEqual({
      limit: 15,
      page: 2,
      status: "CONTACTED"
    });

    expect(
      buildCouponQuery({ ...createEmptyCouponFilters(), search: " surg " }, 3, 10)
    ).toEqual({
      limit: 10,
      page: 3,
      search: "surg"
    });

    expect(
      buildProductFeedbackQuery(
        {
          ...createEmptyProductFeedbackFilters(),
          productId: "product-1",
          status: "PENDING",
          type: "QUESTION"
        },
        4,
        25
      )
    ).toEqual({
      limit: 25,
      page: 4,
      productId: "product-1",
      status: "PENDING",
      type: "QUESTION"
    });
  });

  it("normalizes coupon form values for create and update requests", () => {
    expect(
      buildCouponPayload({
        ...createEmptyCouponFormValues(),
        code: " surgical10 ",
        maxDiscount: "300",
        minOrderAmount: "1000",
        startsAt: "2026-06-01",
        usageLimit: "50",
        value: "10"
      })
    ).toEqual({
      code: "SURGICAL10",
      expiresAt: null,
      isActive: true,
      maxDiscount: 300,
      minOrderAmount: 1000,
      startsAt: "2026-06-01",
      type: "PERCENTAGE",
      usageLimit: 50,
      value: 10
    });
  });

  it("maps coupons back to editable form values and formats labels", () => {
    const coupon: AdminCoupon = {
      code: "SURGICAL10",
      expiresAt: null,
      id: "coupon-1",
      isActive: false,
      maxDiscount: null,
      minOrderAmount: 1000,
      startsAt: "2026-06-01T00:00:00.000Z",
      type: "PERCENTAGE",
      usageLimit: null,
      usedCount: 4,
      value: 10
    };

    expect(couponToFormValues(coupon)).toMatchObject({
      code: "SURGICAL10",
      isActive: false,
      maxDiscount: "",
      minOrderAmount: "1000",
      startsAt: "2026-06-01",
      usageLimit: "",
      value: "10"
    });
    expect(formatSupportLabel("PENDING_REVIEW")).toBe("Pending review");
    expect(formatSupportDateTime("2026-06-16T10:30:00.000Z")).toContain("2026");
  });
});
