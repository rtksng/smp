import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { AdminWarehousesController } from "../../src/modules/warehouses/admin-warehouses.controller";
import { WarehousesService } from "../../src/modules/warehouses/warehouses.service";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";

const now = new Date("2026-05-25T10:00:00.000Z");

function adminAuth(role = AdminRoleCode.WarehouseManager): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [],
    role,
    sessionId: "session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

function actionContext(role = AdminRoleCode.WarehouseManager) {
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

function warehouseRecord(input: Record<string, unknown> = {}) {
  return {
    address: "Plot 1, Surgical Park",
    city: "Mumbai",
    code: "MUM-01",
    contactNumber: "9876543210",
    contactPerson: "Ravi Sharma",
    createdAt: now,
    deletedAt: null,
    id: "warehouse-1",
    latitude: "19.0760000",
    longitude: "72.8777000",
    name: "Mumbai Central Warehouse",
    pincode: "400001",
    state: "Maharashtra",
    status: "ACTIVE",
    updatedAt: now,
    ...input
  };
}

function createWarehousePrismaMock() {
  const calls: Record<string, unknown[]> = {
    adminAuditLogCreate: [],
    inventoryStockCount: [],
    stockBatchCount: [],
    stockMovementCount: [],
    warehouseCount: [],
    warehouseCreate: [],
    warehouseFindFirst: [],
    warehouseFindMany: [],
    warehouseStaffCreate: [],
    warehouseStaffUpdateMany: [],
    warehouseUpdate: []
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
        return 0;
      }
    },
    stockBatch: {
      count: async (args: unknown) => {
        calls.stockBatchCount.push(args);
        return 0;
      }
    },
    stockMovement: {
      count: async (args: unknown) => {
        calls.stockMovementCount.push(args);
        return 0;
      }
    },
    warehouse: {
      findUnique: async (_args: unknown) => ({ _count: { orders: 0, orderItems: 0, deliveryPickups: 0, deliveryChargeRules: 0 } }),
      count: async (args: unknown) => {
        calls.warehouseCount.push(args);
        return 1;
      },
      create: async (args: unknown) => {
        calls.warehouseCreate.push(args);
        return warehouseRecord();
      },
      findFirst: async (args: unknown) => {
        calls.warehouseFindFirst.push(args);
        return warehouseRecord();
      },
      findMany: async (args: unknown) => {
        calls.warehouseFindMany.push(args);
        return [warehouseRecord()];
      },
      update: async (args: unknown) => {
        calls.warehouseUpdate.push(args);
        return warehouseRecord({ status: "INACTIVE" });
      }
    },
    warehouseStaff: {
      updateMany: async (args: unknown) => {
        calls.warehouseStaffUpdateMany.push(args);
        return { count: 1 };
      },
      create: async (args: unknown) => {
        calls.warehouseStaffCreate.push(args);
        return { id: "assignment-1" };
      }
    }
  };

  return prisma;
}

test("createWarehouse creates the warehouse, assigns the creator, and writes audit logs", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.createWarehouse(
    {
      address: "Plot 1, Surgical Park",
      city: "Mumbai",
      code: "MUM-01",
      contactNumber: "9876543210",
      contactPerson: "Ravi Sharma",
      latitude: 19.076,
      longitude: 72.8777,
      name: "Mumbai Central Warehouse",
      pincode: "400001",
      state: "Maharashtra"
    },
    actionContext()
  );

  assert.equal(result.code, "MUM-01");
  assert.equal(prisma.calls.warehouseCreate.length, 1);
  assert.equal(prisma.calls.warehouseStaffCreate.length, 1);
  assert.equal(prisma.calls.adminAuditLogCreate.length, 2);
});

test("listWarehouses scopes non-super-admins to assigned warehouses", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await service.listWarehouses({}, adminAuth(AdminRoleCode.InventoryManager));

  assert.deepEqual(prisma.calls.warehouseFindMany[0], {
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: 0,
    take: 20,
    where: {
      deletedAt: null,
      id: {
        in: ["warehouse-1", "warehouse-2"]
      }
    }
  });
});

test("listWarehouses narrows report links without widening assigned warehouse access", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await service.listWarehouses({ warehouseId: "warehouse-2", status: "ACTIVE" }, adminAuth());
  await service.listWarehouses({ warehouseId: "warehouse-3" }, adminAuth());
  await service.listWarehouses({ warehouseId: "warehouse-3" }, adminAuth(AdminRoleCode.SuperAdmin));

  const expected = [
    { deletedAt: null, id: { in: ["warehouse-2"] }, status: "ACTIVE" },
    { deletedAt: null, id: { in: [] } },
    { deletedAt: null, id: "warehouse-3" }
  ];
  for (const [index, where] of expected.entries()) {
    assert.deepEqual((prisma.calls.warehouseFindMany[index] as { where: unknown }).where, where);
    assert.deepEqual((prisma.calls.warehouseCount[index] as { where: unknown }).where, where);
  }
});

test("deleteWarehouse rejects warehouses with inventory, batches, or movements", async () => {
  const prisma = createWarehousePrismaMock();
  prisma.inventoryStock.count = async (args: unknown) => {
    prisma.calls.inventoryStockCount.push(args);
    return 1;
  };
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () => service.deleteWarehouse("warehouse-1", actionContext()),
    BadRequestException
  );
});

test("admin warehouse controller methods declare required permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.createWarehouse
    ),
    [PermissionCode.WarehouseManage]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.listWarehouses
    ),
    [PermissionCode.WarehouseRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.assignStaff
    ),
    [PermissionCode.WarehouseStaffManage]
  );
});

