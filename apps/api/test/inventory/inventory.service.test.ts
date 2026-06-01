import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { InventoryService } from "../../src/modules/inventory/inventory.service";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";

const now = new Date("2026-05-25T10:00:00.000Z");
type InventoryProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

function adminAuth(role = AdminRoleCode.InventoryManager): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [],
    role,
    sessionId: "session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

function actionContext(role = AdminRoleCode.InventoryManager) {
  return {
    auth: adminAuth(role),
    ipAddress: "127.0.0.1",
    userAgent: "node-test"
  };
}

class FakeWarehouseAccess {
  readonly assertedWarehouseIds: string[] = [];

  constructor(private readonly scopeWarehouseIds: string[] = ["warehouse-1"]) {}

  async assertCanManageWarehouse(_auth: AuthJwtPayload, warehouseId: string) {
    this.assertedWarehouseIds.push(warehouseId);
  }

  async getWarehouseScope(auth: AuthJwtPayload) {
    if (auth.role === AdminRoleCode.SuperAdmin) {
      return {
        allWarehouses: true as const
      };
    }

    return {
      allWarehouses: false as const,
      warehouseIds: this.scopeWarehouseIds
    };
  }
}

class FakeInventoryQueue {
  readonly lowStockJobs: unknown[] = [];
  readonly nearExpiryJobs: unknown[] = [];

  async enqueueLowStockAlert(data: unknown) {
    this.lowStockJobs.push(data);
  }

  async enqueueNearExpiryAlert(data: unknown) {
    this.nearExpiryJobs.push(data);
  }
}

function createInventoryPrismaMock({
  productStatus = "ACTIVE"
}: { productStatus?: InventoryProductStatus } = {}) {
  const calls: Record<string, unknown[]> = {
    adminAuditLogCreate: [],
    inventoryStockCreate: [],
    inventoryStockFindFirst: [],
    inventoryStockFindMany: [],
    inventoryStockUpdate: [],
    productFindFirst: [],
    productUpdate: [],
    stockBatchCreate: [],
    stockBatchFindFirst: [],
    stockBatchFindMany: [],
    stockBatchUpdate: [],
    stockMovementCreate: [],
    stockMovementFindMany: [],
    warehouseFindFirst: []
  };
  const stock = {
    availableQuantity: 10,
    createdAt: now,
    id: "stock-1",
    productId: "product-1",
    reorderLevel: 5,
    reservedQuantity: 0,
    updatedAt: now,
    variantId: null,
    warehouseId: "warehouse-1"
  };
  const batch = {
    batchNumber: "BATCH-1",
    createdAt: now,
    expiryDate: new Date("2026-07-01T00:00:00.000Z"),
    id: "batch-1",
    mrp: "150.00",
    productId: "product-1",
    purchasePrice: "90.00",
    quantity: 10,
    sellingPrice: "120.00",
    updatedAt: now,
    variantId: null,
    warehouseId: "warehouse-1"
  };
  const prisma = {
    calls,
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma),
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    inventoryStock: {
      count: async () => 1,
      create: async (args: unknown) => {
        calls.inventoryStockCreate.push(args);
        return stock;
      },
      findFirst: async (args: unknown) => {
        calls.inventoryStockFindFirst.push(args);
        return stock;
      },
      findMany: async (args: unknown) => {
        calls.inventoryStockFindMany.push(args);
        return [stock];
      },
      update: async (args: { data?: { availableQuantity?: { increment?: number } } }) => {
        calls.inventoryStockUpdate.push(args);
        const increment = args.data?.availableQuantity?.increment ?? 0;
        return {
          ...stock,
          availableQuantity: stock.availableQuantity + increment
        };
      }
    },
    product: {
      findFirst: async (args: unknown) => {
        calls.productFindFirst.push(args);
        return {
          deletedAt: null,
          id: "product-1",
          status: productStatus
        };
      },
      update: async (args: unknown) => {
        calls.productUpdate.push(args);
        return {
          deletedAt: null,
          id: "product-1",
          status: "ACTIVE"
        };
      }
    },
    productVariant: {
      findFirst: async () => null
    },
    stockBatch: {
      create: async (args: unknown) => {
        calls.stockBatchCreate.push(args);
        return batch;
      },
      findFirst: async (args: unknown) => {
        calls.stockBatchFindFirst.push(args);
        return batch;
      },
      findMany: async (args: unknown) => {
        calls.stockBatchFindMany.push(args);
        return [batch];
      },
      update: async (args: {
        data?: {
          expiryDate?: Date | null;
          quantity?: { increment?: number };
        };
      }) => {
        calls.stockBatchUpdate.push(args);
        const increment = args.data?.quantity?.increment ?? 0;
        return {
          ...batch,
          expiryDate: args.data?.expiryDate ?? batch.expiryDate,
          quantity: batch.quantity + increment
        };
      }
    },
    stockMovement: {
      create: async (args: unknown) => {
        calls.stockMovementCreate.push(args);
        return { id: `movement-${calls.stockMovementCreate.length}` };
      },
      findMany: async (args: unknown) => {
        calls.stockMovementFindMany.push(args);
        return [];
      }
    },
    warehouse: {
      findFirst: async (args: unknown) => {
        calls.warehouseFindFirst.push(args);
        return {
          deletedAt: null,
          id: "warehouse-1",
          status: "ACTIVE"
        };
      }
    }
  };

  return prisma;
}

