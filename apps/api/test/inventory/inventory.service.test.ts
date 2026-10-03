import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { InventoryService } from "../../src/modules/inventory/inventory.service";
import {
  AdjustStockDto,
  StockInDto,
  TransferStockDto
} from "../../src/modules/inventory/dto/inventory.dto";
import { StockMovementType } from "../../src/generated/prisma/enums";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";

const now = new Date("2026-05-25T10:00:00.000Z");
type InventoryProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
type ExistingDispositionMovement = {
  quantity: number;
  referenceId: string | null;
};

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
  existingDispositionMovements = [],
  movementRows = [],
  orderStatus = "RETURNED",
  productStatus = "ACTIVE"
}: {
  existingDispositionMovements?: ExistingDispositionMovement[];
  movementRows?: Array<{
    createdAt: Date;
    id: string;
    notes: string | null;
    productId: string;
    quantity: number;
    referenceId: string | null;
    referenceType: string | null;
    type: StockMovementType;
    variantId: string | null;
    warehouseId: string;
  }>;
  orderStatus?: "CREATED" | "RETURNED";
  productStatus?: InventoryProductStatus;
} = {}) {
  const calls: Record<string, unknown[]> = {
    adminAuditLogCreate: [],
    inventoryStockCount: [],
    inventoryStockCreate: [],
    inventoryStockFindFirst: [],
    inventoryStockFindMany: [],
    inventoryStockUpdate: [],
    orderFindFirst: [],
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
  const stockProduct = {
    id: "product-1",
    name: "Curved Artery Forceps",
    sku: "CAF-001",
    status: "ACTIVE"
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
      count: async (args: unknown) => {
        calls.inventoryStockCount.push(args);
        return 1;
      },
      fields: { reorderLevel: "reorderLevel" },
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
        return [{ ...stock, product: stockProduct, variant: null }];
      },
      update: async (args: {
        data?: { availableQuantity?: { increment?: number } };
      }) => {
        calls.inventoryStockUpdate.push(args);
        const increment = args.data?.availableQuantity?.increment ?? 0;
        return {
          ...stock,
          availableQuantity: stock.availableQuantity + increment
        };
      }
    },
    order: {
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        return {
          deletedAt: null,
          id: "order-1",
          items: [
            {
              id: "order-item-1",
              name: "Curved Artery Forceps",
              productId: "product-1",
              quantity: 3,
              stockBatchId: "batch-1",
              variantId: null,
              warehouseId: "warehouse-1"
            },
            {
              id: "order-item-2",
              name: "Suture Pack",
              productId: "product-1",
              quantity: 2,
              stockBatchId: "batch-1",
              variantId: null,
              warehouseId: "warehouse-1"
            }
          ],
          orderNumber: "ORD-RETURN-1",
          status: orderStatus
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
      count: async () => 1,
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
      count: async () => movementRows.length,
      create: async (args: unknown) => {
        calls.stockMovementCreate.push(args);
        return { id: `movement-${calls.stockMovementCreate.length}` };
      },
      findMany: async (args: unknown) => {
        calls.stockMovementFindMany.push(args);
        return movementRows.length > 0 ? movementRows : existingDispositionMovements;
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
          batchNumber: "BATCH-1",
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
      batchNumber: "BATCH-1",
      productId: "product-1",
      quantityDelta: -7,
      reason: "Cycle count correction",
      warehouseId: "warehouse-1"
    },
    actionContext()
  );

  assert.equal(result.availableQuantity, 3);
  assert.equal(prisma.calls.stockBatchUpdate.length, 1);
  assert.deepEqual(
    (
      prisma.calls.stockBatchUpdate[0] as {
        data: { quantity: { increment: number } };
      }
    ).data.quantity,
    { increment: -7 }
  );
  assert.equal(queue.lowStockJobs.length, 1);
  assert.deepEqual(
    {
      availableQuantity: (queue.lowStockJobs[0] as { availableQuantity: number })
        .availableQuantity,
      productId: (queue.lowStockJobs[0] as { productId: string }).productId,
      reorderLevel: (queue.lowStockJobs[0] as { reorderLevel: number }).reorderLevel,
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
      batchNumber: (queue.nearExpiryJobs[0] as { batchNumber: string }).batchNumber,
      expiryDate: (queue.nearExpiryJobs[0] as { expiryDate: string }).expiryDate,
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
      batchNumber: "BATCH-1",
      fromWarehouseId: "warehouse-1",
      productId: "product-1",
      quantity: 3,
      toWarehouseId: "warehouse-2"
    },
    actionContext()
  );

  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1", "warehouse-2"]);
  assert.deepEqual(
    prisma.calls.stockBatchUpdate.map(
      (call) =>
        (call as { data: { quantity: { increment: number } } }).data.quantity.increment
    ),
    [-3, 3]
  );
  assert.equal(prisma.calls.stockMovementCreate.length, 2);
  assert.deepEqual(
    prisma.calls.stockMovementCreate.map(
      (call) => (call as { data: { type: string } }).data.type
    ),
    ["OUT", "IN"]
  );
});

