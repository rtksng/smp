import { describe, expect, it } from "vitest";
import {
  buildAssignDeliveryPayload,
  buildOrderQuery,
  buildOrderStatusPayload,
  buildReturnActionPayload,
  buildReturnRequestQuery,
  canApproveReturn,
  canAssignDelivery,
  canCancelOrder,
  canProcessReturnRefund,
  canRejectReturn,
  createEmptyOrderFilters,
  createEmptyReturnRequestFilters,
  getLatestRefund,
  getNextOrderStatuses,
  type OrderRefund
} from "./order-management";

describe("order management helpers", () => {
  it("normalizes order filters into the backend admin orders query", () => {
    expect(
      buildOrderQuery(
        {
          customerMobile: " 9999999999 ",
          dateFrom: "2026-05-01",
          dateTo: "2026-05-26",
          orderNumber: " ORD-20260525 ",
          paymentStatus: "PAID",
          status: "CONFIRMED",
          warehouseId: "warehouse-1"
        },
        3
      )
    ).toEqual({
      customerMobile: "9999999999",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      limit: 20,
      orderNumber: "ORD-20260525",
      page: 3,
      paymentStatus: "PAID",
      status: "CONFIRMED",
      warehouseId: "warehouse-1"
    });

    expect(buildOrderQuery(createEmptyOrderFilters())).toEqual({
      limit: 20,
      page: 1
    });
  });

  it("derives allowed order actions from the current order status", () => {
    expect(getNextOrderStatuses("CONFIRMED")).toEqual(["PACKED"]);
    expect(getNextOrderStatuses("DELIVERED")).toEqual(["RETURNED"]);
    expect(getNextOrderStatuses("CANCELLED")).toEqual([]);
    expect(canCancelOrder("PACKED")).toBe(true);
    expect(canCancelOrder("DELIVERED")).toBe(false);
    expect(canAssignDelivery("CONFIRMED")).toBe(true);
    expect(canAssignDelivery("PACKED")).toBe(true);
    expect(canAssignDelivery("CREATED")).toBe(false);
  });

  it("builds status and delivery action payloads without blank optional fields", () => {
    expect(buildOrderStatusPayload("PACKED", " Ready for dispatch ")).toEqual({
      note: "Ready for dispatch",
      status: "PACKED"
    });
    expect(buildOrderStatusPayload("PACKED", " ")).toEqual({
      status: "PACKED"
    });
    expect(
      buildAssignDeliveryPayload({
        deliveryPartnerId: "partner-1",
        note: " Packed shelf A ",
        orderId: "order-1",
        pickupWarehouseId: ""
      })
    ).toEqual({
      deliveryPartnerId: "partner-1",
      note: "Packed shelf A",
      orderId: "order-1",
      pickupWarehouseId: null
    });
  });

  it("normalizes return request filters and return action notes", () => {
    expect(
      buildReturnRequestQuery(
        {
          customerMobile: " 9876543210 ",
          orderNumber: " ORD-RETURN-1 ",
          status: "PROCESSING",
          warehouseId: "warehouse-1"
        },
        2,
        10
      )
    ).toEqual({
      customerMobile: "9876543210",
      limit: 10,
      orderNumber: "ORD-RETURN-1",
      page: 2,
      status: "PROCESSING",
      warehouseId: "warehouse-1"
    });
    expect(buildReturnRequestQuery(createEmptyReturnRequestFilters())).toEqual({
      limit: 20,
      page: 1
    });
    expect(buildReturnActionPayload(" Checked and approved ")).toEqual({
      note: "Checked and approved"
    });
    expect(buildReturnActionPayload(" ")).toEqual({});
  });

  it("derives return action availability from order and refund state", () => {
    const baseRefund: OrderRefund = {
      amount: 999,
      createdAt: "2026-06-15T10:00:00.000Z",
      id: "refund-1",
      processedAt: null,
      providerRefundId: null,
      reason: "Damaged seal",
      status: "PENDING"
    };
    const pendingReturn = {
      refunds: [baseRefund],
      status: "DELIVERED" as const
    };
    const completedReturn = {
      refunds: [
        {
          ...baseRefund,
          processedAt: "2026-06-16T10:00:00.000Z",
          providerRefundId: "rfnd_123",
          status: "COMPLETED" as const
        }
      ],
      status: "RETURNED" as const
    };
    const failedReturn = {
      refunds: [
        {
          ...baseRefund,
          status: "FAILED" as const
        }
      ],
      status: "RETURNED" as const
    };

    expect(getLatestRefund(pendingReturn)).toEqual(pendingReturn.refunds[0]);
    expect(canApproveReturn(pendingReturn)).toBe(true);
    expect(canRejectReturn(pendingReturn)).toBe(true);
    expect(canProcessReturnRefund(pendingReturn)).toBe(true);
    expect(canApproveReturn(completedReturn)).toBe(false);
    expect(canRejectReturn(completedReturn)).toBe(false);
    expect(canProcessReturnRefund(completedReturn)).toBe(false);
    expect(canApproveReturn(failedReturn)).toBe(false);
    expect(canRejectReturn(failedReturn)).toBe(false);
    expect(canProcessReturnRefund(failedReturn)).toBe(true);
  });
});
