import type { QueryParams } from "./admin-api";

export const ORDER_STATUSES = [
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED"
] as const;

export const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED"
] as const;

export const REFUND_STATUSES = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export type PaymentMethod = "COD" | "ONLINE";

export type OrderFilters = {
  customerMobile: string;
  dateFrom: string;
  dateTo: string;
  orderNumber: string;
  paymentStatus: "" | PaymentStatus;
  status: "" | OrderStatus;
  warehouseId: string;
};

export type ReturnRequestFilters = {
  customerMobile: string;
  orderNumber: string;
  status: "" | RefundStatus;
  warehouseId: string;
};

export type OrderTotals = {
  deliveryCharge: number;
  discount: number;
  grandTotal: number;
  subtotal: number;
  tax: number;
};

export type OrderAddress = {
  city: string;
  country: string;
  fullName: string;
  id: string;
  line1: string;
  line2: string | null;
  mobileNumber: string;
  pincode: string;
  state: string;
};

export type OrderCustomer = {
  businessName: string | null;
  email: string | null;
  firstName: string;
  gstNumber: string | null;
  id: string;
  lastName: string | null;
  mobileNumber: string;
};

export type LinkedWarehouse = {
  code: string;
  id: string;
  name: string;
};

export type OrderItem = {
  id: string;
  name: string;
  productId: string;
  quantity: number;
  sku: string;
  stockBatchId: string | null;
  taxAmount: number;
  taxRate: number;
  total: number;
  unitPrice: number;
  variantId: string | null;
  warehouseId: string | null;
};

export type PaymentDetail = {
  amount: number;
  createdAt: string;
  id: string;
  method: PaymentMethod;
  paidAt: string | null;
  provider: string | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentStatus;
  transactionRef: string | null;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  pdfStatus: string;
  taxBreakup: {
    cgst: number;
    igst: number;
    sgst: number;
    taxType: string;
  };
  totals: {
    grandTotal: number;
    subtotal: number;
    tax: number;
  };
};

export type OrderRefund = {
  amount: number;
  createdAt: string;
  id: string;
  processedAt: string | null;
  providerRefundId: string | null;
  reason: string | null;
  status: RefundStatus;
};

export type OrderStatusHistory = {
  changedById: string | null;
  createdAt: string;
  id: string;
  note: string | null;
  status: OrderStatus;
};

export type AdminOrder = {
  billingAddress: OrderAddress | null;
  createdAt: string;
  customer: OrderCustomer;
  id: string;
  invoice: InvoiceSummary | null;
  items: OrderItem[];
  orderNumber: string;
  paymentDetails: PaymentDetail[];
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  placedAt: string | null;
  refunds: OrderRefund[];
  shippingAddress: OrderAddress | null;
  status: OrderStatus;
  statusHistory: OrderStatusHistory[];
  totals: OrderTotals;
  updatedAt: string;
  warehouse: LinkedWarehouse | null;
  warehouseId: string | null;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type AssignDeliveryValues = {
  deliveryPartnerId: string;
  note: string;
  orderId: string;
  pickupWarehouseId: string;
};

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  ASSIGNED: ["OUT_FOR_DELIVERY"],
  CANCELLED: [],
  CONFIRMED: ["PACKED"],
  CREATED: ["CONFIRMED"],
  DELIVERED: ["RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  PACKED: ["ASSIGNED"],
  RETURNED: []
};

const CANCELLABLE_STATUSES = new Set<OrderStatus>([
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "ASSIGNED"
]);

const DELIVERY_ASSIGNABLE_STATUSES = new Set<OrderStatus>(["CONFIRMED", "PACKED"]);
const ACTIVE_RETURN_REFUND_STATUSES = new Set<RefundStatus>([
  "PENDING",
  "PROCESSING"
]);
const PROCESSABLE_RETURN_REFUND_STATUSES = new Set<RefundStatus>([
  "PENDING",
  "PROCESSING",
  "FAILED"
]);

export function createEmptyOrderFilters(): OrderFilters {
  return {
    customerMobile: "",
    dateFrom: "",
    dateTo: "",
    orderNumber: "",
    paymentStatus: "",
    status: "",
    warehouseId: ""
  };
}

export function createEmptyReturnRequestFilters(): ReturnRequestFilters {
  return {
    customerMobile: "",
    orderNumber: "",
    status: "",
    warehouseId: ""
  };
}

export function buildOrderQuery(
  filters: OrderFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    customerMobile: trimmedOrUndefined(filters.customerMobile),
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    limit,
    orderNumber: trimmedOrUndefined(filters.orderNumber),
    page,
    paymentStatus: filters.paymentStatus || undefined,
    status: filters.status || undefined,
    warehouseId: filters.warehouseId || undefined
  };
}

export function buildReturnRequestQuery(
  filters: ReturnRequestFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    customerMobile: trimmedOrUndefined(filters.customerMobile),
    limit,
    orderNumber: trimmedOrUndefined(filters.orderNumber),
    page,
    status: filters.status || undefined,
    warehouseId: filters.warehouseId || undefined
  };
}

export function getNextOrderStatuses(status: OrderStatus) {
  return NEXT_STATUSES[status];
}

export function canCancelOrder(status: OrderStatus) {
  return CANCELLABLE_STATUSES.has(status);
}

export function canAssignDelivery(status: OrderStatus) {
  return DELIVERY_ASSIGNABLE_STATUSES.has(status);
}

export function getLatestRefund(order: Pick<AdminOrder, "refunds">) {
  return order.refunds[0] ?? null;
}

export function canApproveReturn(order: Pick<AdminOrder, "refunds" | "status">) {
  const latestRefund = getLatestRefund(order);

  return (
    order.status === "DELIVERED" &&
    Boolean(latestRefund && ACTIVE_RETURN_REFUND_STATUSES.has(latestRefund.status))
  );
}

export function canRejectReturn(order: Pick<AdminOrder, "refunds">) {
  const latestRefund = getLatestRefund(order);

  return Boolean(
    latestRefund && ACTIVE_RETURN_REFUND_STATUSES.has(latestRefund.status)
  );
}

export function canProcessReturnRefund(order: Pick<AdminOrder, "refunds">) {
  const latestRefund = getLatestRefund(order);

  return Boolean(
    latestRefund && PROCESSABLE_RETURN_REFUND_STATUSES.has(latestRefund.status)
  );
}

export function buildOrderStatusPayload(status: OrderStatus, note: string) {
  return {
    note: trimmedOrUndefined(note),
    status
  };
}

export function buildCancelOrderPayload(reason: string) {
  return {
    reason: trimmedOrUndefined(reason)
  };
}

export function buildReturnActionPayload(note: string) {
  return {
    note: trimmedOrUndefined(note)
  };
}

export function buildAssignDeliveryPayload(values: AssignDeliveryValues) {
  return {
    deliveryPartnerId: values.deliveryPartnerId,
    note: trimmedOrUndefined(values.note),
    orderId: values.orderId,
    pickupWarehouseId: values.pickupWarehouseId || null
  };
}

export function formatOrderLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function trimmedOrUndefined(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