test("dispositionReturnedItems restocks saleable returns and records quarantined returns", async () => {
  const prisma = createInventoryPrismaMock();
  const access = new FakeWarehouseAccess();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    access as unknown as WarehouseAccessService
  );

  const result = await service.dispositionReturnedItems(
    {
      items: [
        {
          disposition: "RESTOCK",
          orderItemId: "order-item-1",
          quantity: 2
        },
        {
          disposition: "QUARANTINE",
          note: "Packaging seal broken.",
          orderItemId: "order-item-2",
          quantity: 1
        }
      ],
      note: "Return inspection complete.",
      orderId: "order-1"
    },
    actionContext()
  );

  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1"]);
  assert.equal(result.orderId, "order-1");
  assert.deepEqual(
    result.items.map((item) => ({
      disposition: item.disposition,
      movementId: item.movementId,
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      restocked: item.restocked
    })),
    [
      {
        disposition: "RESTOCK",
        movementId: "movement-1",
        orderItemId: "order-item-1",
        quantity: 2,
        restocked: true
      },
      {
        disposition: "QUARANTINE",
        movementId: "movement-2",
        orderItemId: "order-item-2",
        quantity: 1,
        restocked: false
      }
    ]
  );
  assert.equal(prisma.calls.inventoryStockUpdate.length, 1);
  assert.deepEqual(prisma.calls.inventoryStockUpdate[0], {
    data: {
      availableQuantity: {
        increment: 2
      }
    },
    where: {
      id: "stock-1"
    }
  });
  assert.equal(prisma.calls.stockBatchUpdate.length, 1);
  assert.deepEqual(
    prisma.calls.stockMovementCreate.map(
      (call) =>
        (call as { data: { metadata: { disposition: string }; type: string } }).data
          .metadata.disposition
    ),
    ["RESTOCK", "QUARANTINE"]
  );
  assert.deepEqual(
    prisma.calls.stockMovementCreate
      .map(
        (call) =>
          (
            call as {
              data: {
                referenceId: string;
                referenceType: string;
                type: string;
              };
            }
          ).data
      )
      .map((movement) => ({
        referenceId: movement.referenceId,
        referenceType: movement.referenceType,
        type: movement.type
      })),
    [
      {
        referenceId: "order-item-1",
        referenceType: "RETURN_DISPOSITION",
        type: "RETURN"
      },
      {
        referenceId: "order-item-2",
        referenceType: "RETURN_DISPOSITION",
        type: "RETURN"
      }
    ]
  );
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("dispositionReturnedItems rejects quantities above the remaining returned item quantity", async () => {
  const prisma = createInventoryPrismaMock({
    existingDispositionMovements: [
      {
        quantity: 2,
        referenceId: "order-item-1"
      }
    ]
  });
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.dispositionReturnedItems(
        {
          items: [
            {
              disposition: "SCRAP",
              orderItemId: "order-item-1",
              quantity: 2
            }
          ],
          orderId: "order-1"
        },
        actionContext()
      ),
    BadRequestException
  );
  assert.equal(prisma.calls.stockMovementCreate.length, 0);
});

