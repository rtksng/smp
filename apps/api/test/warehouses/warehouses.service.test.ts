import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
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
    productWarehouseDeleteMany: [],
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
    productWarehouse: {
      deleteMany: async (args: unknown) => {
        calls.productWarehouseDeleteMany.push(args);
        return { count: 0 };
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

const newWarehouseInput = {
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
};

test("createWarehouse lets the super admin create a warehouse with an audit log and no staff row", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.createWarehouse(
    newWarehouseInput,
    actionContext(AdminRoleCode.SuperAdmin)
  );

  assert.equal(result.code, "MUM-01");
  assert.equal(prisma.calls.warehouseCreate.length, 1);
  // Super admins reach every warehouse already, so creation adds no staff row.
  assert.equal(prisma.calls.warehouseStaffCreate.length, 0);
  assert.deepEqual(
    prisma.calls.adminAuditLogCreate.map((call) => (call as { data: { action: string } }).data.action),
    ["warehouse.create"]
  );
});

test("warehouse-level admins cannot create or configure warehouses", async () => {
  for (const role of [AdminRoleCode.WarehouseManager, AdminRoleCode.WarehouseStaff, AdminRoleCode.InventoryManager]) {
    const prisma = createWarehousePrismaMock();
    const service = new WarehousesService(
      prisma as unknown as PrismaService,
      new FakeWarehouseAccess() as unknown as WarehouseAccessService
    );
    const context = actionContext(role);

    for (const attempt of [
      () => service.createWarehouse(newWarehouseInput, context),
      () => service.updateWarehouse("warehouse-1", { city: "Pune" }, context),
      () => service.activateWarehouse("warehouse-1", context),
      () => service.deactivateWarehouse("warehouse-1", context),
      () => service.deleteWarehouse("warehouse-1", context)
    ]) {
      await assert.rejects(attempt, /Only the super admin can create or configure warehouses/);
    }

    assert.equal(prisma.calls.warehouseCreate.length, 0, role);
    assert.equal(prisma.calls.warehouseUpdate.length, 0, role);
    assert.equal(prisma.calls.adminAuditLogCreate.length, 0, role);
  }
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
    () => service.deleteWarehouse("warehouse-1", actionContext(AdminRoleCode.SuperAdmin)),
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
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.listStaffCandidates
    ),
    [PermissionCode.WarehouseStaffManage]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.getWarehouse
    ),
    [PermissionCode.WarehouseRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminWarehousesController.prototype.listStaff
    ),
    [PermissionCode.WarehouseStaffManage]
  );
  for (const method of ["createStaffAccount", "listAssignableStaffRoles"] as const) {
    assert.deepEqual(
      Reflect.getMetadata(
        "admin:required-permissions",
        AdminWarehousesController.prototype[method]
      ),
      [PermissionCode.WarehouseStaffManage],
      method
    );
  }
});

test("warehouse create and edit persist status in the same write as the details", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  const input = {
    address: "Plot 1", city: "Pune", code: "QA", contactNumber: "9000000000",
    contactPerson: "QA", name: "QA warehouse", pincode: "411001", state: "Maharashtra", status: "INACTIVE" as const
  };
  await service.createWarehouse(input, actionContext(AdminRoleCode.SuperAdmin));
  assert.equal((prisma.calls.warehouseCreate[0] as { data: typeof input }).data.status, "INACTIVE");
  await service.updateWarehouse("warehouse-1", { city: "Mumbai", status: "ACTIVE", latitude: null }, actionContext(AdminRoleCode.SuperAdmin));
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

test("deleting an unused warehouse removes active staff and product assignments in the transaction", async () => {
  const prisma = createWarehousePrismaMock();
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await service.deleteWarehouse("warehouse-1", actionContext(AdminRoleCode.SuperAdmin));
  const update = prisma.calls.warehouseUpdate[0] as { data: { deletedAt: Date; status: string } };
  assert.equal(update.data.status, "INACTIVE");
  assert.ok(update.data.deletedAt instanceof Date);
  assert.deepEqual(prisma.calls.warehouseStaffUpdateMany, [{ data: { deletedAt: update.data.deletedAt }, where: { deletedAt: null, warehouseId: "warehouse-1" } }]);
  assert.deepEqual(prisma.calls.productWarehouseDeleteMany, [{ where: { warehouseId: "warehouse-1" } }]);
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
    await assert.rejects(() => service.deleteWarehouse("warehouse-1", actionContext(AdminRoleCode.SuperAdmin)), BadRequestException);
    assert.equal(prisma.calls.warehouseUpdate.length, 0, dependency);
    assert.equal(prisma.calls.warehouseStaffUpdateMany.length, 0, dependency);
    assert.equal(prisma.calls.productWarehouseDeleteMany.length, 0, dependency);
  }
});

