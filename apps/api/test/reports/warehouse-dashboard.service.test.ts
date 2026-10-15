import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience, type AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { ReportsController } from "../../src/modules/reports/reports.controller";
import { WarehouseDashboardService } from "../../src/modules/reports/warehouse-dashboard.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

const now = new Date("2026-10-15T09:00:00.000Z");

function auth(role: string = AdminRoleCode.WarehouseManager): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [PermissionCode.ReportsRead],
    role,
    sessionId: "session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

function createAccess(warehouseIds: string[]) {
  return {
    assertCanManageWarehouse: async (admin: AuthJwtPayload, warehouseId: string) => {
      if (admin.role !== AdminRoleCode.SuperAdmin && !warehouseIds.includes(warehouseId)) {
        throw new ForbiddenException("Admin is not assigned to this warehouse.");
      }
    },
    getWarehouseScope: async (admin: AuthJwtPayload) =>
      admin.role === AdminRoleCode.SuperAdmin
        ? { allWarehouses: true as const }
        : { allWarehouses: false as const, warehouseIds }
  };
}

/** Answers every dashboard query with fixed figures and records the filters it was given. */
function createDashboardPrismaMock(warehouses = [{ city: "Delhi", code: "DEL-01", id: "warehouse-1", name: "Delhi", state: "Delhi", status: "ACTIVE" }]) {
  const calls: Record<string, unknown[]> = {
    assignmentCount: [],
    orderCount: [],
    orderGroupBy: [],
    partnerCount: [],
    warehouseFindMany: []
  };
  const counts = {
    assignments: [2, 3, 5, 1],
    partners: [6, 4, 3, 1]
  };
  const prisma = {
    deliveryAssignment: {
      count: async (args: unknown) => {
        calls.assignmentCount.push(args);
        return counts.assignments.shift() ?? 0;
      },
      findMany: async () => [
        {
          assignedAt: now,
          deliveryPartner: { fullName: "Vikram Singh", mobileNumber: "+919000000101" },
          id: "assignment-1",
          order: { orderNumber: "ORD-7", warehouse: { name: "Delhi" } },
          orderId: "order-7",
          pickupWarehouse: null,
          status: "OUT_FOR_DELIVERY",
          updatedAt: now
        }
      ],
      groupBy: async () => [
        { _count: { _all: 18 }, status: "DELIVERED" },
        { _count: { _all: 2 }, status: "FAILED" }
      ]
    },
    deliveryPartner: {
      count: async (args: unknown) => {
        calls.partnerCount.push(args);
        return counts.partners.shift() ?? 0;
      },
      findMany: async () => [
        {
          _count: { assignments: 1 },
          fullName: "Vikram Singh",
          id: "partner-1",
          isOnline: true,
          lastSeenAt: now,
          mobileNumber: "+919000000101",
          vehicleNumber: "DL01AB1234"
        }
      ]
    },
    inventoryStock: {
      aggregate: async () => ({ _sum: { availableQuantity: 900, reservedQuantity: 40 } }),
      count: async () => 0,
      fields: { reorderLevel: "reorderLevel" },
      findMany: async () => [
        {
          availableQuantity: 0,
          id: "stock-1",
          product: { name: "Suture Pack", sku: "SUT-1" },
          productId: "product-1",
          reorderLevel: 5,
          variant: null,
          variantId: null,
          warehouse: { name: "Delhi" },
          warehouseId: "warehouse-1"
        }
      ]
    },
    order: {
      count: async (args: unknown) => {
        calls.orderCount.push(args);
        return 7;
      },
      findFirst: async () => ({ createdAt: now, placedAt: new Date("2026-10-14T08:00:00.000Z") }),
      findMany: async () => [],
      groupBy: async (args: unknown) => {
        calls.orderGroupBy.push(args);
        return [
          { _count: { _all: 30 }, status: "DELIVERED" },
          { _count: { _all: 6 }, status: "RETURNED" },
          { _count: { _all: 4 }, status: "CANCELLED" },
          { _count: { _all: 10 }, status: "PACKED" }
        ];
      }
    },
    product: { count: async () => 0 },
    stockBatch: { count: async () => 0 },
    warehouse: {
      findMany: async (args: unknown) => {
        calls.warehouseFindMany.push(args);
        return warehouses;
      }
    }
  };

  return { calls, prisma };
}

