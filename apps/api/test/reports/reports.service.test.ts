import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { ReportsService } from "../../src/modules/reports/reports.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

function adminAuth(role = AdminRoleCode.WarehouseManager): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [],
    role,
    sessionId: "admin-session-1",
    sub: "admin-1",
    tokenType: "access"
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

function createReportsPrismaMock() {
  const calls: Record<string, unknown[]> = {
    adminUserCount: [],
    deliveryPartnerCount: [],
    inventoryStockCount: [],
    orderAggregate: [],
    orderCount: [],
    queryRaw: [],
    stockBatchCount: [],
    userCount: [],
    warehouseCount: []
  };

  const prisma = {
    calls,
    $queryRaw: async (query: unknown) => {
      calls.queryRaw.push(query);
      const index = calls.queryRaw.length;

      if (index === 1) {
        return [{ date: "2026-05-01", orders: 2 }];
      }
      if (index === 2) {
        return [{ date: "2026-05-01", revenue: "320.50" }];
      }
      if (index === 3) {
        return [
          {
            name: "Curved Forceps",
            productId: "product-1",
            quantity: 5,
            revenue: "600.00",
            sku: "FORCEPS-001"
          }
        ];
      }

      return [
        {
          activeBatches: 4,
          availableQuantity: 12,
          lowStockProducts: 1,
          nearExpiryBatches: 2,
          reservedQuantity: 3,
          warehouseCode: "DEL-01",
          warehouseId: "warehouse-1",
          warehouseName: "Delhi warehouse"
        }
      ];
    },
    adminUser: {
      count: async (args: unknown) => {
        calls.adminUserCount.push(args);
        return 4;
      }
    },
    deliveryPartner: {
      count: async (args: unknown) => {
        calls.deliveryPartnerCount.push(args);
        return 5;
      }
    },
    inventoryStock: {
      fields: {
        reorderLevel: "reorderLevel"
      },
      count: async (args: unknown) => {
        calls.inventoryStockCount.push(args);
        return 3;
      }
    },
    order: {
      aggregate: async (args: unknown) => {
        calls.orderAggregate.push(args);
        return {
          _sum: {
            grandTotal: "1200.25"
          }
        };
      },
      count: async (args: unknown) => {
        calls.orderCount.push(args);
        return calls.orderCount.length === 1 ? 9 : 2;
      }
    },
    stockBatch: {
      count: async (args: unknown) => {
        calls.stockBatchCount.push(args);
        return 6;
      }
    },
    user: {
      count: async (args: unknown) => {
        calls.userCount.push(args);
        return 7;
      }
    },
    warehouse: {
      count: async (args: unknown) => {
        calls.warehouseCount.push(args);
        return 1;
      }
    }
  };

  return prisma;
}

test("admin dashboard reports apply date filters and assigned warehouse scope", async () => {
  const prisma = createReportsPrismaMock();
  const service = new ReportsService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService
  );

  const result = await service.getDashboard(
    {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26"
    },
    adminAuth()
  );

  assert.deepEqual(result.filters.warehouseScope, {
    allWarehouses: false,
    warehouseIds: ["warehouse-1"]
  });
  assert.equal(result.cards.totalOrders, 9);
  assert.equal(result.cards.todayOrders, 2);
  assert.equal(result.cards.revenue, 1200.25);
  assert.equal(result.cards.lowStockProducts, 3);
  assert.equal(result.cards.nearExpiryBatches, 6);
  assert.equal(result.cards.activeCustomers, 7);
  assert.equal(result.cards.activeDeliveryPartners, 5);
  assert.equal(result.cards.activeWarehouses, 1);
  assert.deepEqual(result.charts.ordersByDay, [
    {
      date: "2026-05-01",
      orders: 2
    }
  ]);
  assert.deepEqual(result.charts.warehouseStockSummary, [
    {
      activeBatches: 4,
      availableQuantity: 12,
      lowStockProducts: 1,
      nearExpiryBatches: 2,
      reservedQuantity: 3,
      warehouseCode: "DEL-01",
      warehouseId: "warehouse-1",
      warehouseName: "Delhi warehouse"
    }
  ]);

  const firstOrderCount = prisma.calls.orderCount[0] as {
    where: { createdAt: { gte: Date; lte: Date }; warehouseId: { in: string[] } };
  };
  assert.deepEqual(firstOrderCount.where.warehouseId, {
    in: ["warehouse-1"]
  });
  assert.equal(
    firstOrderCount.where.createdAt.gte.toISOString(),
    "2026-05-01T00:00:00.000Z"
  );
  assert.equal(
    firstOrderCount.where.createdAt.lte.toISOString(),
    "2026-05-26T23:59:59.999Z"
  );
});

test("admin dashboard reports validate an explicit warehouse filter", async () => {
  const prisma = createReportsPrismaMock();
  const warehouseAccess = new FakeWarehouseAccess(["warehouse-2"]);
  const service = new ReportsService(
    prisma as unknown as PrismaService,
    warehouseAccess as unknown as WarehouseAccessService
  );

  const result = await service.getDashboard(
    {
      warehouseId: "warehouse-2"
    },
    adminAuth()
  );

  assert.deepEqual(warehouseAccess.assertedWarehouseIds, ["warehouse-2"]);
  assert.equal(result.filters.warehouseId, "warehouse-2");

  const firstOrderCount = prisma.calls.orderCount[0] as {
    where: { warehouseId: string };
  };
  assert.equal(firstOrderCount.where.warehouseId, "warehouse-2");
});

test("admin dashboard stock reports pre-aggregate warehouse inventory and batches", async () => {
  const prisma = createReportsPrismaMock();
  const service = new ReportsService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService
  );

  await service.getDashboard({}, adminAuth(AdminRoleCode.SuperAdmin));

  const stockAlertsSql = getRawSql(prisma.calls.queryRaw[3]);
  const warehouseSummarySql = getRawSql(prisma.calls.queryRaw[4]);

  assert.match(stockAlertsSql, /inventory_alerts/);
  assert.match(stockAlertsSql, /batch_alerts/);
  assert.doesNotMatch(stockAlertsSql, /LEFT JOIN\s+"InventoryStock"/);
  assert.doesNotMatch(stockAlertsSql, /LEFT JOIN\s+"StockBatch"/);

  assert.match(warehouseSummarySql, /inventory_summary/);
  assert.match(warehouseSummarySql, /batch_summary/);
  assert.doesNotMatch(warehouseSummarySql, /LEFT JOIN\s+"InventoryStock"/);
  assert.doesNotMatch(warehouseSummarySql, /LEFT JOIN\s+"StockBatch"/);
});

function getRawSql(query: unknown) {
  if (Array.isArray(query)) {
    return query.join("?");
  }

  if (query && typeof query === "object" && "sql" in query) {
    return String((query as { sql: string }).sql);
  }

  return String(query);
}
