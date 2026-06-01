import { describe, expect, it } from "vitest";
import {
  adjustStockFormSchema,
  buildAdjustStockPayload,
  buildInventoryRequest,
  buildStockInPayload,
  buildTransferStockPayload,
  INVENTORY_ACTIONS_PATH,
  INVENTORY_MOVEMENTS_PATH,
  INVENTORY_OVERVIEW_PATH,
  INVENTORY_TABS,
  isLowStock,
  isNearExpiry,
  stockInFormSchema,
  transferStockFormSchema
} from "./inventory-management";

describe("inventory management helpers", () => {
  it("normalizes stock-in values into the backend inventory payload", () => {
    const values = stockInFormSchema.parse({
      batchNumber: "BATCH-2026-001",
      expiryDate: "",
      lowStockThreshold: "5",
      mrp: "150.50",
      productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      purchasePrice: "90",
      quantity: "10",
      sellingPrice: "120",
      variantId: "",
      warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
    });

    expect(buildStockInPayload(values)).toEqual({
      batchNumber: "BATCH-2026-001",
      expiryDate: null,
      lowStockThreshold: 5,
      mrp: 150.5,
      productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      purchasePrice: 90,
      quantity: 10,
      sellingPrice: 120,
      variantId: null,
      warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
    });
  });

  it("rejects no-op adjustments and same-warehouse transfers", () => {
    expect(
      adjustStockFormSchema.safeParse({
        batchNumber: "",
        lowStockThreshold: "",
        productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
        quantityDelta: "0",
        reason: "Cycle count",
        variantId: "",
        warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
      }).success
    ).toBe(false);

    expect(
      transferStockFormSchema.safeParse({
        batchNumber: "",
        fromWarehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6",
        notes: "",
        productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
        quantity: "1",
        toWarehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6",
        variantId: ""
      }).success
    ).toBe(false);
  });

  it("routes stock filters to normal, low-stock, and near-expiry inventory APIs", () => {
    expect(
      buildInventoryRequest({
        lowStock: false,
        nearExpiry: false,
        productId: "product-1",
        search: "forceps",
        warehouseId: "warehouse-1"
      })
    ).toEqual({
      endpoint: "/admin/inventory",
      query: {
        limit: 100,
        productId: "product-1",
        search: "forceps",
        warehouseId: "warehouse-1"
      },
      type: "stock"
    });

    expect(
      buildInventoryRequest({
        lowStock: true,
        nearExpiry: false,
        productId: "",
        search: "",
        warehouseId: "warehouse-1"
      }).endpoint
    ).toBe("/admin/inventory/low-stock");

    expect(
      buildInventoryRequest({
        lowStock: false,
        nearExpiry: true,
        productId: "product-1",
        search: "",
        warehouseId: ""
      })
    ).toMatchObject({
      endpoint: "/admin/inventory/near-expiry",
      query: {
        days: 30,
        limit: 100,
        productId: "product-1"
      },
      type: "batch"
    });
  });

  it("defines inventory route tabs for overview, stock actions, and movements", () => {
    expect(INVENTORY_OVERVIEW_PATH).toBe("/inventory");
    expect(INVENTORY_ACTIONS_PATH).toBe("/inventory/actions");
    expect(INVENTORY_MOVEMENTS_PATH).toBe("/inventory/movements");
    expect(INVENTORY_TABS.map((tab) => tab.label)).toEqual([
      "Overview",
      "Stock actions",
      "Movements"
    ]);
  });

  it("builds stock warning flags from thresholds and expiry dates", () => {
    expect(isLowStock({ availableQuantity: 4, lowStockThreshold: 5 })).toBe(true);
    expect(isLowStock({ availableQuantity: 6, lowStockThreshold: 5 })).toBe(false);
    expect(
      isNearExpiry("2026-06-10T00:00:00.000Z", new Date("2026-05-26T00:00:00.000Z"))
    ).toBe(true);
    expect(
      isNearExpiry("2026-08-10T00:00:00.000Z", new Date("2026-05-26T00:00:00.000Z"))
    ).toBe(false);
  });

  it("normalizes adjustment and transfer payloads", () => {
    expect(
      buildAdjustStockPayload(
        adjustStockFormSchema.parse({
          batchNumber: "",
          lowStockThreshold: "",
          productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
          quantityDelta: "-2",
          reason: "Cycle count",
          variantId: "",
          warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
        })
      )
    ).toEqual({
      batchNumber: undefined,
      lowStockThreshold: undefined,
      productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      quantityDelta: -2,
      reason: "Cycle count",
      variantId: null,
      warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
    });

    expect(
      buildTransferStockPayload(
        transferStockFormSchema.parse({
          batchNumber: "",
          fromWarehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6",
          notes: "",
          productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
          quantity: "3",
          toWarehouseId: "8d9f8f33-d348-4a89-94e8-907be76a91c6",
          variantId: ""
        })
      )
    ).toEqual({
      batchNumber: undefined,
      fromWarehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6",
      notes: undefined,
      productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      quantity: 3,
      toWarehouseId: "8d9f8f33-d348-4a89-94e8-907be76a91c6",
      variantId: null
    });
  });
});