test("staff reads and removals reject a missing or deleted warehouse even for super admin", async () => {
  const base = createWarehousePrismaMock();
  const prisma = { ...base, warehouse: { ...base.warehouse, findFirst: async () => null } };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await assert.rejects(() => service.listStaff("warehouse-1", adminAuth(AdminRoleCode.SuperAdmin)), NotFoundException);
  await assert.rejects(() => service.listStaffCandidates("warehouse-1", adminAuth(AdminRoleCode.SuperAdmin)), NotFoundException);
  await assert.rejects(() => service.removeStaff("warehouse-1", "admin-1", actionContext(AdminRoleCode.SuperAdmin)), NotFoundException);
});

test("staff candidates are active admins not yet assigned, labelled with their role", async () => {
  const findManyCalls: unknown[] = [];
  const access = new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]);
  const prisma = {
    adminUser: {
      findMany: async (args: unknown) => {
        findManyCalls.push(args);
        return [{
          email: "manager@example.test",
          firstName: "Asha",
          id: "admin-2",
          lastName: null,
          role: { code: AdminRoleCode.WarehouseManager, id: "role-1", name: "Warehouse manager" }
        }];
      }
    },
    warehouse: { findFirst: async () => warehouseRecord() }
  };
  const service = new WarehousesService(prisma as unknown as PrismaService, access as unknown as WarehouseAccessService);

  assert.deepEqual(await service.listStaffCandidates("warehouse-1", adminAuth(AdminRoleCode.SuperAdmin)), [{
    adminUserId: "admin-2",
    email: "manager@example.test",
    firstName: "Asha",
    lastName: null,
    role: { code: AdminRoleCode.WarehouseManager, id: "role-1", name: "Warehouse manager" }
  }]);
  await service.listStaffCandidates("warehouse-1", adminAuth());
  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1", "warehouse-1"]);

  const candidateQuery = {
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { email: "asc" }],
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
      role: { select: { code: true, id: true, name: true } }
    }
  };
  const notAssignedHere = {
    deletedAt: null,
    role: { code: { not: AdminRoleCode.SuperAdmin } },
    status: "ACTIVE",
    warehouses: { none: { deletedAt: null, warehouseId: "warehouse-1" } }
  };
  assert.deepEqual(findManyCalls, [
    { ...candidateQuery, where: notAssignedHere },
    {
      ...candidateQuery,
      // A warehouse manager picks only from people at their own warehouses.
      where: {
        ...notAssignedHere,
        AND: [
          {
            warehouses: {
              some: { deletedAt: null, warehouseId: { in: ["warehouse-1", "warehouse-2"] } }
            }
          }
        ]
      }
    }
  ]);
});

