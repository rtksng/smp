import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "../../src/modules/categories/categories.service";
import { AdminCategoriesController } from "../../src/modules/categories/admin-categories.controller";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AdminActionContext } from "../../src/modules/warehouses/warehouses.service";
import type { PrismaService } from "../../src/database/prisma.service";

type CategoryFixture = {
  createdAt: Date;
  deletedAt: Date | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
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

function categoryFixture(
  input: Partial<CategoryFixture> & Pick<CategoryFixture, "id" | "name" | "slug">
): CategoryFixture {
  return {
    createdAt: now,
    deletedAt: null,
    description: null,
    imageUrl: null,
    isActive: true,
    parentId: null,
    sortOrder: 0,
    updatedAt: now,
    ...input
  };
}

type CategoryPrismaMock = PrismaService & {
  calls: {
    adminAuditLogCreate: unknown[];
    create: unknown[];
    findFirst: unknown[];
    findMany: unknown[];
    transaction: unknown[];
    update: unknown[];
    updateMany: unknown[];
  };
};

function createCategoryPrismaMock(records: CategoryFixture[]): CategoryPrismaMock {
  const calls: CategoryPrismaMock["calls"] = {
    adminAuditLogCreate: [],
    create: [],
    findFirst: [],
    findMany: [],
    transaction: [],
    update: [],
    updateMany: []
  };

  const mock = {
    $transaction: async <T>(callback: (tx: CategoryPrismaMock) => Promise<T>) => {
      calls.transaction.push(true);
      return callback(mock as CategoryPrismaMock);
    },
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    calls,
    category: {
      create: async (args: unknown) => {
        calls.create.push(args);
        return categoryFixture({
          id: "created-category",
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
      update: async (args: {
        data?: Partial<CategoryFixture>;
        where: { id: string };
      }) => {
        calls.update.push(args);
        const existing = records.find((record) => record.id === args.where.id);

        if (!existing) {
          throw new Error("Mock category not found.");
        }

        return {
          ...existing,
          ...args.data,
          updatedAt: now
        };
      },
      updateMany: async (args: unknown) => {
        calls.updateMany.push(args);
        return { count: 1 };
      }
    }
  };

  return mock as unknown as CategoryPrismaMock;
}

test("listPublicCategories returns only active root categories with active children", async () => {
  const root = categoryFixture({
    id: "root",
    imageUrl: "https://cdn.example.com/surgical/category.png",
    name: "Dental",
    slug: "dental",
    sortOrder: 2
  });
  const child = categoryFixture({
    id: "child",
    name: "Endodontics",
    parentId: root.id,
    slug: "endodontics",
    sortOrder: 1
  });
  const legacyRoot = categoryFixture({
    id: "legacy-root",
    name: "Surgical Instruments",
    slug: "surgical-instruments"
  });
  const inactiveChild = categoryFixture({
    id: "inactive-child",
    isActive: false,
    name: "Inactive child",
    parentId: root.id,
    slug: "inactive-child"
  });
  const deletedRoot = categoryFixture({
    deletedAt: now,
    id: "deleted-root",
    name: "Deleted",
    slug: "deleted"
  });
  const prisma = createCategoryPrismaMock([
    inactiveChild,
    deletedRoot,
    child,
    legacyRoot,
    root
  ]);
  const service = new CategoriesService(prisma);

  const categories = await service.listPublicCategories();

  assert.equal(categories.length, 1);
  assert.equal(categories[0]?.slug, "dental");
  assert.equal(
    categories[0]?.imageUrl,
    "https://cdn.example.com/surgical/category.png"
  );
  assert.deepEqual(
    categories[0]?.children.map((category) => category.slug),
    ["endodontics"]
  );
  assert.deepEqual(prisma.calls.findMany[0], {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        {
          slug: {
            in: [
              "dental",
              "diagnostics",
              "consumables",
              "equipment",
              "orthopedics",
              "ophthalmology",
              "nephrology",
              "pharma",
              "cardiology",
              "physiotherapy",
              "vaccines",
              "ivf-gynae"
            ]
          }
        },
        {
          parent: {
            slug: {
              in: [
                "dental",
                "diagnostics",
                "consumables",
                "equipment",
                "orthopedics",
                "ophthalmology",
                "nephrology",
                "pharma",
                "cardiology",
                "physiotherapy",
                "vaccines",
                "ivf-gynae"
              ]
            }
          }
        }
      ]
    }
  });
});

test("listAdminCategories returns active and inactive non-deleted category trees", async () => {
  const root = categoryFixture({
    id: "root",
    name: "Surgical Instruments",
    slug: "surgical-instruments"
  });
  const inactiveChild = categoryFixture({
    id: "inactive-child",
    isActive: false,
    name: "Archived Forceps",
    parentId: "root",
    slug: "archived-forceps"
  });
  const deletedChild = categoryFixture({
    deletedAt: now,
    id: "deleted-child",
    name: "Deleted",
    parentId: "root",
    slug: "deleted"
  });
  const prisma = createCategoryPrismaMock([root, inactiveChild, deletedChild]);
  const service = new CategoriesService(prisma);

  const categories = await service.listAdminCategories();

  assert.deepEqual(categories, [
    {
      children: [
        {
          children: [],
          description: null,
          id: "inactive-child",
          imageUrl: null,
          isActive: false,
          name: "Archived Forceps",
          parentId: "root",
          slug: "archived-forceps",
          sortOrder: 0
        }
      ],
      description: null,
      id: "root",
      imageUrl: null,
      isActive: true,
      name: "Surgical Instruments",
      parentId: null,
      slug: "surgical-instruments",
      sortOrder: 0
    }
  ]);
  assert.deepEqual(prisma.calls.findMany[0], {
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    where: {
      deletedAt: null
    }
  });
});

test("getPublicCategoryBySlug rejects inactive categories", async () => {
  const prisma = createCategoryPrismaMock([
    categoryFixture({
      id: "inactive",
      isActive: false,
      name: "Inactive",
      slug: "inactive"
    })
  ]);
  const service = new CategoriesService(prisma);

  await assert.rejects(
    () => service.getPublicCategoryBySlug("inactive"),
    NotFoundException
  );
});

test("createCategory validates parent categories before creating", async () => {
  const parent = categoryFixture({
    id: "parent",
    name: "Parent",
    slug: "parent"
  });
  const prisma = createCategoryPrismaMock([parent]);
  const service = new CategoriesService(prisma);

  await service.createCategory(
    {
      imageUrl: "https://cdn.example.com/surgical/new-category.png",
      isActive: true,
      name: "New Category",
      parentId: parent.id,
      slug: "new-category",
      sortOrder: 3
    },
    adminContext
  );

  assert.deepEqual(prisma.calls.findFirst[0], {
    where: {
      deletedAt: null,
      id: parent.id
    }
  });
  assert.deepEqual(prisma.calls.create[0], {
    data: {
      description: null,
      imageUrl: "https://cdn.example.com/surgical/new-category.png",
      isActive: true,
      name: "New Category",
      parentId: parent.id,
      slug: "new-category",
      sortOrder: 3
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
  assert.equal(auditCall.data.action, "category.create");
  assert.equal(auditCall.data.adminUserId, "admin-1");
  assert.equal(auditCall.data.after.id, "created-category");
  assert.equal(auditCall.data.entityId, "created-category");
  assert.equal(auditCall.data.entityType, "Category");
});

test("updateCategory writes an admin audit log with before and after values", async () => {
  const category = categoryFixture({
    id: "category-1",
    name: "Original",
    slug: "original"
  });
  const prisma = createCategoryPrismaMock([category]);
  const service = new CategoriesService(prisma);

  await service.updateCategory(category.id, { name: "Updated" }, adminContext);

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
  assert.equal(auditCall.data.action, "category.update");
  assert.equal(auditCall.data.before.id, category.id);
  assert.equal(auditCall.data.before.name, "Original");
  assert.equal(auditCall.data.after.id, category.id);
  assert.equal(auditCall.data.after.name, "Updated");
  assert.equal(auditCall.data.entityId, category.id);
  assert.equal(auditCall.data.entityType, "Category");
});

test("updateCategory rejects assigning a category to its descendant", async () => {
  const root = categoryFixture({
    id: "root",
    name: "Root",
    slug: "root"
  });
  const child = categoryFixture({
    id: "child",
    name: "Child",
    parentId: root.id,
    slug: "child"
  });
  const prisma = createCategoryPrismaMock([root, child]);
  const service = new CategoriesService(prisma);

  await assert.rejects(
    () => service.updateCategory(root.id, { parentId: child.id }),
    BadRequestException
  );
  assert.equal(prisma.calls.update.length, 0);
});

test("deleteCategory soft deletes the category and descendants", async () => {
  const root = categoryFixture({
    id: "root",
    name: "Root",
    slug: "root"
  });
  const child = categoryFixture({
    id: "child",
    name: "Child",
    parentId: root.id,
    slug: "child"
  });
  const prisma = createCategoryPrismaMock([root, child]);
  const service = new CategoriesService(prisma);

  await service.deleteCategory(root.id, adminContext);

  const updateManyCall = prisma.calls.updateMany[0] as {
    data: { deletedAt: unknown; isActive: boolean };
    where: { id: { in: string[] } };
  };

  assert.equal(updateManyCall.data.deletedAt instanceof Date, true);
  assert.deepEqual(updateManyCall, {
    data: {
      deletedAt: updateManyCall.data.deletedAt,
      isActive: false
    },
    where: {
      id: {
        in: ["root", "child"]
      }
    }
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
  const auditCall = prisma.calls.adminAuditLogCreate[0] as {
    data: {
      action: string;
      after: { deletedCategoryIds: string[] };
      before: { categoryIds: string[] };
      entityId: string;
      entityType: string;
    };
  };
  assert.equal(auditCall.data.action, "category.delete");
  assert.deepEqual(auditCall.data.before.categoryIds, ["root", "child"]);
  assert.deepEqual(auditCall.data.after.deletedCategoryIds, ["root", "child"]);
  assert.equal(auditCall.data.entityId, root.id);
  assert.equal(auditCall.data.entityType, "Category");
});

test("admin category controller methods declare catalog permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminCategoriesController.prototype.createCategory
    ),
    [PermissionCode.ProductsCreate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminCategoriesController.prototype.updateCategory
    ),
    [PermissionCode.ProductsUpdate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminCategoriesController.prototype.deleteCategory
    ),
    [PermissionCode.ProductsDelete]
  );
});
