import { describe, expect, test } from "vitest";
import type { DeliveryAssignment } from "../api/types";
import {
  countAssignmentsByStatus,
  dashboardMetrics,
  deliveryFilterOptions,
  formatDateTime,
  nextActionLabel
} from "./dashboard";

function assignment(
  status: DeliveryAssignment["status"],
  overrides: Partial<DeliveryAssignment> = {}
): DeliveryAssignment {
  return {
    assignedAt: "2026-05-25T10:00:00.000Z",
    createdAt: "2026-05-25T10:00:00.000Z",
    customer: {
      businessName: null,
      fullName: "Nisha Rao",
      id: "customer-1",
      mobileNumber: "+919999888877"
    },
    deliveredAt: null,
    deliveryPartnerId: "partner-1",
    failureReason: null,
    id: `assignment-${status}`,
    items: [
      {
        id: "item-1",
        name: "Sterile gloves",
        productId: "product-1",
        quantity: 2,
        sku: "GLV-100",
        variantId: null,
        warehouseId: "warehouse-1"
      }
    ],
    orderId: "order-1",
    orderNotes: null,
    orderNumber: `ORD-${status}`,
    payment: {
      cashCollectedAmount: null,
      cashCollectedAt: null,
      cashSettlementStatus: "COLLECTED",
      codAmount: status === "DELIVERED" ? 0 : 1225,
      method: status === "DELIVERED" ? "ONLINE" : "COD",
      status: "PENDING"
    },
    pickedUpAt: null,
    pickupWarehouse: null,
    pickupWarehouseId: null,
    proofOfDeliveryKey: null,
    proofOfDeliveryUrl: null,
    receiverName: null,
    shippingAddress: null,
    status,
    statusHistory: [],
    totals: {
      discountTotal: 25,
      grandTotal: 1225,
      shippingTotal: 50,
      subtotal: 1100,
      taxTotal: 100
    },
    updatedAt: "2026-05-25T10:00:00.000Z",
    ...overrides
  };
}

describe("delivery dashboard helpers", () => {
  test("counts assignments by status and summarizes active workload", () => {
    const items = [
      assignment("ASSIGNED"),
      assignment("ACCEPTED"),
      assignment("OUT_FOR_DELIVERY"),
      assignment("DELIVERED"),
      assignment("FAILED")
    ];

    expect(countAssignmentsByStatus(items)).toMatchObject({
      ACCEPTED: 1,
      ASSIGNED: 1,
      DELIVERED: 1,
      FAILED: 1,
      OUT_FOR_DELIVERY: 1
    });

    expect(dashboardMetrics(items)).toMatchObject({
      activeCount: 3,
      codAmount: 3675,
      completedCount: 1,
      issueCount: 1,
      totalCount: 5
    });
  });

  test("builds status filter options with counts", () => {
    const options = deliveryFilterOptions([
      assignment("ASSIGNED"),
      assignment("ASSIGNED"),
      assignment("DELIVERED")
    ]);

    expect(options.map((option) => `${option.label}:${option.count}`)).toEqual([
      "All:3",
      "Assigned:2",
      "Accepted:0",
      "Picked Up:0",
      "Out For Delivery:0",
      "Delivered:1",
      "Failed:0",
      "Cancelled:0"
    ]);
  });

  test("returns the next useful action label for each assignment status", () => {
    expect(nextActionLabel("ASSIGNED")).toBe("Accept order");
    expect(nextActionLabel("ACCEPTED")).toBe("Mark picked up");
    expect(nextActionLabel("PICKED_UP")).toBe("Start delivery");
    expect(nextActionLabel("OUT_FOR_DELIVERY")).toBe("Complete delivery");
    expect(nextActionLabel("DELIVERED")).toBe("Completed");
    expect(nextActionLabel("FAILED")).toBe("Issue logged");
  });

  test("formats invalid or missing dates with a fallback", () => {
    expect(formatDateTime(null)).toBe("Not available");
    expect(formatDateTime("not-a-date")).toBe("Not available");
    expect(formatDateTime("2026-05-25T10:00:00.000Z")).toContain("2026");
  });
});
