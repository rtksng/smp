import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { AdminBrandsController } from "../../src/modules/brands/admin-brands.controller";
import { BrandsService } from "../../src/modules/brands/brands.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AdminActionContext } from "../../src/modules/warehouses/warehouses.service";
import type { PrismaService } from "../../src/database/prisma.service";

type BrandFixture = {
  createdAt: Date;
  deletedAt: Date | null;
  description: string | null;
  id: string;
  isActive: boolean;
  logoUrl: string | null;
  name: string;
  slug: string;
  updatedAt: Date;
};

const now = new Date("2026-05-25T10:00:00.000Z");
const adminContext: AdminActionContext = {
  auth: {
    audience: AuthTokenAudience.Admin,
    role: "SUPER_ADMIN",
    sessionId: "admin-session-1",
    sub: "admin-1",
    tokenType: "access"
  },
  ipAddress: "10.0.0.1",
  userAgent: "node-test-agent"
};

function brandFixture(
  input: Partial<BrandFixture> & Pick<BrandFixture, "id" | "name" | "slug">
): BrandFixture {
  return {
    createdAt: now,
    deletedAt: null,
    description: null,
    isActive: true,
    logoUrl: null,
    updatedAt: now,
    ...input
  };
}

type BrandPrismaMock = PrismaService & {
  calls: {
    adminAuditLogCreate: unknown[];
    create: unknown[];
    findFirst: unknown[];
    findMany: unknown[];
    transaction: unknown[];
    update: unknown[];
  };
};

function createBrandPrismaMock(records: BrandFixture[]): BrandPrismaMock {
  const calls: BrandPrismaMock["calls"] = {
    adminAuditLogCreate: [],
    create: [],
    findFirst: [],
    findMany: [],
    transaction: [],
    update: []
  };

  const mock = {
    $transaction: async <T>(callback: (tx: BrandPrismaMock) => Promise<T>) => {
      calls.transaction.push(true);
      return callback(mock as BrandPrismaMock);
    },
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    calls,
    brand: {
      create: async (args: unknown) => {
        calls.create.push(args);
        return brandFixture({
          id: "created-brand",
          name: "Created",
          slug: "created"
        });
      },
      findFirst: async (args: { where?: { id?: string; slug?: string } }) => {
        calls.findFirst.push(args);
        return (
          records.find((record) => {
            const idMatches =
              args.where?.id === undefined || record.id === args.where.id;
            const slugMatches =
              args.where?.slug === undefined || record.slug === args.where.slug;
            const deletedMatches =
              !("deletedAt" in (args.where ?? {})) || record.deletedAt === null;
            const activeMatches =
              !("isActive" in (args.where ?? {})) ||
              record.isActive === args.where?.isActive;

            return idMatches && slugMatches && deletedMatches && activeMatches;
          }) ?? null
        );
      },
      findMany: async (args: unknown) => {
        calls.findMany.push(args);
        return records;
      },
      update: async (args: { data?: Partial<BrandFixture>; where: { id: string } }) => {
        calls.update.push(args);
        const existing = records.find((record) => record.id === args.where.id);

        if (!existing) {
          throw new Error("Mock brand not found.");
        }

        return {
          ...existing,
          ...args.data,
          updatedAt: now
        };
      }
    }
  };

  return mock as unknown as BrandPrismaMock;
}

test("listPublicBrands returns only active brands with logo support", async () => {
  const active = brandFixture({
    id: "brand-1",
    logoUrl: "https://cdn.example.com/brands/acme.svg",
    name: "Acme Surgical",
    slug: "acme-surgical"
  });
  const inactive = brandFixture({
    id: "brand-2",
    isActive: false,
    name: "Inactive",
    slug: "inactive"
  });
  const deleted = brandFixture({
    deletedAt: now,
    id: "brand-3",
    name: "Deleted",
    slug: "deleted"
  });
  const prisma = createBrandPrismaMock([deleted, inactive, active]);
  const service = new BrandsService(prisma);

  const brands = await service.listPublicBrands();

  assert.deepEqual(
    brands.map((brand) => brand.slug),
    ["acme-surgical"]
  );
  assert.equal(brands[0]?.logoUrl, "https://cdn.example.com/brands/acme.svg");
  assert.deepEqual(prisma.calls.findMany[0], {
    orderBy: {
      name: "asc"
    },
    where: {
      deletedAt: null,
      isActive: true
    }
  });
});

