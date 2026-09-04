import { Prisma, WarehouseStatus } from "../../generated/prisma/client";

// Checkout reserves the first available warehouse in this deterministic order.
// Cart delivery quotes use the same query without reserving any stock.
export function buildFulfillmentStockQuery(line: {
  productId: string;
  variantId: string | null;
}) {
  return {
    orderBy: [{ warehouseId: "asc" as const }, { id: "asc" as const }],
    select: {
      availableQuantity: true,
      id: true,
      warehouseId: true
    },
    where: {
      availableQuantity: { gt: 0 },
      productId: line.productId,
      variantId: line.variantId,
      warehouse: { deletedAt: null, status: WarehouseStatus.ACTIVE }
    }
  } satisfies Prisma.InventoryStockFindManyArgs;
}
