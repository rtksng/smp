import type { PrismaService } from "../../database/prisma.service";

export type InventoryWarehouseFilter = string | { in: string[] } | undefined;

/**
 * Headline stock counts for the warehouses in view (undefined means every warehouse).
 * Stock lines are product or variant rows; thresholds are never negative, so every
 * out-of-stock line is also at or below its threshold.
 */
export async function loadInventorySummary(
  prisma: Pick<PrismaService, "inventoryStock" | "product" | "stockBatch">,
  warehouseId: InventoryWarehouseFilter,
  nearExpiryDays: number,
  now = new Date()
) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + nearExpiryDays);
  const stockLines = warehouseId === undefined ? {} : { warehouseId };
  const [
    trackedItems,
    outOfStockItems,
    atOrBelowThresholdItems,
    nearExpiryBatches,
    totals,
    assignedProducts
  ] = await Promise.all([
    prisma.inventoryStock.count({ where: stockLines }),
    prisma.inventoryStock.count({
      where: { ...stockLines, availableQuantity: { lte: 0 } }
    }),
    prisma.inventoryStock.count({
      where: {
        ...stockLines,
        availableQuantity: { lte: prisma.inventoryStock.fields.reorderLevel }
      }
    }),
    prisma.stockBatch.count({
      where: {
        ...stockLines,
        expiryDate: { gte: now, lte: cutoff },
        quantity: { gt: 0 }
      }
    }),
    prisma.inventoryStock.aggregate({
      _sum: { availableQuantity: true, reservedQuantity: true },
      where: stockLines
    }),
    prisma.product.count({
      where: {
        deletedAt: null,
        warehouses: { some: { ...stockLines, warehouse: { deletedAt: null } } }
      }
    })
  ]);

  return {
    assignedProducts,
    availableUnits: totals._sum.availableQuantity ?? 0,
    inStockItems: trackedItems - atOrBelowThresholdItems,
    lowStockItems: atOrBelowThresholdItems - outOfStockItems,
    nearExpiryBatches,
    nearExpiryDays,
    outOfStockItems,
    reservedUnits: totals._sum.reservedQuantity ?? 0,
    trackedItems
  };
}