test("warehouse dashboard limits every figure to the admin's warehouses", async () => {
  const { calls, prisma } = createDashboardPrismaMock();
  const service = new WarehouseDashboardService(
    prisma as unknown as PrismaService,
    createAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  const dashboard = await service.getDashboard({ dateFrom: "2026-09-16", dateTo: "2026-10-15" }, auth());
  const scope = { in: ["warehouse-1", "warehouse-2"] };

  assert.deepEqual((calls.warehouseFindMany[0] as { where: unknown }).where, {
    deletedAt: null,
    id: scope
  });
  assert.deepEqual((calls.orderCount[0] as { where: unknown }).where, {
    deletedAt: null,
    status: { in: ["CONFIRMED", "PACKED"] },
    warehouseId: scope
  });
  assert.deepEqual((calls.partnerCount[0] as { where: unknown }).where, {
    deletedAt: null,
    status: "ACTIVE",
    warehouses: { some: { warehouseId: scope } }
  });
  // Assignments belong to a warehouse through pickup, or through the order when no pickup is set.
  assert.deepEqual(
    (calls.assignmentCount[0] as { where: { OR: unknown } }).where.OR,
    [{ pickupWarehouseId: scope }, { order: { warehouseId: scope }, pickupWarehouseId: null }]
  );
  assert.deepEqual(
    (calls.orderGroupBy[0] as { where: { warehouseId: unknown } }).where.warehouseId,
    scope
  );

  assert.deepEqual(dashboard.dispatch, {
    awaitingPickup: 2,
    deliveredToday: 5,
    failedToday: 1,
    inTransit: 3,
    oldestReadySince: new Date("2026-10-14T08:00:00.000Z"),
    readyToDispatch: 7
  });
  assert.deepEqual(dashboard.riders, { assigned: 6, available: 1, onDelivery: 3, online: 4 });
  assert.deepEqual(dashboard.fulfillment, {
    cancelled: 4,
    delivered: 36,
    deliveryAttempts: 20,
    deliverySuccessRate: 90,
    fulfillmentRate: 90,
    inProgress: 10,
    ordersPlaced: 50
  });
  assert.deepEqual(dashboard.filters, {
    dateFrom: "2026-09-16",
    dateTo: "2026-10-15",
    warehouseId: null
  });
  assert.equal(dashboard.warehouse?.id, "warehouse-1", "a single assigned warehouse is shown by name");
  assert.deepEqual(dashboard.queues.lowStock[0], {
    availableQuantity: 0,
    id: "stock-1",
    lowStockThreshold: 5,
    productId: "product-1",
    productName: "Suture Pack",
    sku: "SUT-1",
    status: "OUT_OF_STOCK",
    variantId: null,
    variantName: null,
    warehouseId: "warehouse-1",
    warehouseName: "Delhi"
  });
  assert.equal(dashboard.queues.activeDeliveries[0]?.warehouseName, "Delhi");
  assert.equal(dashboard.queues.riders[0]?.activeDeliveries, 1);
});

test("warehouse dashboard narrows to one chosen warehouse and refuses others", async () => {
  const { calls, prisma } = createDashboardPrismaMock([
    { city: "Delhi", code: "DEL-01", id: "warehouse-1", name: "Delhi", state: "Delhi", status: "ACTIVE" },
    { city: "Pune", code: "PUN-01", id: "warehouse-2", name: "Pune", state: "Maharashtra", status: "ACTIVE" }
  ]);
  const service = new WarehouseDashboardService(
    prisma as unknown as PrismaService,
    createAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  const dashboard = await service.getDashboard({ warehouseId: "warehouse-2" }, auth());

  assert.equal(dashboard.warehouse?.name, "Pune");
  assert.equal((calls.orderCount[0] as { where: { warehouseId: unknown } }).where.warehouseId, "warehouse-2");
  await assert.rejects(
    () => service.getDashboard({ warehouseId: "warehouse-9" }, auth()),
    ForbiddenException
  );
});

test("the super admin's warehouse dashboard covers every warehouse until one is chosen", async () => {
  const { calls, prisma } = createDashboardPrismaMock([
    { city: "Delhi", code: "DEL-01", id: "warehouse-1", name: "Delhi", state: "Delhi", status: "ACTIVE" },
    { city: "Pune", code: "PUN-01", id: "warehouse-2", name: "Pune", state: "Maharashtra", status: "ACTIVE" }
  ]);
  const service = new WarehouseDashboardService(
    prisma as unknown as PrismaService,
    createAccess([]) as unknown as WarehouseAccessService
  );

  const dashboard = await service.getDashboard({}, auth(AdminRoleCode.SuperAdmin));

  assert.equal(dashboard.warehouse, null);
  assert.deepEqual((calls.warehouseFindMany[0] as { where: unknown }).where, { deletedAt: null });
  assert.deepEqual((calls.orderCount[0] as { where: unknown }).where, {
    deletedAt: null,
    status: { in: ["CONFIRMED", "PACKED"] }
  });
  assert.deepEqual((calls.partnerCount[0] as { where: unknown }).where, {
    deletedAt: null,
    status: "ACTIVE"
  });
});

test("warehouse dashboard reports no rate until there is something to measure", async () => {
  const { prisma } = createDashboardPrismaMock();
  prisma.order.groupBy = async () => [];
  prisma.deliveryAssignment.groupBy = async () => [];
  const service = new WarehouseDashboardService(
    prisma as unknown as PrismaService,
    createAccess(["warehouse-1"]) as unknown as WarehouseAccessService
  );

  const dashboard = await service.getDashboard({}, auth());

  assert.equal(dashboard.fulfillment.fulfillmentRate, null);
  assert.equal(dashboard.fulfillment.deliverySuccessRate, null);
  assert.equal(dashboard.fulfillment.ordersPlaced, 0);
});

test("the warehouse dashboard route requires reports.read", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      ReportsController.prototype.getWarehouseDashboard
    ),
    [PermissionCode.ReportsRead]
  );
});