test("stockIn updates aggregate stock, batch quantity, movement audit, and admin audit in one transaction", async () => {
  const prisma = createInventoryPrismaMock();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.stockIn(
    {
      batchNumber: "BATCH-1",
      expiryDate: "2026-07-01",
      lowStockThreshold: 5,
      mrp: 150,
      productId: "product-1",
      purchasePrice: 90,
      quantity: 4,
      sellingPrice: 120,
      warehouseId: "warehouse-1"
    },
    actionContext()
  );

  assert.equal(result.availableQuantity, 14);
  assert.equal(prisma.calls.inventoryStockUpdate.length, 1);
  assert.equal(prisma.calls.stockBatchUpdate.length, 1);
  assert.equal(prisma.calls.stockMovementCreate.length, 1);
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("stockIn publishes draft products once saleable stock is received", async () => {
  const prisma = createInventoryPrismaMock({ productStatus: "DRAFT" });
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.stockIn(
    {
      batchNumber: "BATCH-1",
      expiryDate: "2026-07-01",
      lowStockThreshold: 5,
      mrp: 150,
      productId: "product-1",
      purchasePrice: 90,
      quantity: 4,
      sellingPrice: 120,
      warehouseId: "warehouse-1"
    },
    actionContext()
  );

  assert.deepEqual(prisma.calls.productUpdate[0], {
    data: {
      status: "ACTIVE"
    },
    where: {
      id: "product-1"
    }
  });
});

test("adjustStock rejects negative aggregate stock", async () => {
  const prisma = createInventoryPrismaMock();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.adjustStock(
        {
          productId: "product-1",
          quantityDelta: -99,
          reason: "Cycle count correction",
          warehouseId: "warehouse-1"
        },
        actionContext()
      ),
    BadRequestException
  );
});

test("adjustStock enqueues a low stock alert when stock falls below reorder level", async () => {
  const prisma = createInventoryPrismaMock();
  const queue = new FakeInventoryQueue();
  const service = new (InventoryService as unknown as new (
    prisma: PrismaService,
    warehouseAccessService: WarehouseAccessService,
    queue: FakeInventoryQueue
  ) => InventoryService)(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    queue
  );

  const result = await service.adjustStock(
    {
      productId: "product-1",
      quantityDelta: -7,
      reason: "Cycle count correction",
      warehouseId: "warehouse-1"
    },
    actionContext()
  );

  assert.equal(result.availableQuantity, 3);
  assert.equal(queue.lowStockJobs.length, 1);
  assert.deepEqual(
    {
      availableQuantity: (
        queue.lowStockJobs[0] as { availableQuantity: number }
      ).availableQuantity,
      productId: (queue.lowStockJobs[0] as { productId: string }).productId,
      reorderLevel: (queue.lowStockJobs[0] as { reorderLevel: number })
        .reorderLevel,
      version: (queue.lowStockJobs[0] as { version: number }).version,
      warehouseId: (queue.lowStockJobs[0] as { warehouseId: string }).warehouseId
    },
    {
      availableQuantity: 3,
      productId: "product-1",
      reorderLevel: 5,
      version: 1,
      warehouseId: "warehouse-1"
    }
  );
});

test("stockIn enqueues a near expiry alert for batches expiring within 30 days", async () => {
  const prisma = createInventoryPrismaMock();
  const queue = new FakeInventoryQueue();
  const service = new (InventoryService as unknown as new (
    prisma: PrismaService,
    warehouseAccessService: WarehouseAccessService,
    queue: FakeInventoryQueue
  ) => InventoryService)(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    queue
  );
  const nearExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await service.stockIn(
    {
      batchNumber: "BATCH-1",
      expiryDate: nearExpiryDate.toISOString(),
      lowStockThreshold: 5,
      mrp: 150,
      productId: "product-1",
      purchasePrice: 90,
      quantity: 4,
      sellingPrice: 120,
      warehouseId: "warehouse-1"
    },
    actionContext()
  );

  assert.equal(queue.nearExpiryJobs.length, 1);
  assert.deepEqual(
    {
      batchId: (queue.nearExpiryJobs[0] as { batchId: string }).batchId,
      batchNumber: (queue.nearExpiryJobs[0] as { batchNumber: string })
        .batchNumber,
      expiryDate: (queue.nearExpiryJobs[0] as { expiryDate: string })
        .expiryDate,
      productId: (queue.nearExpiryJobs[0] as { productId: string }).productId,
      version: (queue.nearExpiryJobs[0] as { version: number }).version,
      warehouseId: (queue.nearExpiryJobs[0] as { warehouseId: string }).warehouseId
    },
    {
      batchId: "batch-1",
      batchNumber: "BATCH-1",
      expiryDate: nearExpiryDate.toISOString(),
      productId: "product-1",
      version: 1,
      warehouseId: "warehouse-1"
    }
  );
});

test("transferStock creates paired source OUT and destination IN movements", async () => {
  const prisma = createInventoryPrismaMock();
  const access = new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]);
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    access as unknown as WarehouseAccessService
  );

  await service.transferStock(
    {
      fromWarehouseId: "warehouse-1",
      productId: "product-1",
      quantity: 3,
      toWarehouseId: "warehouse-2"
    },
    actionContext()
  );

  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1", "warehouse-2"]);
  assert.equal(prisma.calls.stockMovementCreate.length, 2);
  assert.deepEqual(
    prisma.calls.stockMovementCreate.map(
      (call) => (call as { data: { type: string } }).data.type
    ),
    ["OUT", "IN"]
  );
});

test("listInventory scopes non-super-admins to assigned warehouses", async () => {
  const prisma = createInventoryPrismaMock();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await service.listInventory({}, adminAuth(AdminRoleCode.InventoryManager));

  assert.equal(prisma.calls.inventoryStockFindMany.length, 1);
  assert.deepEqual(
    (prisma.calls.inventoryStockFindMany[0] as { where: unknown }).where,
    {
      warehouseId: {
        in: ["warehouse-1", "warehouse-2"]
      }
    }
  );
});