test("warehouse managers add only people from their own warehouses and never super admins", async () => {
  const staffLookups: unknown[] = [];
  let sharedAssignment: { id: string } | null = null;
  let adminRoleCode: string = AdminRoleCode.WarehouseStaff;
  const prisma = {
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> => callback(prisma),
    adminAuditLog: { create: async () => ({ id: "audit-1" }) },
    adminUser: {
      findFirst: async () => ({
        email: "picker@example.test",
        firstName: "Picker",
        lastName: null,
        role: { code: adminRoleCode, id: "role-1", name: "Role" }
      })
    },
    warehouse: { findFirst: async () => warehouseRecord() },
    warehouseStaff: {
      findFirst: async (args: { where: { warehouseId: unknown } }) => {
        staffLookups.push(args);
        return typeof args.where.warehouseId === "object" ? sharedAssignment : null;
      },
      upsert: async () => ({ adminUserId: "admin-9", deletedAt: null, id: "assignment-9", warehouseId: "warehouse-1" })
    }
  };
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () => service.assignStaff("warehouse-1", { adminUserId: "admin-9" }, actionContext()),
    /only people who already work at one of your warehouses/
  );
  assert.deepEqual(staffLookups[0], {
    select: { id: true },
    where: {
      adminUserId: "admin-9",
      deletedAt: null,
      warehouseId: { in: ["warehouse-1", "warehouse-2"] }
    }
  });

  sharedAssignment = { id: "assignment-on-warehouse-2" };
  const assigned = await service.assignStaff("warehouse-1", { adminUserId: "admin-9" }, actionContext());
  assert.equal(assigned.warehouseId, "warehouse-1");

  adminRoleCode = AdminRoleCode.SuperAdmin;
  await assert.rejects(
    () =>
      service.assignStaff(
        "warehouse-1",
        { adminUserId: "admin-1" },
        actionContext(AdminRoleCode.SuperAdmin)
      ),
    /Super admins already have access to every warehouse/
  );
});

test("warehouse managers cannot remove themselves from a warehouse", async () => {
  let assignmentLookups = 0;
  const prisma = {
    warehouse: { findFirst: async () => warehouseRecord() },
    warehouseStaff: {
      findFirst: async () => {
        assignmentLookups += 1;
        return null;
      }
    }
  };
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () => service.removeStaff("warehouse-1", "admin-1", actionContext()),
    /cannot remove yourself/
  );
  assert.equal(assignmentLookups, 0);
});

function createStaffRolePrismaMock() {
  const created: Record<string, unknown[]> = {
    adminAuditLog: [],
    adminUser: [],
    warehouseStaff: []
  };
  const roles = [
    {
      code: AdminRoleCode.WarehouseManager,
      description: null,
      id: "role-manager",
      name: "Warehouse manager",
      permissions: [
        PermissionCode.InventoryRead,
        PermissionCode.WarehouseRead,
        PermissionCode.WarehouseStaffManage
      ].map((code) => ({ permission: { code } }))
    },
    {
      code: AdminRoleCode.WarehouseStaff,
      description: "Handles stock.",
      id: "role-staff",
      name: "Warehouse staff",
      permissions: [PermissionCode.InventoryRead, PermissionCode.WarehouseRead].map((code) => ({
        permission: { code }
      }))
    },
    {
      code: AdminRoleCode.InventoryManager,
      description: null,
      id: "role-inventory",
      name: "Inventory manager",
      permissions: [PermissionCode.ProductsCreate, PermissionCode.InventoryRead].map((code) => ({
        permission: { code }
      }))
    }
  ];
  let existingEmail: string | null = null;
  const prisma = {
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> => callback(prisma),
    adminAuditLog: {
      create: async (args: unknown) => {
        created.adminAuditLog.push(args);
        return { id: "audit-1" };
      }
    },
    adminUser: {
      create: async (args: { data: { email: string; firstName: string; lastName: string | null; roleId: string } }) => {
        created.adminUser.push(args);
        const role = roles.find((item) => item.id === args.data.roleId)!;

        return {
          email: args.data.email,
          firstName: args.data.firstName,
          id: "admin-new",
          lastName: args.data.lastName,
          role: { code: role.code, id: role.id, name: role.name }
        };
      },
      findFirst: async (args: { where: { email: string } }) =>
        args.where.email === existingEmail ? { id: "admin-existing" } : null
    },
    role: { findMany: async () => roles },
    warehouse: { findFirst: async () => warehouseRecord() },
    warehouseStaff: {
      create: async (args: { data: { adminUserId: string; warehouseId: string } }) => {
        created.warehouseStaff.push(args);
        return { ...args.data, deletedAt: null, id: "assignment-new" };
      }
    }
  };

  return {
    created,
    prisma,
    setExistingEmail: (email: string) => {
      existingEmail = email;
    }
  };
}

