import { describe, expect, it } from "vitest";
import {
  buildDeliveryAssignmentQuery,
  buildDeliveryPartnerQuery,
  buildDeliveryStatusPayload,
  createEmptyDeliveryAssignmentFilters,
  createEmptyDeliveryPartnerFilters,
  formatDeliveryLabel,
  getNextDeliveryStatuses,
  loadDeliveryOptions
} from "./delivery-management";

describe("delivery management helpers", () => {
  it("loads dispatch options beyond the first table page", async () => {
    const pages: number[] = [];
    const items = await loadDeliveryOptions(async (page) => {
      pages.push(page);
      return { items: [page], pagination: { hasNextPage: page < 3, hasPreviousPage: page > 1, page, limit: 1, total: 3, totalPages: 3 } };
    });
    expect(pages).toEqual([1, 2, 3]);
    expect(items).toEqual([1, 2, 3]);
  });
  it("normalizes delivery partner filters into the backend query", () => {
    expect(
      buildDeliveryPartnerQuery(
        {
          status: "PENDING_VERIFICATION"
        },
        2,
        50
      )
    ).toEqual({
      limit: 50,
      page: 2,
      status: "PENDING_VERIFICATION"
    });

    expect(buildDeliveryPartnerQuery(createEmptyDeliveryPartnerFilters())).toEqual({
      limit: 20,
      page: 1
    });
  });

  it("normalizes delivery assignment filters into the backend query", () => {
    expect(
      buildDeliveryAssignmentQuery(
        {
          deliveryPartnerId: "partner-1",
          status: "OUT_FOR_DELIVERY",
          warehouseId: "warehouse-1"
        },
        3
      )
    ).toEqual({
      deliveryPartnerId: "partner-1",
      limit: 20,
      page: 3,
      status: "OUT_FOR_DELIVERY",
      warehouseId: "warehouse-1"
    });

    expect(buildDeliveryAssignmentQuery(createEmptyDeliveryAssignmentFilters())).toEqual({
      limit: 20,
      page: 1
    });
  });

  it("derives delivery status options and trims status payload notes", () => {
    expect(getNextDeliveryStatuses("ASSIGNED")).toEqual(["ACCEPTED", "CANCELLED"]);
    expect(getNextDeliveryStatuses("PICKED_UP")).toEqual([
      "OUT_FOR_DELIVERY",
      "FAILED"
    ]);
    expect(getNextDeliveryStatuses("DELIVERED")).toEqual([]);
    expect(buildDeliveryStatusPayload("FAILED", " Clinic closed ")).toEqual({
      note: "Clinic closed",
      status: "FAILED"
    });
    expect(buildDeliveryStatusPayload("FAILED", " ")).toEqual({
      status: "FAILED"
    });
    expect(formatDeliveryLabel("PENDING_VERIFICATION")).toBe("Pending verification");
  });
});
