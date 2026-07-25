import { z } from "zod";
import { orderStatusSchema, paymentStatusSchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

const gatewayStatusSchema = z.object({
  message: z.string(),
  onlinePaymentEnabled: z.boolean(),
  provider: z.literal("razorpay")
});

const razorpayOrderSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  razorpay: z.object({
    amount: z.number(),
    currency: z.literal("INR"),
    keyId: z.string(),
    orderId: z.string()
  })
});

const verifyResponseSchema = z.object({
  orderStatus: orderStatusSchema,
  paymentId: z.string(),
  paymentStatus: paymentStatusSchema
});

export function getPaymentGatewayStatus() {
  return requestCustomerApi("/payments/gateway-status", gatewayStatusSchema);
}

export function createRazorpayOrder(orderId: string) {
  return requestCustomerApi(
    "/payments/razorpay/create-order",
    razorpayOrderSchema,
    {
      body: { orderId },
      method: "POST"
    }
  );
}

export function verifyRazorpayPayment(input: {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return requestCustomerApi(
    "/payments/razorpay/verify",
    verifyResponseSchema,
    {
      body: input,
      method: "POST"
    }
  );
}
