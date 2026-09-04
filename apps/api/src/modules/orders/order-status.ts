import { OrderStatus } from "../../generated/prisma/enums";

export const PENDING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY
];

export function buildPendingOrderStatusFilter(status?: OrderStatus) {
  return {
    in: status
      ? PENDING_ORDER_STATUSES.filter((pendingStatus) => pendingStatus === status)
      : [...PENDING_ORDER_STATUSES]
  };
}