test("warehouse create and edit persist status in the same write as the details", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  const input = {
    address: "Plot 1", city: "Pune", code: "QA", contactNumber: "9000000000",
    contactPerson: "QA", name: "QA warehouse", pincode: "411001", state: "Maharashtra", status: "INACTIVE" as const
  };
  await service.createWarehouse(input, actionContext());
  assert.equal((prisma.calls.warehouseCreate[0] as { data: typeof input }).data.status, "INACTIVE");
  await service.updateWarehouse("warehouse-1", { city: "Mumbai", status: "ACTIVE", latitude: null }, actionContext());
  assert.deepEqual((prisma.calls.warehouseUpdate[0] as { data: unknown }).data, { city: "Mumbai", status: "ACTIVE", latitude: null });
});

test("warehouse search matches city as well as name and code while retaining access scope", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await service.listWarehouses({ search: " Pune ", state: "Maharashtra", status: "ACTIVE", page: 2, limit: 10 }, adminAuth());
  const args = prisma.calls.warehouseFindMany[0] as { where: { OR: unknown[]; id: unknown }; skip: number; take: number };
  assert.ok(args.where.OR.some((entry) => JSON.stringify(entry) === JSON.stringify({ city: { contains: "Pune", mode: "insensitive" } })));
  assert.deepEqual(args.where.id, { in: ["warehouse-1"] });
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
});

test("deleting an unused warehouse removes active staff assignments in the transaction", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await service.deleteWarehouse("warehouse-1", actionContext());
  const update = prisma.calls.warehouseUpdate[0] as { data: { deletedAt: Date; status: string } };
  assert.equal(update.data.status, "INACTIVE");
  assert.ok(update.data.deletedAt instanceof Date);
  assert.deepEqual(prisma.calls.warehouseStaffUpdateMany, [{ data: { deletedAt: update.data.deletedAt }, where: { deletedAt: null, warehouseId: "warehouse-1" } }]);
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("deletion rejects each inventory and operational dependency without changing warehouse or staff", async () => {
  for (const dependency of ["inventoryStock", "stockBatch", "stockMovement", "orders", "orderItems", "deliveryPickups", "deliveryChargeRules"]) {
    const prisma = createWarehousePrismaMock();
    if (dependency === "inventoryStock" || dependency === "stockBatch" || dependency === "stockMovement") {
      prisma[dependency].count = async () => 1;
    } else {
      prisma.warehouse.findUnique = async () => ({ _count: { orders: 0, orderItems: 0, deliveryPickups: 0, deliveryChargeRules: 0, [dependency]: 1 } });
    }
    const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
    await assert.rejects(() => service.deleteWarehouse("warehouse-1", actionContext()), BadRequestException);
    assert.equal(prisma.calls.warehouseUpdate.length, 0, dependency);
    assert.equal(prisma.calls.warehouseStaffUpdateMany.length, 0, dependency);
  }
});

test("staff reads and removals reject a missing or deleted warehouse even for super admin", async () => {
  const base = createWarehousePrismaMock();
  const prisma = { ...base, warehouse: { ...base.warehouse, findFirst: async () => null } };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await assert.rejects(() => service.listStaff("warehouse-1", adminAuth(AdminRoleCode.SuperAdmin)), NotFoundException);
  await assert.rejects(() => service.removeStaff("warehouse-1", "admin-1", actionContext(AdminRoleCode.SuperAdmin)), NotFoundException);
});

test("duplicate warehouse codes return a conflict without assigning staff", async () => {
  const prisma = createWarehousePrismaMock();
  prisma.warehouse.create = async () => { throw { code: "P2002" }; };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await assert.rejects(() => service.createWarehouse({ address: "Plot 1", city: "Pune", code: "QA", contactNumber: "9000000000", contactPerson: "QA", name: "QA", pincode: "411001", state: "Maharashtra" }, actionContext()), ConflictException);
  assert.equal(prisma.calls.warehouseStaffCreate.length, 0);
});

test("staff assignment supports duplicate retries, removal and reassignment and rejects inactive users", async () => {
  let activeUser = true;
  let assignment: { id: string; warehouseId: string; adminUserId: string; deletedAt: Date | null } | null = null;
  const adminUser = { id: "staff-1", firstName: "QA", lastName: "Staff", email: "qa@example.test" };
  const audits: unknown[] = [];
  const prisma = {
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> => callback(prisma),
    warehouse: { findFirst: async () => warehouseRecord() },
    adminUser: { findFirst: async () => activeUser ? adminUser : null },
    adminAuditLog: { create: async (args: unknown) => { audits.push(args); } },
    warehouseStaff: {
      findFirst: async () => assignment,
      findMany: async () => assignment && !assignment.deletedAt ? [{ ...assignment, adminUser }] : [],
      upsert: async () => {
        assignment = { id: "assignment-1", warehouseId: "warehouse-1", adminUserId: "staff-1", deletedAt: null };
        return assignment;
      },
      update: async ({ data }: { data: { deletedAt: Date } }) => {
        assignment = { ...assignment!, ...data };
        return assignment;
      }
    }
  };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, actionContext());
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, actionContext());
  assert.equal((await service.listStaff("warehouse-1", adminAuth())).length, 1);
  await service.removeStaff("warehouse-1", "staff-1", actionContext());
  assert.deepEqual(await service.listStaff("warehouse-1", adminAuth()), []);
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, actionContext());
  assert.equal((await service.listStaff("warehouse-1", adminAuth()))[0]?.email, adminUser.email);
  activeUser = false;
  await assert.rejects(() => service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, actionContext()), NotFoundException);
  assert.equal(audits.length, 4);
});
