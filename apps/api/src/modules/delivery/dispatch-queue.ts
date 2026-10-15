import { OrderStatus, PaymentMethod } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";

/** Orders waiting for a delivery partner. A failed or cancelled delivery sends its order back to PACKED. */
export const READY_FOR_DISPATCH_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED
];

export const DISPATCH_ORDER_INCLUDE = {
  _count: { select: { deliveryAssignments: true, items: true } },
  payments: {
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
    select: { method: true, status: true },
    take: 1
  },
  shippingAddress: { select: { city: true, pincode: true, state: true } },
  user: {
    select: { businessName: true, firstName: true, lastName: true, mobileNumber: true }
  },
  warehouse: { select: { code: true, id: true, name: true } }
} as const satisfies Prisma.OrderInclude;

// Oldest first, so the queue is worked in the order customers placed them.
export const DISPATCH_ORDER_ORDER_BY: Prisma.OrderOrderByWithRelationInput[] = [
  { placedAt: "asc" },
  { createdAt: "asc" },
  { id: "asc" }
];

type DispatchOrderRecord = Prisma.OrderGetPayload<{ include: typeof DISPATCH_ORDER_INCLUDE }>;

export function serializeDispatchOrder(order: DispatchOrderRecord) {
  const latestPayment = order.payments[0] ?? null;
  const grandTotal = Number(order.grandTotal.toString());

  return {
    // Earlier deliveries of an order still waiting for dispatch all failed or were cancelled.
    attempts: order._count.deliveryAssignments,
    createdAt: order.createdAt,
    customer: {
      businessName: order.user.businessName,
      fullName: [order.user.firstName, order.user.lastName].filter(Boolean).join(" "),
      mobileNumber: order.user.mobileNumber
    },
    grandTotal,
    id: order.id,
    itemCount: order._count.items,
    orderNumber: order.orderNumber,
    payment: {
      codAmount: latestPayment?.method === PaymentMethod.COD ? grandTotal : 0,
      method: latestPayment?.method ?? null,
      status: order.paymentStatus
    },
    placedAt: order.placedAt,
    shippingAddress: order.shippingAddress
      ? {
          city: order.shippingAddress.city,
          pincode: order.shippingAddress.pincode,
          state: order.shippingAddress.state
        }
      : null,
    status: order.status,
    warehouse: order.warehouse
      ? { code: order.warehouse.code, id: order.warehouse.id, name: order.warehouse.name }
      : null,
    warehouseId: order.warehouseId
  };
}
