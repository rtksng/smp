import { z } from "zod";
import { requestCustomerApi } from "./customer-client";

const couponSchema = z.object({
  code: z.string(),
  discount: z.number(),
  grandTotal: z.number(),
  message: z.string(),
  subtotal: z.number(),
  tax: z.number()
});

export type CouponValidation = z.infer<typeof couponSchema>;

export function validateCoupon(code: string) {
  return requestCustomerApi("/coupons/validate", couponSchema, {
    body: { code: code.trim().toUpperCase() },
    method: "POST"
  });
}
