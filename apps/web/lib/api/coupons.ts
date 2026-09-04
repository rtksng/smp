import { z } from "zod";
import { requestCustomerApi } from "./customer-client";

export const couponValidationSchema = z.object({
  code: z.string(),
  discount: z.number(),
  grandTotal: z.number(),
  message: z.string(),
  subtotal: z.number(),
  tax: z.number()
});

export type CouponValidation = z.infer<typeof couponValidationSchema>;

export const availableCouponSchema = z.object({
  code: z.string(),
  expiresAt: z.string().datetime().nullable(),
  maxDiscount: z.number().nullable(),
  minOrderAmount: z.number().nullable(),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number()
});

export const availableCouponsSchema = z.object({
  items: z.array(availableCouponSchema)
});

export type AvailableCoupon = z.infer<typeof availableCouponSchema>;

export function listAvailableCoupons() {
  return requestCustomerApi("/coupons/available", availableCouponsSchema);
}

export function validateCoupon(code: string) {
  return requestCustomerApi("/coupons/validate", couponValidationSchema, {
    body: JSON.stringify({ code }),
    method: "POST"
  });
}
