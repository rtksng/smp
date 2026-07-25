import { buildOrderSubmission, type PaymentMethod } from "../commerce/checkout";
import { cartSchema, orderListSchema, orderSchema } from "./schemas";
import { requestCustomerApi } from "./customer-client";

export function createOrder(input: {
  couponCode?: string | null;
  idempotencyKey: string;
  paymentMethod: PaymentMethod;
  shippingAddressId: string;
}) {
  const submission = buildOrderSubmission(input);

  return requestCustomerApi("/orders", orderSchema, {
    ...submission,
    method: "POST"
  });
}

export function listOrders(page = 1, limit = 20) {
  return requestCustomerApi("/orders/my", orderListSchema, {
    query: { limit, page }
  });
}

export function getOrder(orderId: string) {
  return requestCustomerApi(
    `/orders/${encodeURIComponent(orderId)}`,
    orderSchema
  );
}

export function reorder(orderId: string) {
  return requestCustomerApi(
    `/orders/${encodeURIComponent(orderId)}/reorder`,
    cartSchema,
    { method: "POST" }
  );
}

export function cancelOrder(orderId: string, reason?: string) {
  return requestCustomerApi(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    orderSchema,
    {
      body: { reason: reason?.trim() || undefined },
      method: "POST"
    }
  );
}

export function requestReturn(orderId: string, reason?: string) {
  return requestCustomerApi(
    `/orders/${encodeURIComponent(orderId)}/return-request`,
    orderSchema,
    {
      body: { reason: reason?.trim() || undefined },
      method: "POST"
    }
  );
}
