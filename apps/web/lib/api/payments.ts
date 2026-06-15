import { z } from "zod";
import { requestCustomerApi } from "./customer-client";
import {
  orderStatusSchema,
  paymentStatusSchema
} from "./orders";

export const razorpayCreateOrderSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  razorpay: z.object({
    amount: z.number(),
    currency: z.literal("INR"),
    keyId: z.string(),
    orderId: z.string()
  })
});

export const verifyRazorpayPaymentInputSchema = z.object({
  orderId: z.string(),
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string()
});

export const razorpayVerifyResponseSchema = z.object({
  orderStatus: orderStatusSchema,
  paymentId: z.string(),
  paymentStatus: paymentStatusSchema
});

export const paymentGatewayStatusSchema = z.object({
  message: z.string(),
  onlinePaymentEnabled: z.boolean(),
  provider: z.literal("razorpay")
});

export type RazorpayCreateOrder = z.infer<typeof razorpayCreateOrderSchema>;
export type PaymentGatewayStatus = z.infer<typeof paymentGatewayStatusSchema>;
export type VerifyRazorpayPaymentInput = z.infer<
  typeof verifyRazorpayPaymentInputSchema
>;

export function getPaymentGatewayStatus() {
  return requestCustomerApi(
    "/payments/gateway-status",
    paymentGatewayStatusSchema
  );
}

export function createRazorpayOrder(orderId: string) {
  return requestCustomerApi(
    "/payments/razorpay/create-order",
    razorpayCreateOrderSchema,
    {
      body: JSON.stringify({ orderId }),
      method: "POST"
    }
  );
}

export function verifyRazorpayPayment(input: VerifyRazorpayPaymentInput) {
  const parsedInput = verifyRazorpayPaymentInputSchema.parse(input);

  return requestCustomerApi(
    "/payments/razorpay/verify",
    razorpayVerifyResponseSchema,
    {
      body: JSON.stringify(parsedInput),
      method: "POST"
    }
  );
}