test("listInventory scopes non-super-admins to assigned warehouses", async () => {
  const prisma = createInventoryPrismaMock();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess([
      "warehouse-1",
      "warehouse-2"
    ]) as unknown as WarehouseAccessService
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

const stockListInclude = {
  product: { select: { id: true, name: true, sku: true, status: true } },
  variant: { select: { id: true, name: true, sku: true } }
};

test("listInventory names each stocked product and pages one warehouse in the database", async () => {
  const prisma = createInventoryPrismaMock();
  const access = new FakeWarehouseAccess();
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    access as unknown as WarehouseAccessService
  );

  const result = await service.listInventory(
    { limit: 10, page: 2, search: " forceps ", warehouseId: "warehouse-1" },
    adminAuth()
  );
  const where = {
    OR: [
      { product: { name: { contains: "forceps", mode: "insensitive" } } },
      { product: { sku: { contains: "forceps", mode: "insensitive" } } }
    ],
    warehouseId: "warehouse-1"
  };

  assert.deepEqual(prisma.calls.inventoryStockFindMany, [{
    include: stockListInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: 10,
    take: 10,
    where
  }]);
  assert.deepEqual(prisma.calls.inventoryStockCount, [{ where }]);
  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1"]);
  assert.deepEqual(result.items, [{
    availableQuantity: 10,
    id: "stock-1",
    lowStockThreshold: 5,
    product: { id: "product-1", name: "Curved Artery Forceps", sku: "CAF-001", status: "ACTIVE" },
    productId: "product-1",
    reservedQuantity: 0,
    variant: null,
    variantId: null,
    warehouseId: "warehouse-1"
  }]);
});

test("listLowStock compares stock with its threshold and pages in the database", async () => {
  const prisma = createInventoryPrismaMock();
  prisma.inventoryStock.count = async (args: unknown) => {
    prisma.calls.inventoryStockCount.push(args);
    return 3;
  };
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.listLowStock({ limit: 1, page: 1, warehouseId: "warehouse-1" }, adminAuth());
  const where = {
    availableQuantity: { lte: "reorderLevel" },
    warehouseId: "warehouse-1"
  };

  assert.deepEqual(prisma.calls.inventoryStockFindMany, [{
    include: stockListInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip: 0,
    take: 1,
    where
  }]);
  assert.deepEqual(prisma.calls.inventoryStockCount, [{ where }]);
  assert.equal(result.pagination.total, 3);
  assert.equal(result.pagination.totalPages, 3);
  assert.equal(result.items[0]?.product.name, "Curved Artery Forceps");
});

test("stock changes keep returning the stock row without product details", async () => {
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

  assert.deepEqual(result, {
    availableQuantity: 14,
    id: "stock-1",
    lowStockThreshold: 5,
    productId: "product-1",
    reservedQuantity: 0,
    variantId: null,
    warehouseId: "warehouse-1"
  });
});

test("near-expiry and movement searches filter by product name or SKU", async () => {
  const prisma = createInventoryPrismaMock({
    movementRows: [
      {
        createdAt: now,
        id: "movement-1",
        notes: "Cycle count correction.",
        productId: "product-1",
        quantity: -2,
        referenceId: null,
        referenceType: "STOCK_ADJUSTMENT",
        type: StockMovementType.ADJUSTMENT,
        variantId: null,
        warehouseId: "warehouse-1"
      }
    ]
  });
  const service = new InventoryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.listNearExpiry(
    { search: "forceps" },
    adminAuth(AdminRoleCode.SuperAdmin)
  );
  const movements = await service.listMovements(
    { search: "forceps", type: StockMovementType.ADJUSTMENT },
    adminAuth(AdminRoleCode.SuperAdmin)
  );

  const expectedSearch = [
    {
      product: {
        name: { contains: "forceps", mode: "insensitive" }
      }
    },
    {
      product: {
        sku: { contains: "forceps", mode: "insensitive" }
      }
    }
  ];
  assert.deepEqual(
    (prisma.calls.stockBatchFindMany[0] as { where: { OR: unknown } }).where.OR,
    expectedSearch
  );
  assert.deepEqual(
    (prisma.calls.stockMovementFindMany[0] as { where: { OR: unknown } }).where.OR,
    expectedSearch
  );
  assert.deepEqual(movements.items[0], {
    createdAt: now,
    id: "movement-1",
    notes: "Cycle count correction.",
    productId: "product-1",
    quantity: -2,
    referenceId: null,
    referenceType: "STOCK_ADJUSTMENT",
    type: StockMovementType.ADJUSTMENT,
    variantId: null,
    warehouseId: "warehouse-1"
  });
});

test("inventory mutation DTOs reject blank batch numbers", async () => {
  const shared = {
    batchNumber: "   ",
    productId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
    warehouseId: "9d9f8f33-d348-4a89-94e8-907be76a91c6"
  };
  const [stockInErrors, adjustmentErrors, transferErrors] = await Promise.all([
    validate(
      plainToInstance(StockInDto, {
        ...shared,
        mrp: 3,
        purchasePrice: 1,
        quantity: 1,
        sellingPrice: 2
      })
    ),
    validate(
      plainToInstance(AdjustStockDto, {
        ...shared,
        quantityDelta: 1,
        reason: "Cycle count"
      })
    ),
    validate(
      plainToInstance(TransferStockDto, {
        ...shared,
        fromWarehouseId: shared.warehouseId,
        quantity: 1,
        toWarehouseId: "8d9f8f33-d348-4a89-94e8-907be76a91c6"
      })
    )
  ]);

  for (const errors of [stockInErrors, adjustmentErrors, transferErrors]) {
    assert.equal(
      errors.some((error) => error.property === "batchNumber"),
      true
    );
  }
});
