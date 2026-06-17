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

export function validateCoupon(code: string) {
  return requestCustomerApi("/coupons/validate", couponValidationSchema, {
    body: JSON.stringify({ code }),
    method: "POST"
  });
}
