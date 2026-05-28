import { z } from "zod";
import { ApiClientError, buildApiUrl } from "./client";
import { requestCustomerApi } from "./customer-client";
import { cartTotalsSchema } from "./cart";
import { useCustomerAuthStore } from "../stores/auth-store";

export const paymentMethodSchema = z.enum(["COD", "ONLINE"]);
export const paymentStatusSchema = z.enum([
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED"
]);
export const orderStatusSchema = z.enum([
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED"
]);

export const createOrderInputSchema = z.object({
  billingAddressId: z.string().nullable().optional(),
  paymentMethod: paymentMethodSchema,
  shippingAddressId: z.string().min(1, "Select a delivery address.")
});

export const orderAddressSchema = z.object({
  city: z.string(),
  country: z.string(),
  fullName: z.string(),
  id: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  mobileNumber: z.string(),
  pincode: z.string(),
  state: z.string()
});

export const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  productId: z.string(),
  quantity: z.number(),
  sku: z.string(),
  stockBatchId: z.string().nullable(),
  taxAmount: z.number(),
  taxRate: z.number(),
  total: z.number(),
  unitPrice: z.number(),
  variantId: z.string().nullable(),
  warehouseId: z.string().nullable()
});

export const orderStatusHistorySchema = z.object({
  changedById: z.string().nullable(),
  createdAt: z.string(),
  id: z.string(),
  note: z.string().nullable(),
  status: orderStatusSchema
});

export const orderSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  items: z.array(orderItemSchema),
  orderNumber: z.string(),
  paymentMethod: paymentMethodSchema.nullable(),
  paymentStatus: paymentStatusSchema,
  placedAt: z.string().nullable(),
  shippingAddress: orderAddressSchema.nullable(),
  status: orderStatusSchema,
  statusHistory: z.array(orderStatusHistorySchema),
  totals: cartTotalsSchema,
  updatedAt: z.string(),
  warehouseId: z.string().nullable()
});

export const orderListSchema = z.object({
  items: z.array(orderSchema),
  pagination: z.object({
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
    limit: z.number(),
    page: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderList = z.infer<typeof orderListSchema>;

export function createOrder(input: CreateOrderInput) {
  const parsedInput = createOrderInputSchema.parse(input);

  return requestCustomerApi("/orders", orderSchema, {
    body: JSON.stringify(parsedInput),
    method: "POST"
  });
}

export function listCustomerOrders(page = 1, limit = 20) {
  return requestCustomerApi("/orders/my", orderListSchema, {
    query: {
      limit,
      page
    }
  });
}

export function getOrder(orderId: string) {
  return requestCustomerApi(`/orders/${encodeURIComponent(orderId)}`, orderSchema);
}

export function canDownloadOrderInvoice(order: Order) {
  const invoiceableStatuses = new Set<Order["status"]>([
    "ASSIGNED",
    "CONFIRMED",
    "DELIVERED",
    "OUT_FOR_DELIVERY",
    "PACKED",
    "RETURNED"
  ]);

  if (!invoiceableStatuses.has(order.status) || order.items.length === 0) {
    return false;
  }

  return order.paymentMethod !== "ONLINE" || order.paymentStatus === "PAID";
}

export function buildOrderInvoiceDownloadUrl(orderId: string) {
  return buildApiUrl(`/orders/${encodeURIComponent(orderId)}/invoice`, {
    format: "html"
  });
}

export async function downloadOrderInvoiceHtml(
  order: Pick<Order, "id" | "orderNumber">
) {
  const response = await fetchOrderInvoice(order.id);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = url;
    link.download = `invoice-${order.orderNumber}.html`;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function fetchOrderInvoice(orderId: string) {
  const authStore = useCustomerAuthStore.getState();
  const currentAccessToken = authStore.session?.tokens.accessToken ?? null;
  let response = await fetch(buildOrderInvoiceDownloadUrl(orderId), {
    headers: invoiceDownloadHeaders(currentAccessToken)
  });

  if (response.status === 401) {
    try {
      const refreshedSession = await useCustomerAuthStore.getState().refreshSession();
      const refreshedAccessToken = refreshedSession?.tokens.accessToken ?? null;

      if (refreshedAccessToken) {
        response = await fetch(buildOrderInvoiceDownloadUrl(orderId), {
          headers: invoiceDownloadHeaders(refreshedAccessToken)
        });
      }
    } catch {
      useCustomerAuthStore.getState().clearSession();
    }
  }

  if (!response.ok) {
    throw new ApiClientError(
      await invoiceDownloadErrorMessage(response),
      response.status
    );
  }

  return response;
}

function invoiceDownloadHeaders(accessToken: string | null) {
  const headers = new Headers({
    Accept: "text/html"
  });

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function invoiceDownloadErrorMessage(response: Response) {
  const text = await response.text().catch(() => "");
  const parsedPayload = safeParseJson(text);
  const errorEnvelope = z
    .object({
      error: z.object({
        message: z.union([z.string(), z.array(z.string())])
      })
    })
    .safeParse(parsedPayload);

  if (errorEnvelope.success) {
    const message = errorEnvelope.data.error.message;

    return Array.isArray(message) ? message.join(", ") : message;
  }

  return text || response.statusText || "Unable to download invoice.";
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
