import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { AdminUsersService } from "../../src/modules/admin-users/admin-users.service";
import type { PasswordService } from "../../src/modules/auth/common/password.service";
import type { PrismaService } from "../../src/database/prisma.service";

const now = new Date("2026-05-25T10:00:00.000Z");
const context = {
  auth: {
    audience: "admin",
    permissions: ["settings.manage"],
    role: "SUPER_ADMIN",
    sessionId: "session-1",
    sub: "actor-1"
  },
  ipAddress: "127.0.0.1",
  userAgent: "node-test"
} as const;

type AdminUsersPrismaMock = PrismaService & {
  calls: {
    adminAuditLogCreate: unknown[];
    adminSessionUpdateMany: unknown[];
    adminUserCreate: unknown[];
    adminUserFindFirst: unknown[];
    adminUserUpdate: unknown[];
    roleFindFirst: unknown[];
  };
};

function createPrismaMock(options: { existingEmail?: boolean; roleFound?: boolean } = {}) {
  const calls: AdminUsersPrismaMock["calls"] = {
    adminAuditLogCreate: [],
    adminSessionUpdateMany: [],
    adminUserCreate: [],
    adminUserFindFirst: [],
    adminUserUpdate: [],
    roleFindFirst: []
  };
  const prisma = {
    calls,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return args;
      }
    },
    adminSession: {
      updateMany: async (args: unknown) => {
        calls.adminSessionUpdateMany.push(args);
        return { count: 1 };
      }
    },
    adminUser: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.adminUserCreate.push(args);
        return {
          ...args.data,
          createdAt: now,
          deletedAt: null,
          id: "admin-1",
          lastLoginAt: null,
          role: {
            code: "ORDER_MANAGER",
            id: args.data.roleId,
            name: "Order manager"
          },
          updatedAt: now
        };
      },
      findFirst: async (args: unknown) => {
        calls.adminUserFindFirst.push(args);

        if (
          typeof args === "object" &&
          args !== null &&
          "where" in args &&
          typeof (args as { where?: { id?: unknown } }).where?.id === "string"
        ) {
          return {
            createdAt: now,
            deletedAt: null,
            email: "ops@example.com",
            firstName: "Ops",
            id: (args as { where: { id: string } }).where.id,
            lastLoginAt: null,
            lastName: null,
            mobileNumber: null,
            role: {
              code: "ORDER_MANAGER",
              id: "role-1",
              name: "Order manager"
            },
            roleId: "role-1",
            status: "ACTIVE",
            updatedAt: now
          };
        }

        if (options.existingEmail) {
          return { id: "existing-admin" };
        }

        return null;
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.adminUserUpdate.push(args);
        return {
          ...args.data,
          createdAt: now,
          deletedAt: null,
          email: "ops@example.com",
          firstName: "Ops",
          id: args.where.id,
          lastLoginAt: null,
          lastName: null,
          mobileNumber: null,
          role: {
            code: "ORDER_MANAGER",
            id: "role-1",
            name: "Order manager"
          },
          roleId: "role-1",
          updatedAt: now
        };
      }
    },
    role: {
      findFirst: async (args: unknown) => {
        calls.roleFindFirst.push(args);
        return options.roleFound === false
          ? null
          : {
              code: "ORDER_MANAGER",
              id: "role-1",
              name: "Order manager"
            };
      }
    }
  };

  return prisma as unknown as AdminUsersPrismaMock;
}

const passwordService = {
  hash: async (password: string) => `hashed:${password}`
} as PasswordService;

test("createAdminUser hashes passwords, lowercases email, validates role, and audits", async () => {
  const prisma = createPrismaMock();
  const service = new AdminUsersService(prisma, passwordService);

  const created = await service.createAdminUser(
    {
      email: " OPS@EXAMPLE.COM ",
      firstName: "Ops",
      lastName: null,
      mobileNumber: null,
      password: "StrongPass123",
      roleId: "role-1",
      status: "ACTIVE"
    },
    context
  );

  assert.equal(created.email, "ops@example.com");
  assert.deepEqual(prisma.calls.roleFindFirst[0], {
    where: {
      deletedAt: null,
      id: "role-1"
    }
  });
  assert.deepEqual(prisma.calls.adminUserCreate[0], {
    data: {
      email: "ops@example.com",
      firstName: "Ops",
      lastName: null,
      mobileNumber: null,
      passwordHash: "hashed:StrongPass123",
      roleId: "role-1",
      status: "ACTIVE"
    },
    include: {
      role: true
    }
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("createAdminUser rejects missing roles and duplicate active emails", async () => {
  await assert.rejects(
    () =>
      new AdminUsersService(createPrismaMock({ roleFound: false }), passwordService)
        .createAdminUser(
          {
            email: "ops@example.com",
            firstName: "Ops",
            password: "StrongPass123",
            roleId: "missing-role",
            status: "ACTIVE"
          },
          context
        ),
    NotFoundException
  );

  await assert.rejects(
    () =>
      new AdminUsersService(createPrismaMock({ existingEmail: true }), passwordService)
        .createAdminUser(
          {
            email: "ops@example.com",
            firstName: "Ops",
            password: "StrongPass123",
            roleId: "role-1",
            status: "ACTIVE"
          },
          context
        ),
    ConflictException
  );
});

test("deleteAdminUser soft deletes admins and revokes active sessions", async () => {
  const prisma = createPrismaMock();
  const service = new AdminUsersService(prisma, passwordService);

  await service.deleteAdminUser("admin-1", context);

  const updateCall = prisma.calls.adminUserUpdate[0] as {
    data: { deletedAt: Date; status: string };
    where: { id: string };
  };
  assert.equal(updateCall.data.deletedAt instanceof Date, true);
  assert.deepEqual(updateCall.where, { id: "admin-1" });
  assert.equal(updateCall.data.status, "INACTIVE");
  assert.deepEqual(prisma.calls.adminSessionUpdateMany[0], {
    data: {
      revokedAt: updateCall.data.deletedAt
    },
    where: {
      adminUserId: "admin-1",
      revokedAt: null
    }
  });
});