test("listAdminBrands returns active and inactive non-deleted brands", async () => {
  const prisma = createBrandPrismaMock([
    brandFixture({
      id: "brand-1",
      isActive: true,
      name: "Acme Surgical",
      slug: "acme-surgical"
    }),
    brandFixture({
      id: "brand-2",
      isActive: false,
      name: "Archived Brand",
      slug: "archived-brand"
    }),
    brandFixture({
      deletedAt: now,
      id: "brand-3",
      isActive: false,
      name: "Deleted Brand",
      slug: "deleted-brand"
    })
  ]);
  const service = new BrandsService(prisma);

  const brands = await service.listAdminBrands();

  assert.deepEqual(
    brands.map((brand) => ({
      id: brand.id,
      isActive: brand.isActive,
      name: brand.name
    })),
    [
      {
        id: "brand-1",
        isActive: true,
        name: "Acme Surgical"
      },
      {
        id: "brand-2",
        isActive: false,
        name: "Archived Brand"
      }
    ]
  );
  assert.deepEqual(prisma.calls.findMany[0], {
    orderBy: {
      name: "asc"
    },
    where: {
      deletedAt: null
    }
  });
});

test("getPublicBrandBySlug rejects inactive brands", async () => {
  const prisma = createBrandPrismaMock([
    brandFixture({
      id: "inactive",
      isActive: false,
      name: "Inactive",
      slug: "inactive"
    })
  ]);
  const service = new BrandsService(prisma);

  await assert.rejects(
    () => service.getPublicBrandBySlug("inactive"),
    NotFoundException
  );
});

test("createBrand persists logo and active status", async () => {
  const prisma = createBrandPrismaMock([]);
  const service = new BrandsService(prisma);

  await service.createBrand(
    {
      description: "Trusted surgical supplier.",
      isActive: false,
      logoUrl: "https://cdn.example.com/brands/new-brand.svg",
      name: "New Brand",
      slug: "new-brand"
    },
    adminContext
  );

  assert.deepEqual(prisma.calls.create[0], {
    data: {
      description: "Trusted surgical supplier.",
      isActive: false,
      logoUrl: "https://cdn.example.com/brands/new-brand.svg",
      name: "New Brand",
      slug: "new-brand"
    }
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
  const auditCall = prisma.calls.adminAuditLogCreate[0] as {
    data: {
      action: string;
      adminUserId: string;
      after: { id: string };
      entityId: string;
      entityType: string;
    };
  };
  assert.equal(auditCall.data.action, "brand.create");
  assert.equal(auditCall.data.adminUserId, "admin-1");
  assert.equal(auditCall.data.after.id, "created-brand");
  assert.equal(auditCall.data.entityId, "created-brand");
  assert.equal(auditCall.data.entityType, "Brand");
});

test("updateBrand writes an admin audit log with before and after values", async () => {
  const brand = brandFixture({
    id: "brand-1",
    name: "Original Brand",
    slug: "original-brand"
  });
  const prisma = createBrandPrismaMock([brand]);
  const service = new BrandsService(prisma);

  await service.updateBrand(brand.id, { name: "Updated Brand" }, adminContext);

  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
  const auditCall = prisma.calls.adminAuditLogCreate[0] as {
    data: {
      action: string;
      after: { id: string; name: string };
      before: { id: string; name: string };
      entityId: string;
      entityType: string;
    };
  };
  assert.equal(auditCall.data.action, "brand.update");
  assert.equal(auditCall.data.before.id, brand.id);
  assert.equal(auditCall.data.before.name, "Original Brand");
  assert.equal(auditCall.data.after.id, brand.id);
  assert.equal(auditCall.data.after.name, "Updated Brand");
  assert.equal(auditCall.data.entityId, brand.id);
  assert.equal(auditCall.data.entityType, "Brand");
});

test("deleteBrand soft deletes and deactivates the brand", async () => {
  const brand = brandFixture({
    id: "brand-1",
    name: "Acme Surgical",
    slug: "acme-surgical"
  });
  const prisma = createBrandPrismaMock([brand]);
  const service = new BrandsService(prisma);

  await service.deleteBrand(brand.id, adminContext);

  const updateCall = prisma.calls.update[0] as {
    data: { deletedAt: unknown; isActive: boolean };
    where: { id: string };
  };

  assert.equal(updateCall.data.deletedAt instanceof Date, true);
  assert.deepEqual(updateCall, {
    data: {
      deletedAt: updateCall.data.deletedAt,
      isActive: false
    },
    where: {
      id: brand.id
    }
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
  const auditCall = prisma.calls.adminAuditLogCreate[0] as {
    data: {
      action: string;
      after: { id: string; isActive: boolean };
      before: { id: string; isActive: boolean };
      entityId: string;
      entityType: string;
    };
  };
  assert.equal(auditCall.data.action, "brand.delete");
  assert.equal(auditCall.data.before.id, brand.id);
  assert.equal(auditCall.data.before.isActive, true);
  assert.equal(auditCall.data.after.id, brand.id);
  assert.equal(auditCall.data.after.isActive, false);
  assert.equal(auditCall.data.entityId, brand.id);
  assert.equal(auditCall.data.entityType, "Brand");
});

test("admin brand controller methods declare catalog permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminBrandsController.prototype.createBrand
    ),
    [PermissionCode.ProductsCreate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminBrandsController.prototype.updateBrand
    ),
    [PermissionCode.ProductsUpdate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminBrandsController.prototype.deleteBrand
    ),
    [PermissionCode.ProductsDelete]
  );
});