const managerPermissions = [
  PermissionCode.InventoryRead,
  PermissionCode.WarehouseRead,
  PermissionCode.WarehouseStaffManage
];

test("assignable staff roles never carry more access than the admin holds", async () => {
  const { prisma } = createStaffRolePrismaMock();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const managerRoles = await service.listAssignableStaffRoles("warehouse-1", {
    ...adminAuth(),
    permissions: managerPermissions
  });
  const superAdminRoles = await service.listAssignableStaffRoles(
    "warehouse-1",
    adminAuth(AdminRoleCode.SuperAdmin)
  );

  assert.deepEqual(managerRoles.map((role) => role.code), [
    AdminRoleCode.WarehouseManager,
    AdminRoleCode.WarehouseStaff
  ]);
  assert.deepEqual(managerRoles[1], {
    code: AdminRoleCode.WarehouseStaff,
    description: "Handles stock.",
    id: "role-staff",
    name: "Warehouse staff"
  });
  assert.equal(superAdminRoles.length, 3);
});

test("createStaffAccount creates an active account already assigned to the warehouse", async () => {
  const { created, prisma, setExistingEmail } = createStaffRolePrismaMock();
  const hashed: string[] = [];
  const access = new FakeWarehouseAccess();
  const service = new WarehousesService(
    prisma as unknown as PrismaService,
    access as unknown as WarehouseAccessService,
    { hash: async (password: string) => { hashed.push(password); return "hashed-password"; } } as never
  );
  const context = { ...actionContext(), auth: { ...adminAuth(), permissions: managerPermissions } };
  const input = {
    email: "picker@example.test",
    firstName: "Picker",
    lastName: "One",
    password: "Password123",
    roleId: "role-staff"
  };

  const staff = await service.createStaffAccount("warehouse-1", input, context);

  assert.deepEqual(staff, {
    adminUserId: "admin-new",
    email: "picker@example.test",
    firstName: "Picker",
    id: "assignment-new",
    lastName: "One",
    role: { code: AdminRoleCode.WarehouseStaff, id: "role-staff", name: "Warehouse staff" },
    warehouseId: "warehouse-1"
  });
  assert.deepEqual(access.assertedWarehouseIds, ["warehouse-1"]);
  assert.deepEqual(hashed, ["Password123"]);
  assert.equal(
    (created.adminUser[0] as { data: { passwordHash: string; status: string } }).data.passwordHash,
    "hashed-password"
  );
  assert.deepEqual(created.warehouseStaff, [
    { data: { adminUserId: "admin-new", warehouseId: "warehouse-1" } }
  ]);
  assert.deepEqual(
    created.adminAuditLog.map((call) => (call as { data: { action: string } }).data.action),
    ["admin_user.create", "warehouse_staff.assign"]
  );

  await assert.rejects(
    () => service.createStaffAccount("warehouse-1", { ...input, roleId: "role-inventory" }, context),
    /cannot have more access than you/
  );
  setExistingEmail("picker@example.test");
  await assert.rejects(
    () => service.createStaffAccount("warehouse-1", input, context),
    ConflictException
  );
  assert.equal(created.adminUser.length, 1);
});

test("staff candidates are hidden from admins who cannot manage the warehouse", async () => {
  let adminUsersRead = false;
  const access = {
    assertCanManageWarehouse: async () => {
      throw new ForbiddenException("Admin is not assigned to this warehouse.");
    }
  };
  const prisma = {
    adminUser: { findMany: async () => { adminUsersRead = true; return []; } },
    warehouse: { findFirst: async () => warehouseRecord() }
  };
  const service = new WarehousesService(prisma as unknown as PrismaService, access as unknown as WarehouseAccessService);

  await assert.rejects(() => service.listStaffCandidates("warehouse-1", adminAuth()), ForbiddenException);
  assert.equal(adminUsersRead, false);
});

