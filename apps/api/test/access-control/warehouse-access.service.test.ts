import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

type FindFirstArgs = {
  where: {
    adminUserId: string;
    deletedAt: null;
    warehouseId: string;
    warehouse: { deletedAt: null };
  };
};

type FindManyArgs = {
  orderBy: {
    createdAt: "asc";
  };
  select: {
    warehouseId: true;
  };
  where: {
    adminUserId: string;
    deletedAt: null;
    warehouse: { deletedAt: null };
  };
};

class FakePrisma {
  readonly findFirstCalls: FindFirstArgs[] = [];
  readonly findManyCalls: FindManyArgs[] = [];

  constructor(private readonly assignedWarehouseIds: string[]) {}

  readonly warehouseStaff = {
    findFirst: async (args: FindFirstArgs) => {
      this.findFirstCalls.push(args);

      if (this.assignedWarehouseIds.includes(args.where.warehouseId)) {
        return {
          id: "warehouse-staff-1"
        };
      }

      return null;
    },
    findMany: async (args: FindManyArgs) => {
      this.findManyCalls.push(args);

      return this.assignedWarehouseIds.map((warehouseId) => ({
        warehouseId
      }));
    }
  };
}

function adminAuth(role: AdminRoleCode): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [],
    role,
    sessionId: "session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

function createService(prisma: FakePrisma) {
  return new WarehouseAccessService(prisma as unknown as PrismaService);
}

test("super admins can manage every warehouse without an assignment lookup", async () => {
  const prisma = new FakePrisma([]);
  const service = createService(prisma);

  assert.equal(
    await service.canManageWarehouse(
      adminAuth(AdminRoleCode.SuperAdmin),
      "warehouse-1"
    ),
    true
  );
  assert.deepEqual(await service.getWarehouseScope(adminAuth(AdminRoleCode.SuperAdmin)), {
    allWarehouses: true
  });
  assert.equal(prisma.findFirstCalls.length, 0);
});

test("non-super-admin staff can only manage assigned warehouses", async () => {
  const service = createService(new FakePrisma(["warehouse-1"]));
  const auth = adminAuth(AdminRoleCode.WarehouseManager);

  assert.equal(await service.canManageWarehouse(auth, "warehouse-1"), true);
  assert.equal(await service.canManageWarehouse(auth, "warehouse-2"), false);
  await assert.rejects(
    () => service.assertCanManageWarehouse(auth, "warehouse-2"),
    ForbiddenException
  );
});

test("warehouse scope lists only assigned warehouse ids for non-super-admin staff", async () => {
  const service = createService(new FakePrisma(["warehouse-1", "warehouse-2"]));

  assert.deepEqual(
    await service.getWarehouseScope(adminAuth(AdminRoleCode.InventoryManager)),
    {
      allWarehouses: false,
      warehouseIds: ["warehouse-1", "warehouse-2"]
    }
  );
});

test("every non-super role excludes deleted warehouses from assignment lookup and scope", async () => {
  for (const role of Object.values(AdminRoleCode).filter((value) => value !== AdminRoleCode.SuperAdmin)) {
    const prisma = new FakePrisma([]);
    const service = createService(prisma);
    assert.equal(await service.canManageWarehouse(adminAuth(role), "deleted-warehouse"), false);
    assert.deepEqual(await service.getWarehouseScope(adminAuth(role)), { allWarehouses: false, warehouseIds: [] });
    assert.deepEqual(prisma.findFirstCalls[0]?.where.warehouse, { deletedAt: null });
    assert.deepEqual(prisma.findManyCalls[0]?.where.warehouse, { deletedAt: null });
  }
});
