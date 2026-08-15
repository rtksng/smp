import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ConnectionOptions } from "node:tls";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import {
  AdminStatus,
  ProductStatus,
  StockMovementType,
  WarehouseStatus
} from "../src/generated/prisma/enums";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  buildCatalogImportPlan,
  CATALOG_SHEET_NAMES,
  DEFAULT_CATALOG_SHEET_ID,
  type CatalogImportPlan,
  type CatalogSheetCsv
} from "../src/catalog-import/catalog-sheet-transform";
import { AdminRoleCode } from "../src/modules/roles/roles.constants";

const API_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const EXECUTION_CONFIRMATION = "HARD_RESET_RAILWAY_CATALOG";
const VERIFIED_LOCAL_BACKUP_SHA256 =
  "713cb8e4801a7b052a45c6ac9c16f00598328340da42bdc61bb46938f366b867";
const EXPECTED_SOURCE_COUNTS = {
  brands: 12,
  cartItems: 1,
  categories: 92,
  inventoryStocks: 85,
  productDocuments: 144,
  productImages: 109,
  products: 37,
  productVariants: 81,
  stockBatches: 85,
  stockMovements: 92,
  warehouseStaff: 6,
  warehouses: 6
};
const EXPECTED_SOURCE_ASSETS = {
  bytes: 103_714_306,
  objects: 510
};
const CATALOG_ASSET_PREFIXES = [
  "catalog/brands/logos/",
  "catalog/categories/images/",
  "catalog/products/images/",
  "catalog/products/documents/"
];

type CatalogAsset = {
  key: string;
  size: number;
};

type ScriptOptions = {
  cleanupTransferKey: string | null;
  execute: boolean;
  localBackupSha256: string | null;
  sheetId: string;
};

loadEnvironment();

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const csv = await fetchCatalogCsv(options.sheetId);
  const plan = buildCatalogImportPlan(csv);
  const prisma = createPrismaClient();
  const s3 = createS3Client();
  const bucket = requiredEnv("S3_BUCKET", "AWS_S3_BUCKET");

  try {
    await prisma.$connect();

    const [currentCounts, assets, admin] = await Promise.all([
      readCatalogCounts(prisma),
      listCatalogAssets(s3, bucket),
      prisma.adminUser.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
        where: {
          deletedAt: null,
          role: { code: AdminRoleCode.SuperAdmin, deletedAt: null },
          status: AdminStatus.ACTIVE
        }
      })
    ]);

    if (!admin) {
      throw new Error("No active Super Admin is available for warehouse assignment.");
    }

    const summary = summarizePlan(plan);
    const assetBytes = assets.reduce((sum, asset) => sum + asset.size, 0);

    verifyExactCounts("Preflight catalog", currentCounts, EXPECTED_SOURCE_COUNTS);
    if (
      assets.length !== EXPECTED_SOURCE_ASSETS.objects ||
      assetBytes !== EXPECTED_SOURCE_ASSETS.bytes
    ) {
      throw new Error(
        `Preflight assets changed: objects=${assets.length}, bytes=${assetBytes}.`
      );
    }

    if (!options.execute) {
      printJson({
        assetBytesToDelete: assetBytes,
        assetObjectsToDelete: assets.length,
        backupMode: "verified-local-only",
        currentCounts,
        mode: "DRY_RUN",
        nextCommand: `pnpm catalog:reset:sheet -- --execute --confirm=${EXECUTION_CONFIRMATION} --local-backup-sha256=${VERIFIED_LOCAL_BACKUP_SHA256}`,
        plannedCounts: summary,
        sheetId: options.sheetId
      });
      return;
    }

    await replaceCatalog(prisma, plan, admin.id);

    const verifiedCounts = await readCatalogCounts(prisma);
    verifyImportedCounts(plan, verifiedCounts);
    await deleteCatalogAssets(s3, bucket, assets);
    const remainingAssets = await listCatalogAssets(s3, bucket);

    if (remainingAssets.length > 0) {
      throw new Error(
        `${remainingAssets.length} original catalog asset objects still remain.`
      );
    }

    if (options.cleanupTransferKey) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: options.cleanupTransferKey
        })
      );
    }

    printJson({
      backup: {
        mode: "verified-local-only",
        sha256: options.localBackupSha256
      },
      deletedTransferObject: options.cleanupTransferKey,
      deletedOriginalAssetObjects: assets.length,
      finalCounts: verifiedCounts,
      mode: "EXECUTED",
      sheetId: options.sheetId
    });
  } finally {
    await prisma.$disconnect();
    s3.destroy();
  }
}

