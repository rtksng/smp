import { describe, expect, it } from "vitest";
import {
  buildDeliveryChargePayload,
  buildDeliveryChargeQuery,
  createEmptyDeliveryChargeFilters,
  createEmptyDeliveryChargeFormValues,
  deliveryChargeRuleToFormValues,
  validateDeliveryChargeForm,
  type AdminDeliveryChargeRule
} from "./delivery-charge-management";

describe("delivery charge management helpers", () => {
  it("builds delivery charge queries without empty filters", () => {
    expect(
      buildDeliveryChargeQuery(
        {
          ...createEmptyDeliveryChargeFilters(),
          isActive: "true",
          pincode: " 110001 ",
          search: " delhi ",
          warehouseId: "warehouse-1"
        },
        2,
        15
      )
    ).toEqual({
      isActive: true,
      limit: 15,
      page: 2,
      pincode: "110001",
      search: "delhi",
      warehouseId: "warehouse-1"
    });
  });

  it("normalizes delivery charge form values for API payloads", () => {
    expect(
      buildDeliveryChargePayload({
        ...createEmptyDeliveryChargeFormValues(),
        charge: "75",
        freeDeliveryThreshold: "5000",
        maxOrderAmount: "4999",
        minOrderAmount: "500",
        name: " Delhi delivery ",
        pincode: " 110001 ",
        priority: "2",
        warehouseId: "warehouse-1"
      })
    ).toEqual({
      charge: 75,
      freeDeliveryThreshold: 5000,
      isActive: true,
      maxOrderAmount: 4999,
      minOrderAmount: 500,
      name: "Delhi delivery",
      pincode: "110001",
      priority: 2,
      warehouseId: "warehouse-1"
    });
  });

  it("validates delivery charge amount ranges and maps records back to forms", () => {
    expect(
      validateDeliveryChargeForm({
        ...createEmptyDeliveryChargeFormValues(),
        charge: "-1",
        maxOrderAmount: "100",
        minOrderAmount: "200",
        name: "",
        pincode: "123"
      })
    ).toEqual({
      charge: "Enter a delivery charge of 0 or above.",
      maxOrderAmount: "Maximum order amount must be greater than minimum order amount.",
      name: "Enter a rule name.",
      pincode: "Pincode must be exactly 6 digits."
    });

    const rule: AdminDeliveryChargeRule = {
      charge: 75,
      createdAt: "2026-06-17T10:00:00.000Z",
      freeDeliveryThreshold: null,
      id: "rule-1",
      isActive: false,
      maxOrderAmount: null,
      minOrderAmount: 500,
      name: "Delhi delivery",
      pincode: "110001",
      priority: 2,
      updatedAt: "2026-06-17T10:00:00.000Z",
      warehouse: {
        code: "DEL-01",
        id: "warehouse-1",
        name: "Delhi Warehouse"
      },
      warehouseId: "warehouse-1"
    };

    expect(deliveryChargeRuleToFormValues(rule)).toMatchObject({
      charge: "75",
      isActive: false,
      minOrderAmount: "500",
      name: "Delhi delivery",
      pincode: "110001",
      priority: "2",
      warehouseId: "warehouse-1"
    });
  });
});
