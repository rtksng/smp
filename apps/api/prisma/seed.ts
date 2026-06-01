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
import { FIXED_CATALOG_BRANDS } from "../src/modules/brands/fixed-catalog-brands";

type SeedEnvironment = Record<string, string | undefined>;

export type SeedSuperAdminInput = {
  email: string;
  firstName: string;
  lastName: string;
  mobileNumber: string | null;
  password: string;
};

type CatalogSubcategorySeed = {
  name: string;
  slug: string;
};

type CatalogCategorySeed = CatalogSubcategorySeed & {
  subcategories: CatalogSubcategorySeed[];
};

type CatalogBrandSeed = {
  name: string;
  slug: string;
};

export const CATALOG_BRANDS: CatalogBrandSeed[] = FIXED_CATALOG_BRANDS.map(
  (brand) => ({
    name: brand.name,
    slug: brand.slug
  })
);

export const CATALOG_CATEGORY_TREE: CatalogCategorySeed[] = [
  {
    name: "Dental",
    slug: "dental",
    subcategories: [
      { name: "Endodontics", slug: "endodontics" },
      { name: "Restoratives", slug: "restoratives" },
      { name: "Impression Materials", slug: "impression-materials" },
      { name: "Small Equipment", slug: "small-equipment" },
      { name: "Consumables", slug: "dental-consumables" },
      { name: "Crown & Bridge", slug: "crown-bridge" },
      { name: "Orthodontics", slug: "orthodontics" }
    ]
  },
  {
    name: "Diagnostics",
    slug: "diagnostics",
    subcategories: [
      { name: "Instruments", slug: "instruments" },
      { name: "Biochemistry", slug: "biochemistry" },
      { name: "Rapid Cards", slug: "rapid-cards" },
      { name: "Phlebotomy", slug: "phlebotomy" },
      { name: "Diagnostic Test Kits", slug: "diagnostic-test-kits" },
      { name: "Equipment Accessories", slug: "equipment-accessories" },
      { name: "Serology", slug: "serology" },
      { name: "Point of Care Testing (POCT)", slug: "point-of-care-testing-poct" }
    ]
  },
  {
    name: "Consumables",
    slug: "consumables",
    subcategories: [
      { name: "Medical Consumables", slug: "medical-consumables" },
      { name: "Hygiene Control", slug: "hygiene-control" },
      { name: "Surgical Consumables", slug: "surgical-consumables" },
      { name: "Minimally Invasive Surgery", slug: "minimally-invasive-surgery" },
      { name: "Catheters", slug: "catheters" },
      { name: "Bandages & Wound", slug: "bandages-wound" },
      { name: "Gown & Drapes", slug: "gown-drapes" },
      { name: "Kits", slug: "kits" },
      { name: "Medical Instruments", slug: "medical-instruments" }
    ]
  },
  {
    name: "Equipment",
    slug: "equipment",
    subcategories: [
      { name: "Critical Care", slug: "critical-care" },
      { name: "General Physician", slug: "general-physician" },
      { name: "Hospital Furniture", slug: "hospital-furniture" },
      { name: "Infection Control", slug: "infection-control" },
      { name: "Mother and Child", slug: "mother-and-child" },
      { name: "Orthopaedics", slug: "orthopaedics" },
      { name: "Pain Management", slug: "pain-management" },
      { name: "Radiology", slug: "radiology" },
      { name: "Surgery", slug: "surgery" },
      { name: "CSSD", slug: "cssd" }
    ]
  },
  { name: "Orthopedics", slug: "orthopedics", subcategories: [] },
  {
    name: "Ophthalmology",
    slug: "ophthalmology",
    subcategories: [
      { name: "Diagnostic Lenses", slug: "diagnostic-lenses" },
      { name: "Diagnostic Equipment", slug: "diagnostic-equipment" },
      { name: "Surgical Instruments and Kits", slug: "surgical-instruments-and-kits" },
      { name: "Ophthalmic Consumables", slug: "ophthalmic-consumables" },
      { name: "Vision Care", slug: "vision-care" },
      { name: "Ophthalmic Furniture", slug: "ophthalmic-furniture" }
    ]
  },
  {
    name: "Nephrology",
    slug: "nephrology",
    subcategories: [
      { name: "Dialysis Machines", slug: "dialysis-machines" },
      { name: "Dialyzers", slug: "dialyzers" },
      { name: "Dialysis Catheters", slug: "dialysis-catheters" },
      { name: "Blood Tubing Sets", slug: "blood-tubing-sets" },
      { name: "Fistula Needles", slug: "fistula-needles" },
      { name: "Dialysis Disinfectants", slug: "dialysis-disinfectants" }
    ]
  },
  {
    name: "Pharma",
    slug: "pharma",
    subcategories: [
      { name: "Cardiac", slug: "cardiac" },
      { name: "IVF & GYN", slug: "ivf-gyn" },
      { name: "Nephro", slug: "nephro" },
      { name: "Critical Care", slug: "pharma-critical-care" }
    ]
  },
  {
    name: "Cardiology",
    slug: "cardiology",
    subcategories: [
      { name: "Accessories", slug: "accessories" },
      { name: "Aspiration Catheter", slug: "aspiration-catheter" },
      { name: "Catheter", slug: "catheter" },
      { name: "Coronary Cutting Balloon", slug: "coronary-cutting-balloon" },
      {
        name: "Drug Eluting Coronary Balloon",
        slug: "drug-eluting-coronary-balloon"
      },
      { name: "Guide Wire", slug: "guide-wire" },
      { name: "Introducer Sheath", slug: "introducer-sheath" },
      {
        name: "NC PTCA Balloon Dilatation Catheter",
        slug: "nc-ptca-balloon-dilatation-catheter"
      },
      {
        name: "SC PTCA Balloon Dilatation Catheter",
        slug: "sc-ptca-balloon-dilatation-catheter"
      },
      {
        name: "Peripheral Drug Eluting Balloon",
        slug: "peripheral-drug-eluting-balloon"
      }
    ]
  },
  {
    name: "Physiotherapy",
    slug: "physiotherapy",
    subcategories: [
      { name: "Neoprene Products", slug: "neoprene-products" },
      { name: "Knee Support", slug: "knee-support" },
      { name: "Body Belts & Braces", slug: "body-belts-braces" },
      { name: "Allied Products", slug: "allied-products" },
      { name: "Cervical Aids", slug: "cervical-aids" },
      { name: "Compression Stockings", slug: "compression-stockings" },
      { name: "Ankle Supports", slug: "ankle-supports" },
      { name: "Silicone & Foot Care Range", slug: "silicone-foot-care-range" },
      { name: "Finger Splints", slug: "finger-splints" },
      { name: "Fracture Aids", slug: "fracture-aids" },
      { name: "Traction Kits", slug: "traction-kits" }
    ]
  },
  { name: "Vaccines", slug: "vaccines", subcategories: [] },
  {
    name: "IVF/Gynae",
    slug: "ivf-gynae",
    subcategories: [
      { name: "IUI & IVF", slug: "iui-ivf" },
      { name: "HSG & Tubal Care", slug: "hsg-tubal-care" },
      { name: "Biopsy & Sampling", slug: "biopsy-sampling" },
      { name: "Hysteroscopy", slug: "hysteroscopy" },
      { name: "Gynae Consumables", slug: "gynae-consumables" }
    ]
  }
];