function loadEnvironment() {
  for (const candidate of [
    path.join(REPO_ROOT, ".env"),
    path.join(API_ROOT, ".env"),
    path.join(API_ROOT, ".env.local")
  ]) {
    dotenv.config({ path: candidate, quiet: true });
  }
}

function parseOptions(args: string[]): ScriptOptions {
  const execute = args.includes("--execute");
  const confirmation = args
    .find((argument) => argument.startsWith("--confirm="))
    ?.slice("--confirm=".length);
  const sheetId =
    args
      .find((argument) => argument.startsWith("--sheet-id="))
      ?.slice("--sheet-id=".length)
      .trim() || DEFAULT_CATALOG_SHEET_ID;
  const localBackupSha256 =
    args
      .find((argument) => argument.startsWith("--local-backup-sha256="))
      ?.slice("--local-backup-sha256=".length)
      .trim()
      .toLowerCase() || null;
  const cleanupTransferKey =
    args
      .find((argument) => argument.startsWith("--cleanup-transfer-key="))
      ?.slice("--cleanup-transfer-key=".length)
      .trim() || null;

  if (execute && confirmation !== EXECUTION_CONFIRMATION) {
    throw new Error(
      `Refusing destructive reset. Pass --confirm=${EXECUTION_CONFIRMATION} with --execute.`
    );
  }
  if (execute && localBackupSha256 !== VERIFIED_LOCAL_BACKUP_SHA256) {
    throw new Error(
      `Refusing destructive reset without the verified local backup hash ${VERIFIED_LOCAL_BACKUP_SHA256}.`
    );
  }
  if (
    cleanupTransferKey &&
    !cleanupTransferKey.startsWith("temporary/catalog-reset-transfer/")
  ) {
    throw new Error("Cleanup transfer key is outside the allowed temporary prefix.");
  }

  return { cleanupTransferKey, execute, localBackupSha256, sheetId };
}

