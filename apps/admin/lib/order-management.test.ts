import { describe, expect, it } from "vitest";
import {
  buildAssignDeliveryPayload,
  buildOrderQuery,
  buildOrderStatusPayload,
  canAssignDelivery,
  canCancelOrder,
  createEmptyOrderFilters,
  getNextOrderStatuses
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
});