export function flattenSeedCatalogCategories(
  categories: CatalogCategorySeed[] = CATALOG_CATEGORY_TREE
) {
  return categories.flatMap((category, categoryIndex) => [
    {
      name: category.name,
      parentSlug: null,
      slug: category.slug,
      sortOrder: categoryIndex + 1
    },
    ...category.subcategories.map((subcategory, subcategoryIndex) => ({
      name: subcategory.name,
      parentSlug: category.slug,
      slug: subcategory.slug,
      sortOrder: subcategoryIndex + 1
    }))
  ]);
}

export function getSeedCatalogCategorySlugs(
  categories: CatalogCategorySeed[] = CATALOG_CATEGORY_TREE
) {
  return flattenSeedCatalogCategories(categories).map((category) => category.slug);
}

export function getSeedCatalogBrandSlugs(
  brands: CatalogBrandSeed[] = CATALOG_BRANDS
) {
  return brands.map((brand) => brand.slug);
}

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

export async function seedCatalogCategories(prisma: PrismaClient) {
  const fixedCatalogSlugs = getSeedCatalogCategorySlugs();

  for (const [categoryIndex, category] of CATALOG_CATEGORY_TREE.entries()) {
    const parent = await prisma.category.upsert({
      create: {
        isActive: true,
        name: category.name,
        parentId: null,
        slug: category.slug,
        sortOrder: categoryIndex + 1
      },
      update: {
        deletedAt: null,
        isActive: true,
        name: category.name,
        parentId: null,
        sortOrder: categoryIndex + 1
      },
      where: {
        slug: category.slug
      }
    });

    for (const [subcategoryIndex, subcategory] of category.subcategories.entries()) {
      await prisma.category.upsert({
        create: {
          isActive: true,
          name: subcategory.name,
          parentId: parent.id,
          slug: subcategory.slug,
          sortOrder: subcategoryIndex + 1
        },
        update: {
          deletedAt: null,
          isActive: true,
          name: subcategory.name,
          parentId: parent.id,
          sortOrder: subcategoryIndex + 1
        },
        where: {
          slug: subcategory.slug
        }
      });
    }
  }

  const retiredAt = new Date();
  const nonFixedCategories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: true,
          subcategoryProducts: true
        }
      }
    },
    where: {
      deletedAt: null,
      slug: {
        notIn: fixedCatalogSlugs
      }
    }
  });

  for (const category of nonFixedCategories) {
    if (category._count.products > 0 || category._count.subcategoryProducts > 0) {
      continue;
    }

    await prisma.category.update({
      data: {
        deletedAt: retiredAt,
        isActive: false
      },
      where: {
        id: category.id
      }
    });
  }
}

export async function seedCatalogBrands(prisma: PrismaClient) {
  const fixedCatalogBrandSlugs = getSeedCatalogBrandSlugs();

  for (const brand of CATALOG_BRANDS) {
    await prisma.brand.upsert({
      create: {
        isActive: true,
        name: brand.name,
        slug: brand.slug
      },
      update: {
        deletedAt: null,
        isActive: true,
        name: brand.name
      },
      where: {
        slug: brand.slug
      }
    });
  }

  const retiredAt = new Date();
  const nonFixedBrands = await prisma.brand.findMany({
    include: {
      _count: {
        select: {
          products: true
        }
      }
    },
    where: {
      deletedAt: null,
      slug: {
        notIn: fixedCatalogBrandSlugs
      }
    }
  });

  for (const brand of nonFixedBrands) {
    if (brand._count.products > 0) {
      continue;
    }

    await prisma.brand.update({
      data: {
        deletedAt: retiredAt,
        isActive: false
      },
      where: {
        id: brand.id
      }
    });
  }
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
    await seedCatalogCategories(prisma);
    await seedCatalogBrands(prisma);
    console.log("Seeded default roles and permissions.");
    console.log("Seeded fixed catalog categories, subcategories, and brands.");
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
