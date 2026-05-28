import path from "node:path";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { AdminStatus } from "../src/generated/prisma/enums";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  DEFAULT_PERMISSIONS,
  type PermissionCode
} from "../src/modules/permissions/permissions.constants";
import {
  AdminRoleCode,
  DEFAULT_ROLE_PERMISSION_CODES,
  DEFAULT_ROLES
} from "../src/modules/roles/roles.constants";

type SeedEnvironment = Record<string, string | undefined>;

export type SeedSuperAdminInput = {
  email: string;
  firstName: string;
  lastName: string;
  mobileNumber: string | null;
  password: string;
};

function trim(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requireSeedValue(
  env: SeedEnvironment,
  name: keyof SeedEnvironment
) {
  const value = trim(env[name]);

  if (!value) {
    throw new Error(`${name} is required when seeding the first super admin.`);
  }

  return value;
}

export function getSeedSuperAdminInput(
  env: SeedEnvironment
): SeedSuperAdminInput | null {
  const hasEmail = Boolean(trim(env.SEED_SUPER_ADMIN_EMAIL));
  const hasPassword = Boolean(trim(env.SEED_SUPER_ADMIN_PASSWORD));

  if (!hasEmail && !hasPassword) {
    return null;
  }

  return {
    email: requireSeedValue(env, "SEED_SUPER_ADMIN_EMAIL").toLowerCase(),
    firstName: trim(env.SEED_SUPER_ADMIN_FIRST_NAME) ?? "Super",
    lastName: trim(env.SEED_SUPER_ADMIN_LAST_NAME) ?? "Admin",
    mobileNumber: trim(env.SEED_SUPER_ADMIN_MOBILE_NUMBER) ?? null,
    password: requireSeedValue(env, "SEED_SUPER_ADMIN_PASSWORD")
  };
}

function loadSeedEnvironment() {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
  dotenv.config();
}

function requireRuntimeValue(name: string) {
  const value = trim(process.env[name]);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: requireRuntimeValue("DATABASE_URL")
    })
  });
}

async function seedDefaultPermissions(prisma: PrismaClient) {
  for (const permission of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      create: {
        code: permission.code,
        description: permission.description,
        name: permission.name
      },
      update: {
        deletedAt: null,
        description: permission.description,
        name: permission.name
      },
      where: {
        code: permission.code
      }
    });
  }
}

async function seedDefaultRoles(prisma: PrismaClient) {
  const permissionIdByCode = new Map<PermissionCode, string>();
  const permissions = await prisma.permission.findMany({
    where: {
      code: {
        in: DEFAULT_PERMISSIONS.map((permission) => permission.code)
      }
    }
  });

  for (const permission of permissions) {
    permissionIdByCode.set(permission.code as PermissionCode, permission.id);
  }

  for (const role of DEFAULT_ROLES) {
    const seededRole = await prisma.role.upsert({
      create: {
        code: role.code,
        description: role.description,
        isSystem: role.isSystem,
        name: role.name
      },
      update: {
        deletedAt: null,
        description: role.description,
        isSystem: role.isSystem,
        name: role.name
      },
      where: {
        code: role.code
      }
    });

    for (const permissionCode of DEFAULT_ROLE_PERMISSION_CODES[role.code]) {
      const permissionId = permissionIdByCode.get(permissionCode);

      if (!permissionId) {
        throw new Error(`Seed permission ${permissionCode} was not found.`);
      }

      await prisma.rolePermission.upsert({
        create: {
          permissionId,
          roleId: seededRole.id
        },
        update: {},
        where: {
          roleId_permissionId: {
            permissionId,
            roleId: seededRole.id
          }
        }
      });
    }
  }
}

async function seedFirstSuperAdmin(
  prisma: PrismaClient,
  input: SeedSuperAdminInput | null
) {
  if (!input) {
    console.log(
      "Skipped first super admin seed. Set SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD to create one."
    );
    return;
  }

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: AdminRoleCode.SuperAdmin
    }
  });
  const passwordHash = await bcrypt.hash(
    input.password,
    Number(process.env.BCRYPT_SALT_ROUNDS ?? 12)
  );

  await prisma.adminUser.upsert({
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      mobileNumber: input.mobileNumber,
      passwordHash,
      roleId: superAdminRole.id,
      status: AdminStatus.ACTIVE
    },
    update: {
      deletedAt: null,
      firstName: input.firstName,
      lastName: input.lastName,
      mobileNumber: input.mobileNumber,
      passwordHash,
      roleId: superAdminRole.id,
      status: AdminStatus.ACTIVE
    },
    where: {
      email: input.email
    }
  });

  console.log(`Seeded super admin ${input.email}.`);
}

export async function seedAccessControl(prisma: PrismaClient) {
  await seedDefaultPermissions(prisma);
  await seedDefaultRoles(prisma);
  await seedFirstSuperAdmin(prisma, getSeedSuperAdminInput(process.env));
}

export async function main() {
  loadSeedEnvironment();

  const prisma = createPrismaClient();

  try {
    await seedAccessControl(prisma);
    console.log("Seeded default roles and permissions.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
