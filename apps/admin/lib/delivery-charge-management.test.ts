import { describe, expect, it } from "vitest";
import {
  buildDeliveryChargePayload,
  buildDeliveryChargeQuery,
  createEmptyDeliveryChargeFilters,
  createEmptyDeliveryChargeFormValues,
  deliveryChargeRuleToFormValues,
  validateDeliveryChargeFilters,
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

  it.each(["", "   "])("requires an explicit delivery charge for %j", (charge) => {
    expect(
      validateDeliveryChargeForm({
        ...createEmptyDeliveryChargeFormValues(),
        charge,
        name: "Local delivery"
      })
    ).toEqual({ charge: "Enter a delivery charge of 0 or above." });
  });

  it.each(["0", "75.50"])("accepts an explicit delivery charge of %s", (charge) => {
    const values = {
      ...createEmptyDeliveryChargeFormValues(),
      charge,
      name: "Local delivery"
    };

    expect(validateDeliveryChargeForm(values)).toEqual({});
    expect(buildDeliveryChargePayload(values).charge).toBe(Number(charge));
  });

  it("validates the API rule name limit after trimming", () => {
    const values = {
      ...createEmptyDeliveryChargeFormValues(),
      charge: "75",
      name: `  ${"A".repeat(160)}  `
    };

    expect(validateDeliveryChargeForm(values)).toEqual({});
    expect(buildDeliveryChargePayload(values).name).toHaveLength(160);
    expect(
      validateDeliveryChargeForm({ ...values, name: "A".repeat(161) })
    ).toEqual({ name: "Rule name must be 160 characters or fewer." });
  });

  it.each(["", "   ", "110001", " 001234 "])(
    "allows an optional six-digit filter pincode of %j",
    (pincode) => {
      const filters = { ...createEmptyDeliveryChargeFilters(), pincode };

      expect(validateDeliveryChargeFilters(filters)).toBeNull();
      expect(buildDeliveryChargeQuery(filters).pincode).toBe(
        pincode.trim() || undefined
      );
    }
  );

  it.each(["123", "1234567", "ABCDEF", "110 01", "12345.0"])(
    "rejects the malformed filter pincode %j before applying",
    (pincode) => {
      expect(
        validateDeliveryChargeFilters({
          ...createEmptyDeliveryChargeFilters(),
          pincode
        })
      ).toBe("Pincode must be exactly 6 digits.");
    }
  );

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
