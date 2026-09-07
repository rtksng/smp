export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PACKED"
  | "ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

type Refund = {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
};

const cancellableStatuses = new Set<OrderStatus>([
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "ASSIGNED"
]);

const activeRefundStatuses = new Set<Refund["status"]>([
  "PENDING",
  "PROCESSING"
]);

export function canCancelOrder(status: OrderStatus): boolean {
  return cancellableStatuses.has(status);
}

export function canRequestReturn(status: OrderStatus, refunds: Refund[]): boolean {
  return (
    status === "DELIVERED" &&
    !refunds.some((refund) => activeRefundStatuses.has(refund.status))
  );
}

export function canRetryOnlinePayment(order: {
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string;
}): boolean {
  return order.status === "CREATED" && order.paymentMethod === "ONLINE" &&
    ["FAILED", "PENDING"].includes(order.paymentStatus);
}

export function getOrderRefreshInterval(status: OrderStatus): number | false {
  return ["DELIVERED", "CANCELLED", "RETURNED"].includes(status) ? false : 15_000;
}