test("duplicate warehouse codes return a conflict without assigning staff", async () => {
  const prisma = createWarehousePrismaMock();
  prisma.warehouse.create = async () => { throw { code: "P2002" }; };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await assert.rejects(() => service.createWarehouse({ address: "Plot 1", city: "Pune", code: "QA", contactNumber: "9000000000", contactPerson: "QA", name: "QA", pincode: "411001", state: "Maharashtra" }, actionContext(AdminRoleCode.SuperAdmin)), ConflictException);
  assert.equal(prisma.calls.warehouseStaffCreate.length, 0);
});

test("staff assignment supports duplicate retries, removal and reassignment and rejects inactive users", async () => {
  let activeUser = true;
  let assignment: { id: string; warehouseId: string; adminUserId: string; deletedAt: Date | null } | null = null;
  const adminUser = {
    id: "staff-1",
    firstName: "QA",
    lastName: "Staff",
    email: "qa@example.test",
    role: { code: AdminRoleCode.WarehouseManager, id: "role-1", name: "Warehouse manager" }
  };
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
  const superAdmin = actionContext(AdminRoleCode.SuperAdmin);
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, superAdmin);
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, superAdmin);
  assert.equal((await service.listStaff("warehouse-1", adminAuth())).length, 1);
  await service.removeStaff("warehouse-1", "staff-1", actionContext());
  assert.deepEqual(await service.listStaff("warehouse-1", adminAuth()), []);
  await service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, superAdmin);
  assert.equal((await service.listStaff("warehouse-1", adminAuth()))[0]?.email, adminUser.email);
  activeUser = false;
  await assert.rejects(() => service.assignStaff("warehouse-1", { adminUserId: "staff-1" }, superAdmin), NotFoundException);
  assert.equal(audits.length, 4);
});

test("staff rows show each admin's role and load only the fields they display", async () => {
  const role = { code: AdminRoleCode.WarehouseManager, id: "role-1", name: "Warehouse manager" };
  const adminUser = { email: "manager@example.test", firstName: "Asha", lastName: null, role };
  const staffRow = { adminUserId: "admin-2", deletedAt: null, id: "assignment-2", warehouseId: "warehouse-1" };
  const adminUserFindFirstCalls: unknown[] = [];
  const staffFindManyCalls: unknown[] = [];
  const prisma = {
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> => callback(prisma),
    adminAuditLog: { create: async () => ({ id: "audit-1" }) },
    adminUser: {
      findFirst: async (args: unknown) => {
        adminUserFindFirstCalls.push(args);
        return adminUser;
      }
    },
    warehouse: { findFirst: async () => warehouseRecord() },
    warehouseStaff: {
      findFirst: async () => null,
      findMany: async (args: unknown) => {
        staffFindManyCalls.push(args);
        return [{ ...staffRow, adminUser }];
      },
      upsert: async () => staffRow
    }
  };
  const service = new WarehousesService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  const expected = {
    adminUserId: "admin-2",
    email: "manager@example.test",
    firstName: "Asha",
    id: "assignment-2",
    lastName: null,
    role,
    warehouseId: "warehouse-1"
  };
  const adminUserSelect = {
    email: true,
    firstName: true,
    lastName: true,
    role: { select: { code: true, id: true, name: true } }
  };

  assert.deepEqual(
    await service.assignStaff("warehouse-1", { adminUserId: "admin-2" }, actionContext(AdminRoleCode.SuperAdmin)),
    expected
  );
  assert.deepEqual(await service.listStaff("warehouse-1", adminAuth()), [expected]);
  assert.deepEqual(adminUserFindFirstCalls, [{
    select: adminUserSelect,
    where: { deletedAt: null, id: "admin-2", status: "ACTIVE" }
  }]);
  assert.deepEqual(staffFindManyCalls, [{
    include: { adminUser: { select: adminUserSelect } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    // Deleted accounts and super admins, who reach every warehouse anyway, stay off the list.
    where: {
      adminUser: { deletedAt: null, role: { code: { not: AdminRoleCode.SuperAdmin } } },
      deletedAt: null,
      warehouseId: "warehouse-1"
    }
  }]);
});