async function fetchCatalogCsv(sheetId: string): Promise<CatalogSheetCsv> {
  const entries = await Promise.all(
    CATALOG_SHEET_NAMES.map(async (sheetName) => {
      const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
      url.searchParams.set("sheet", sheetName);
      url.searchParams.set("tqx", "out:csv");
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Unable to fetch ${sheetName} tab (${response.status} ${response.statusText}).`
        );
      }

      return [sheetName, await response.text()] as const;
    })
  );

  return Object.fromEntries(entries) as CatalogSheetCsv;
}

function createPrismaClient() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const pgConfig: {
    connectionString: string;
    ssl?: boolean | ConnectionOptions;
  } = { connectionString: databaseUrlForPg(databaseUrl) };
  const ssl = rdsSslConfig(databaseUrl);

  if (ssl) {
    pgConfig.ssl = ssl;
  }

  return new PrismaClient({ adapter: new PrismaPg(pgConfig) });
}

function databaseUrlForPg(rawUrl: string) {
  const url = new URL(rawUrl);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");

  return url.toString();
}

function rdsSslConfig(rawUrl: string): ConnectionOptions | undefined {
  const url = new URL(rawUrl);

  if (!url.hostname.endsWith(".rds.amazonaws.com")) {
    return undefined;
  }

  const explicitPath = optionalEnv(
    "RDS_SSL_CA_FILE",
    "PGSSLROOTCERT",
    "NODE_EXTRA_CA_CERTS"
  );
  const candidates = [
    explicitPath,
    path.join(REPO_ROOT, "global-bundle.pem"),
    path.join(API_ROOT, "global-bundle.pem")
  ].filter((candidate): candidate is string => Boolean(candidate));
  const certificatePath = candidates.find((candidate) => existsSync(candidate));

  if (!certificatePath) {
    throw new Error("AWS RDS CA bundle was not found.");
  }

  return {
    ca: readFileSync(certificatePath, "utf8"),
    rejectUnauthorized: true,
    servername: url.hostname
  };
}

function createS3Client() {
  return new S3Client({
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY")
    },
    endpoint: optionalEnv("S3_ENDPOINT", "AWS_S3_ENDPOINT"),
    forcePathStyle: optionalEnv("S3_FORCE_PATH_STYLE") === "true",
    region: requiredEnv("S3_REGION", "AWS_REGION")
  });
}

async function listCatalogAssets(s3: S3Client, bucket: string) {
  const byKey = new Map<string, CatalogAsset>();

  for (const prefix of CATALOG_ASSET_PREFIXES) {
    let continuationToken: string | undefined;

    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          Prefix: prefix
        })
      );

      for (const object of page.Contents ?? []) {
        if (object.Key) {
          byKey.set(object.Key, { key: object.Key, size: object.Size ?? 0 });
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}

async function deleteCatalogAssets(
  s3: S3Client,
  bucket: string,
  assets: CatalogAsset[]
) {
  for (let index = 0; index < assets.length; index += 1000) {
    const chunk = assets.slice(index, index + 1000);

    if (chunk.length === 0) {
      continue;
    }

    const result = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((asset) => ({ Key: asset.key })),
          Quiet: true
        }
      })
    );

    if ((result.Errors?.length ?? 0) > 0) {
      throw new Error(
        `Catalog data was replaced, but ${result.Errors?.length} original asset objects could not be deleted.`
      );
    }
  }
}

async function readCatalogCounts(prisma: PrismaClient) {
  const [
    brands,
    categories,
    products,
    productImages,
    productDocuments,
    productVariants,
    inventoryStocks,
    stockBatches,
    stockMovements,
    warehouses,
    warehouseStaff,
    cartItems
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.productDocument.count(),
    prisma.productVariant.count(),
    prisma.inventoryStock.count(),
    prisma.stockBatch.count(),
    prisma.stockMovement.count(),
    prisma.warehouse.count(),
    prisma.warehouseStaff.count(),
    prisma.cartItem.count()
  ]);

  return {
    brands,
    cartItems,
    categories,
    inventoryStocks,
    productDocuments,
    productImages,
    products,
    productVariants,
    stockBatches,
    stockMovements,
    warehouseStaff,
    warehouses
  };
}

async function replaceCatalog(
  prisma: PrismaClient,
  plan: CatalogImportPlan,
  adminUserId: string
) {
  const brandIds = new Map(plan.brands.map((brand) => [brand.slug, randomUUID()]));
  const categoryIds = new Map(
    plan.categories.map((category) => [category.slug, randomUUID()])
  );
  const warehouseIds = new Map(
    plan.warehouses.map((warehouse) => [warehouse.code, randomUUID()])
  );
  const productIds = new Map(
    plan.products.map((product) => [product.sku, randomUUID()])
  );
  const batchIds = new Map(
    plan.inventory.map((inventory) => [inventory.productSku, randomUUID()])
  );
  const rootCategories = plan.categories.filter((category) => !category.parentSlug);
  const subcategories = plan.categories.filter((category) => category.parentSlug);

  await prisma.$transaction(
    async (transaction) => {
      await transaction.deliveryAssignment.updateMany({
        data: { pickupWarehouseId: null },
        where: { pickupWarehouseId: { not: null } }
      });
      await transaction.deliveryChargeRule.updateMany({
        data: { warehouseId: null },
        where: { warehouseId: { not: null } }
      });
      await transaction.order.updateMany({
        data: { warehouseId: null },
        where: { warehouseId: { not: null } }
      });
      await transaction.orderItem.updateMany({
        data: {
          productId: null,
          stockBatchId: null,
          variantId: null,
          warehouseId: null
        },
        where: {
          OR: [
            { productId: { not: null } },
            { stockBatchId: { not: null } },
            { variantId: { not: null } },
            { warehouseId: { not: null } }
          ]
        }
      });
      await transaction.invoiceItem.updateMany({
        data: { productId: null },
        where: { productId: { not: null } }
      });

      await transaction.cartItem.deleteMany();
      await transaction.stockMovement.deleteMany();
      await transaction.inventoryStock.deleteMany();
      await transaction.stockBatch.deleteMany();
      await transaction.product.deleteMany();
      await transaction.warehouseStaff.deleteMany();
      await transaction.warehouse.deleteMany();
      await transaction.category.deleteMany();
      await transaction.brand.deleteMany();

      await transaction.brand.createMany({
        data: plan.brands.map((brand) => ({
          ...brand,
          id: brandIds.get(brand.slug)!
        }))
      });
      await transaction.category.createMany({
        data: rootCategories.map((category) => ({
          description: category.description,
          id: categoryIds.get(category.slug)!,
          imageUrl: null,
          isActive: category.isActive,
          name: category.name,
          parentId: null,
          slug: category.slug,
          sortOrder: category.sortOrder
        }))
      });
      await transaction.category.createMany({
        data: subcategories.map((category) => ({
          description: category.description,
          id: categoryIds.get(category.slug)!,
          imageUrl: null,
          isActive: category.isActive,
          name: category.name,
          parentId: categoryIds.get(category.parentSlug!)!,
          slug: category.slug,
          sortOrder: category.sortOrder
        }))
      });
      await transaction.warehouse.createMany({
        data: plan.warehouses.map((warehouse) => ({
          ...warehouse,
          id: warehouseIds.get(warehouse.code)!,
          status: WarehouseStatus.ACTIVE
        }))
      });
      await transaction.warehouseStaff.createMany({
        data: plan.warehouses.map((warehouse) => ({
          adminUserId,
          id: randomUUID(),
          warehouseId: warehouseIds.get(warehouse.code)!
        }))
      });
      await transaction.product.createMany({
        data: plan.products.map((product) => ({
          basePrice: product.basePrice,
          brandId: brandIds.get(product.brandSlug)!,
          categoryId: categoryIds.get(product.categorySlug)!,
          description: product.description,
          disposable: product.disposable,
          expirySensitive: product.expirySensitive,
          id: productIds.get(product.sku)!,
          material: product.material,
          medicalSpecialty: product.medicalSpecialty,
          metaDescription: product.metaDescription,
          metaTitle: product.metaTitle,
          mrp: product.mrp,
          name: product.name,
          packSize: product.packSize,
          searchTags: product.searchTags,
          sellingPrice: product.sellingPrice,
          shortDescription: product.shortDescription,
          sku: product.sku,
          slug: product.slug,
          status: ProductStatus.ACTIVE,
          sterile: product.sterile,
          subcategoryId: categoryIds.get(product.subcategorySlug)!,
          taxRate: product.taxRate,
          unit: product.unit
        }))
      });
      await transaction.inventoryStock.createMany({
        data: plan.inventory.map((inventory) => ({
          availableQuantity: inventory.quantity,
          id: randomUUID(),
          productId: productIds.get(inventory.productSku)!,
          reorderLevel: inventory.lowStockThreshold,
          reservedQuantity: 0,
          variantId: null,
          warehouseId: warehouseIds.get(inventory.warehouseCode)!
        }))
      });
      await transaction.stockBatch.createMany({
        data: plan.inventory.map((inventory) => ({
          batchNumber: inventory.batchNumber,
          expiryDate: inventory.expiryDate ? new Date(inventory.expiryDate) : null,
          id: batchIds.get(inventory.productSku)!,
          mrp: inventory.mrp,
          productId: productIds.get(inventory.productSku)!,
          purchasePrice: inventory.purchasePrice,
          quantity: inventory.quantity,
          sellingPrice: inventory.sellingPrice,
          variantId: null,
          warehouseId: warehouseIds.get(inventory.warehouseCode)!
        }))
      });
      await transaction.stockMovement.createMany({
        data: plan.inventory.map((inventory) => ({
          createdById: adminUserId,
          id: randomUUID(),
          metadata: { source: "google-sheet-catalog-reset" },
          notes:
            "Deterministic opening inventory generated during catalog replacement.",
          productId: productIds.get(inventory.productSku)!,
          quantity: inventory.quantity,
          referenceId: inventory.batchNumber,
          referenceType: "CATALOG_RESET",
          stockBatchId: batchIds.get(inventory.productSku)!,
          type: StockMovementType.IN,
          variantId: null,
          warehouseId: warehouseIds.get(inventory.warehouseCode)!
        }))
      });
    },
    { maxWait: 10_000, timeout: 180_000 }
  );
}

function summarizePlan(plan: CatalogImportPlan) {
  return {
    brands: plan.brands.length,
    categories: plan.categories.length,
    inventoryStocks: plan.inventory.length,
    productDocuments: 0,
    productImages: 0,
    products: plan.products.length,
    productVariants: 0,
    rootCategories: plan.categories.filter((category) => !category.parentSlug).length,
    stockBatches: plan.inventory.length,
    stockMovements: plan.inventory.length,
    subcategories: plan.categories.filter((category) => category.parentSlug).length,
    warehouses: plan.warehouses.length
  };
}

function verifyExactCounts(
  label: string,
  actual: Awaited<ReturnType<typeof readCatalogCounts>>,
  expected: typeof EXPECTED_SOURCE_COUNTS
) {
  const failures = Object.entries(expected)
    .filter(([key, expectedCount]) => {
      const actualCount = actual[key as keyof typeof actual];
      return actualCount !== expectedCount;
    })
    .map(([key, expectedCount]) => {
      const actualCount = actual[key as keyof typeof actual];
      return `${key}: ${actualCount} (expected ${expectedCount})`;
    });

  if (failures.length > 0) {
    throw new Error(`${label} verification failed: ${failures.join(", ")}`);
  }
}

function verifyImportedCounts(
  plan: CatalogImportPlan,
  counts: Awaited<ReturnType<typeof readCatalogCounts>>
) {
  const expected = summarizePlan(plan);
  const checks: Array<[string, number, number]> = [
    ["brands", counts.brands, expected.brands],
    ["categories", counts.categories, expected.categories],
    ["products", counts.products, expected.products],
    ["productImages", counts.productImages, 0],
    ["productDocuments", counts.productDocuments, 0],
    ["productVariants", counts.productVariants, 0],
    ["inventoryStocks", counts.inventoryStocks, expected.inventoryStocks],
    ["stockBatches", counts.stockBatches, expected.stockBatches],
    ["stockMovements", counts.stockMovements, expected.stockMovements],
    ["warehouses", counts.warehouses, expected.warehouses],
    ["warehouseStaff", counts.warehouseStaff, expected.warehouses],
    ["cartItems", counts.cartItems, 0]
  ];
  const failures = checks
    .filter(([, actual, expectedCount]) => actual !== expectedCount)
    .map(
      ([label, actual, expectedCount]) =>
        `${label}: ${actual} (expected ${expectedCount})`
    );

  if (failures.length > 0) {
    throw new Error(`Post-import verification failed: ${failures.join(", ")}`);
  }
}

function requiredEnv(...names: string[]) {
  const value = optionalEnv(...names);

  if (!value) {
    throw new Error(`Missing required environment variable: ${names.join(" or ")}.`);
  }

  return value;
}

function optionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
