import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { AdminProductsController } from "../../src/modules/products/admin-products.controller";
import { ProductsService } from "../../src/modules/products/products.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AdminActionContext } from "../../src/modules/warehouses/warehouses.service";
import type { PrismaService } from "../../src/database/prisma.service";

type ProductStatusFixture = "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
type ProductDocumentTypeFixture = "CERTIFICATE" | "MANUAL" | "WARRANTY" | "COMPLIANCE";

type RelatedFixture = {
  deletedAt: Date | null;
  id: string;
  isActive: boolean;
  name: string;
  parentId?: string | null;
  slug: string;
};

type ProductImageFixture = {
  altText: string | null;
  id: string;
  isPrimary: boolean;
  productId: string;
  sortOrder: number;
  url: string;
};

type ProductVariantFixture = {
  attributes: Record<string, unknown>;
  deletedAt: Date | null;
  id: string;
  mrp: string;
  name: string;
  productId: string;
  sellingPrice: string;
  sku: string;
  status: ProductStatusFixture;
};

type ProductDocumentFixture = {
  fileKey: string;
  fileUrl: string;
  id: string;
  productId: string;
  title: string;
  type: ProductDocumentTypeFixture;
};

type InventoryStockFixture = {
  availableQuantity: number;
  reservedQuantity: number;
};

type ProductFixture = {
  basePrice: string;
  brand: RelatedFixture;
  brandId: string;
  category: RelatedFixture;
  categoryId: string;
  createdAt: Date;
  deletedAt: Date | null;
  description: string;
  disposable: boolean;
  documents: ProductDocumentFixture[];
  expirySensitive: boolean;
  id: string;
  images: ProductImageFixture[];
  inventoryStocks: InventoryStockFixture[];
  material: string | null;
  medicalSpecialty: string | null;
  metaDescription: string | null;
  metaTitle: string | null;
  mrp: string;
  name: string;
  packSize: string | null;
  searchTags: string[];
  sellingPrice: string;
  shortDescription: string;
  sku: string;
  slug: string;
  status: ProductStatusFixture;
  sterile: boolean;
  subcategory: RelatedFixture | null;
  subcategoryId: string | null;
  taxRate: string;
  unit: string;
  updatedAt: Date;
  variants: ProductVariantFixture[];
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

const activeBrand: RelatedFixture = {
  deletedAt: null,
  id: "brand-1",
  isActive: true,
  name: "Abbott",
  slug: "abbott"
};

const activeCategory: RelatedFixture = {
  deletedAt: null,
  id: "category-1",
  isActive: true,
  name: "Dental",
  parentId: null,
  slug: "dental"
};

const activeSubcategory: RelatedFixture = {
  deletedAt: null,
  id: "subcategory-1",
  isActive: true,
  name: "Endodontics",
  parentId: activeCategory.id,
  slug: "endodontics"
};

function productFixture(input: Partial<ProductFixture> = {}): ProductFixture {
  const id = input.id ?? "product-1";

  return {
    basePrice: "100.00",
    brand: activeBrand,
    brandId: activeBrand.id,
    category: activeCategory,
    categoryId: activeCategory.id,
    createdAt: now,
    deletedAt: null,
    description: "Reusable artery forceps for operating rooms.",
    disposable: false,
    documents: [
      {
        fileKey: "products/forceps/certificate.pdf",
        fileUrl: "https://cdn.example.com/products/forceps/certificate.pdf",
        id: "document-1",
        productId: id,
        title: "Sterility Certificate",
        type: "CERTIFICATE"
      }
    ],
    expirySensitive: false,
    id,
    images: [
      {
        altText: "Curved artery forceps",
        id: "image-1",
        isPrimary: true,
        productId: id,
        sortOrder: 1,
        url: "https://cdn.example.com/products/forceps/main.jpg"
      }
    ],
    inventoryStocks: [
      {
        availableQuantity: 12,
        reservedQuantity: 2
      }
    ],
    material: "Stainless steel",
    medicalSpecialty: "General Surgery",
    metaDescription: "Buy surgical forceps online.",
    metaTitle: "Surgical Forceps",
    mrp: "150.00",
    name: "Curved Artery Forceps",
    packSize: "1 pc",
    searchTags: ["forceps", "artery"],
    sellingPrice: "120.00",
    shortDescription: "Curved artery forceps.",
    sku: "FORCEPS-001",
    slug: "curved-artery-forceps",
    status: "ACTIVE",
    sterile: true,
    subcategory: activeSubcategory,
    subcategoryId: activeSubcategory.id,
    taxRate: "18.00",
    unit: "piece",
    updatedAt: now,
    variants: [
      {
        attributes: {
          size: "6 inch"
        },
        deletedAt: null,
        id: "variant-1",
        mrp: "175.00",
        name: "6 inch",
        productId: id,
        sellingPrice: "140.00",
        sku: "FORCEPS-001-6IN",
        status: "ACTIVE"
      }
    ],
    ...input
  };
}

type ProductPrismaMock = PrismaService & {
  calls: {
    adminAuditLogCreate: unknown[];
    brandFindFirst: unknown[];
    categoryFindFirst: unknown[];
    productCount: unknown[];
    productCreate: unknown[];
    productDocumentCreateMany: unknown[];
    productDocumentDeleteMany: unknown[];
    productFindFirst: unknown[];
    productFindMany: unknown[];
    productImageCreateMany: unknown[];
    productImageDeleteMany: unknown[];
    productUpdate: unknown[];
    productVariantCreateMany: unknown[];
    productVariantDeleteMany: unknown[];
    transaction: unknown[];
  };
};

type ProductFindFirstArgs = {
  where?: {
    id?: string;
    OR?: Array<{ id?: string; slug?: string }>;
    slug?: string;
  };
};

function createProductPrismaMock(records: ProductFixture[]): ProductPrismaMock {
  const calls: ProductPrismaMock["calls"] = {
    adminAuditLogCreate: [],
    brandFindFirst: [],
    categoryFindFirst: [],
    productCount: [],
    productCreate: [],
    productDocumentCreateMany: [],
    productDocumentDeleteMany: [],
    productFindFirst: [],
    productFindMany: [],
    productImageCreateMany: [],
    productImageDeleteMany: [],
    productUpdate: [],
    productVariantCreateMany: [],
    productVariantDeleteMany: [],
    transaction: []
  };

  const mock = {
    $transaction: async <T>(callback: (tx: ProductPrismaMock) => Promise<T>) => {
      calls.transaction.push(true);
      return callback(mock as ProductPrismaMock);
    },
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    brand: {
      findFirst: async (args: unknown) => {
        calls.brandFindFirst.push(args);
        return activeBrand;
      }
    },
    calls,
    category: {
      findFirst: async (args: { where?: { id?: string } }) => {
        calls.categoryFindFirst.push(args);
        if (args.where?.id === activeSubcategory.id) {
          return activeSubcategory;
        }

        if (args.where?.id === activeCategory.id) {
          return activeCategory;
        }

        return null;
      }
    },
    productDocument: {
      createMany: async (args: { data: Array<Omit<ProductDocumentFixture, "id">> }) => {
        calls.productDocumentCreateMany.push(args);
        for (const item of args.data) {
          const record = records.find((product) => product.id === item.productId);

          if (record) {
            record.documents.push({
              ...item,
              id: `document-${record.documents.length + 1}`
            });
          }
        }

        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { productId: string } }) => {
        calls.productDocumentDeleteMany.push(args);
        const record = records.find((product) => product.id === args.where.productId);
        const count = record?.documents.length ?? 0;

        if (record) {
          record.documents = [];
        }

        return { count };
      }
    },
    product: {
      count: async (args: unknown) => {
        calls.productCount.push(args);
        return records.length;
      },
      create: async (args: unknown) => {
        calls.productCreate.push(args);
        return productFixture({
          id: "created-product",
          name: "Created Product",
          sku: "CREATED-001",
          slug: "created-product"
        });
      },
      findFirst: async (args: ProductFindFirstArgs) => {
        calls.productFindFirst.push(args);
        return (
          records.find((record) => {
            const directMatches =
              args.where?.id === undefined && args.where?.slug === undefined
                ? true
                : (args.where.id === undefined || record.id === args.where.id) &&
                  (args.where.slug === undefined || record.slug === args.where.slug);
            const orMatches =
              args.where?.OR === undefined ||
              args.where.OR.some(
                (condition) =>
                  (condition.id === undefined || record.id === condition.id) &&
                  (condition.slug === undefined || record.slug === condition.slug)
              );
            const idMatches =
              args.where?.id === undefined || record.id === args.where.id;
            const slugMatches =
              args.where?.slug === undefined || record.slug === args.where.slug;

            return (
              directMatches &&
              orMatches &&
              idMatches &&
              slugMatches &&
              record.deletedAt === null
            );
          }) ?? null
        );
      },
      findMany: async (args: unknown) => {
        calls.productFindMany.push(args);
        return records;
      },
      update: async (args: {
        data?: Record<string, unknown>;
        where: { id: string };
      }) => {
        calls.productUpdate.push(args);
        const existing = records.find((record) => record.id === args.where.id);

        if (!existing) {
          throw new Error("Mock product not found.");
        }

        const scalarData = Object.fromEntries(
          Object.entries(args.data ?? {}).filter(
            ([key]) => !["documents", "images", "variants"].includes(key)
          )
        );

        return {
          ...existing,
          ...scalarData,
          updatedAt: now
        };
      }
    },
    productImage: {
      createMany: async (args: { data: Array<Omit<ProductImageFixture, "id">> }) => {
        calls.productImageCreateMany.push(args);
        for (const item of args.data) {
          const record = records.find((product) => product.id === item.productId);

          if (record) {
            record.images.push({
              ...item,
              id: `image-${record.images.length + 1}`
            });
          }
        }

        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { productId: string } }) => {
        calls.productImageDeleteMany.push(args);
        const record = records.find((product) => product.id === args.where.productId);
        const count = record?.images.length ?? 0;

        if (record) {
          record.images = [];
        }

        return { count };
      }
    },
    productVariant: {
      createMany: async (args: { data: Array<Omit<ProductVariantFixture, "deletedAt" | "id">> }) => {
        calls.productVariantCreateMany.push(args);
        for (const item of args.data) {
          const record = records.find((product) => product.id === item.productId);

          if (record) {
            record.variants.push({
              ...item,
              deletedAt: null,
              id: `variant-${record.variants.length + 1}`,
              mrp: String(item.mrp),
              sellingPrice: String(item.sellingPrice)
            });
          }
        }

        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { productId: string } }) => {
        calls.productVariantDeleteMany.push(args);
        const record = records.find((product) => product.id === args.where.productId);
        const count = record?.variants.length ?? 0;

        if (record) {
          record.variants = [];
        }

        return { count };
      }
    }
  };

  return mock as unknown as ProductPrismaMock;
}

test("listPublicProducts applies search, filters, sorting, and pagination", async () => {
  const prisma = createProductPrismaMock([productFixture()]);
  const service = new ProductsService(prisma);

  const result = await service.listPublicProducts({
    brand: "abbott",
    category: "dental",
    disposable: false,
    expirySensitive: false,
    inStock: true,
    limit: 10,
    maxPrice: 500,
    medicalSpecialty: "general surgery",
    minPrice: 100,
    page: 2,
    search: "forceps",
    sort: "price_low_to_high",
    sterile: true,
    subcategory: "endodontics"
  } as Parameters<ProductsService["listPublicProducts"]>[0] & {
    subcategory: string;
  });

  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.limit, 10);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.items[0]?.slug, "curved-artery-forceps");
  assert.equal(result.items[0]?.inStock, true);
  assert.equal(result.items[0]?.sellingPrice, 120);
  assert.equal(
    (result.items[0] as { subcategory?: { slug: string } } | undefined)?.subcategory
      ?.slug,
    "endodontics"
  );

  assert.deepEqual(prisma.calls.productFindMany[0], {
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
    },
    orderBy: [{ sellingPrice: "asc" }, { id: "asc" }],
    skip: 10,
    take: 10,
    where: {
      OR: [
        { name: { contains: "forceps", mode: "insensitive" } },
        { sku: { contains: "forceps", mode: "insensitive" } },
        { medicalSpecialty: { contains: "forceps", mode: "insensitive" } },
        { searchTags: { has: "forceps" } },
        {
          brand: {
            OR: [
              { name: { contains: "forceps", mode: "insensitive" } },
              { slug: { contains: "forceps", mode: "insensitive" } }
            ]
          }
        },
        {
          category: {
            OR: [
              { name: { contains: "forceps", mode: "insensitive" } },
              { slug: { contains: "forceps", mode: "insensitive" } }
            ]
          }
        },
        {
          subcategory: {
            OR: [
              { name: { contains: "forceps", mode: "insensitive" } },
              { slug: { contains: "forceps", mode: "insensitive" } }
            ]
          }
        }
      ],
      brand: {
        deletedAt: null,
          OR: [{ id: "abbott" }, { slug: "abbott" }]
      },
      category: {
        deletedAt: null,
          OR: [{ id: "dental" }, { slug: "dental" }]
      },
      deletedAt: null,
      disposable: false,
      expirySensitive: false,
      inventoryStocks: {
        some: {
          availableQuantity: {
            gt: 0
          },
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      medicalSpecialty: {
        contains: "general surgery",
        mode: "insensitive"
      },
      sellingPrice: {
        gte: 100,
        lte: 500
      },
      status: {
        in: ["ACTIVE", "OUT_OF_STOCK"]
      },
      sterile: true,
      subcategory: {
        deletedAt: null,
        OR: [{ id: "endodontics" }, { slug: "endodontics" }]
      }
    }
  });
  assert.deepEqual(prisma.calls.productCount[0], {
    where: (prisma.calls.productFindMany[0] as { where: unknown }).where
  });
});

test("getPublicProductBySlug accepts public product ids from detail links", async () => {
  const product = productFixture({
    id: "product-id-link",
    slug: "curved-artery-forceps"
  });
  const prisma = createProductPrismaMock([product]);
  const service = new ProductsService(prisma);

  const result = await service.getPublicProductBySlug("product-id-link");

  assert.equal(result.id, "product-id-link");
  assert.equal(result.slug, "curved-artery-forceps");
  assert.deepEqual(prisma.calls.productFindFirst[0], {
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
    },
    where: {
      deletedAt: null,
      OR: [{ slug: "product-id-link" }, { id: "product-id-link" }],
      status: {
        in: ["ACTIVE", "OUT_OF_STOCK"]
      }
    }
  });
});

test("getPublicProductBySlug rejects inactive public products", async () => {
  const inactiveProduct = productFixture({
    id: "inactive-product",
    slug: "inactive-product",
    status: "INACTIVE"
  });
  const prisma = createProductPrismaMock([inactiveProduct]);
  const service = new ProductsService(prisma);

  await assert.rejects(
    () => service.getPublicProductBySlug("inactive-product"),
    NotFoundException
  );
});
test("getSimilarProductsBySlug returns same-subcategory products before broader category matches", async () => {
  const current = productFixture({
    id: "current-product",
    slug: "current-product"
  });
  const sameSubcategory = productFixture({
    id: "same-subcategory",
    name: "Same Subcategory Forceps",
    sku: "SAME-SUB-001",
    slug: "same-subcategory-forceps"
  });
  const siblingSubcategory: RelatedFixture = {
    deletedAt: null,
    id: "subcategory-2",
    isActive: true,
    name: "Restoratives",
    parentId: activeCategory.id,
    slug: "restoratives"
  };
  const sameCategory = productFixture({
    id: "same-category",
    name: "Same Category Instrument",
    sku: "SAME-CAT-001",
    slug: "same-category-instrument",
    subcategory: siblingSubcategory,
    subcategoryId: siblingSubcategory.id
  });
  const otherCategory = productFixture({
    category: {
      deletedAt: null,
      id: "category-2",
      isActive: true,
      name: "Equipment",
      parentId: null,
      slug: "equipment"
    },
    categoryId: "category-2",
    id: "other-category",
    name: "Other Category Product",
    sku: "OTHER-CAT-001",
    slug: "other-category-product",
    subcategory: null,
    subcategoryId: null
  });
  const prisma = createProductPrismaMock([
    current,
    sameCategory,
    otherCategory,
    sameSubcategory
  ]);
  const service = new ProductsService(prisma);

  const result = await service.getSimilarProductsBySlug("current-product", {
    limit: 2
  });

  assert.deepEqual(
    result.items.map((item) => item.slug),
    ["same-subcategory-forceps", "same-category-instrument"]
  );
  assert.equal(result.pagination.total, 2);
  assert.deepEqual(prisma.calls.productFindMany[0], {
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 12,
    where: {
      deletedAt: null,
      id: {
        not: "current-product"
      },
      OR: [
        { subcategoryId: activeSubcategory.id },
        { categoryId: activeCategory.id }
      ],
      status: {
        in: ["ACTIVE", "OUT_OF_STOCK"]
      }
    }
  });
});

test("getRelatedProductsBySlug ranks tag and attribute matches ahead of loose brand matches", async () => {
  const current = productFixture({
    id: "current-product",
    material: "Stainless steel",
    medicalSpecialty: "General Surgery",
    packSize: "Box of 10",
    searchTags: ["forceps", "artery", "clamp"],
    slug: "current-product",
    sterile: true,
    unit: "box"
  });
  const tagMatch = productFixture({
    brand: {
      deletedAt: null,
      id: "brand-2",
      isActive: true,
      name: "Healthium",
      slug: "healthium"
    },
    brandId: "brand-2",
    id: "tag-match",
    name: "Tagged Artery Clamp",
    searchTags: ["artery", "clamp", "hemostat"],
    sku: "TAG-MATCH-001",
    slug: "tagged-artery-clamp"
  });
  const brandMatch = productFixture({
    id: "brand-match",
    name: "Brand Matched Instrument",
    searchTags: ["instrument"],
    sku: "BRAND-MATCH-001",
    slug: "brand-matched-instrument"
  });
  const unrelated = productFixture({
    brand: {
      deletedAt: null,
      id: "brand-3",
      isActive: true,
      name: "Contec",
      slug: "contec"
    },
    brandId: "brand-3",
    category: {
      deletedAt: null,
      id: "category-3",
      isActive: true,
      name: "Diagnostics",
      parentId: null,
      slug: "diagnostics"
    },
    categoryId: "category-3",
    id: "unrelated",
    medicalSpecialty: "Vitals Monitoring",
    name: "Unrelated Monitor",
    searchTags: ["monitor"],
    sku: "UNRELATED-001",
    slug: "unrelated-monitor",
    sterile: false,
    subcategory: null,
    subcategoryId: null
  });
  const prisma = createProductPrismaMock([
    current,
    brandMatch,
    unrelated,
    tagMatch
  ]);
  const service = new ProductsService(prisma);

  const result = await service.getRelatedProductsBySlug("current-product", {
    limit: 2
  });

  assert.deepEqual(
    result.items.map((item) => item.slug),
    ["tagged-artery-clamp", "brand-matched-instrument"]
  );
  assert.equal(result.pagination.total, 2);
  assert.deepEqual(prisma.calls.productFindMany[0], {
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 12,
    where: {
      deletedAt: null,
      id: {
        not: "current-product"
      },
      OR: [
        { searchTags: { hasSome: ["forceps", "artery", "clamp"] } },
        { medicalSpecialty: "General Surgery" },
        { brandId: activeBrand.id },
        { categoryId: activeCategory.id },
        { subcategoryId: activeSubcategory.id },
        { material: "Stainless steel" },
        { packSize: "Box of 10" },
        { unit: "box" },
        { sterile: true },
        { disposable: false },
        { expirySensitive: false }
      ],
      status: {
        in: ["ACTIVE", "OUT_OF_STOCK"]
      }
    }
  });
});

test("createProduct validates brand and category and persists nested catalogue data", async () => {
  const prisma = createProductPrismaMock([]);
  const service = new ProductsService(prisma);

  await service.createProduct(
    {
      basePrice: 100,
      brandId: activeBrand.id,
      categoryId: activeCategory.id,
      description:
        '<h2>Clinical use</h2><p><strong>Reusable</strong> artery forceps.</p><script>alert("xss")</script>',
      disposable: false,
      documents: [
        {
          fileKey: "products/forceps/compliance.pdf",
          fileUrl: "https://cdn.example.com/products/forceps/compliance.pdf",
          title: "Compliance Document",
          type: "COMPLIANCE"
        }
      ],
      expirySensitive: false,
      images: [
        {
          altText: "Curved artery forceps",
          isPrimary: true,
          sortOrder: 1,
          url: "https://cdn.example.com/products/forceps/main.jpg"
        }
      ],
      medicalSpecialty: "General Surgery",
      mrp: 150,
      name: "Curved Artery Forceps",
      searchTags: ["Forceps", "artery", "forceps"],
      sellingPrice: 120,
      shortDescription: "Curved artery forceps.",
      sku: "FORCEPS-001",
      slug: "curved-artery-forceps",
      status: "ACTIVE",
      sterile: true,
      subcategoryId: activeSubcategory.id,
      taxRate: 18,
      unit: "piece",
      variants: [
        {
          attributes: {
            size: "6 inch"
          },
          mrp: 175,
          name: "6 inch",
          sellingPrice: 140,
          sku: "FORCEPS-001-6IN",
          status: "ACTIVE"
        }
      ]
    } as Parameters<ProductsService["createProduct"]>[0] & {
      subcategoryId: string;
    },
    adminContext
  );

  assert.deepEqual(prisma.calls.brandFindFirst[0], {
    where: {
      deletedAt: null,
      id: activeBrand.id,
      slug: {
        in: [
          "mb-plus",
          "abbott",
          "contec",
          "volk",
          "orikam",
          "healthium",
          "gc",
          "j-mitra"
        ]
      }
    }
  });
  assert.deepEqual(prisma.calls.categoryFindFirst[0], {
    where: {
      deletedAt: null,
      id: activeCategory.id,
      parentId: null,
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
  });
  assert.deepEqual(prisma.calls.categoryFindFirst[1], {
    where: {
      deletedAt: null,
      id: activeSubcategory.id,
      parentId: activeCategory.id
    }
  });
  assert.deepEqual(prisma.calls.productCreate[0], {
    data: {
      basePrice: 100,
      brandId: activeBrand.id,
      categoryId: activeCategory.id,
      description:
        "<h2>Clinical use</h2><p><strong>Reusable</strong> artery forceps.</p>",
      disposable: false,
      documents: {
        create: [
          {
            fileKey: "products/forceps/compliance.pdf",
            fileUrl: "https://cdn.example.com/products/forceps/compliance.pdf",
            title: "Compliance Document",
            type: "COMPLIANCE"
          }
        ]
      },
      expirySensitive: false,
      images: {
        create: [
          {
            altText: "Curved artery forceps",
            isPrimary: true,
            sortOrder: 1,
            url: "https://cdn.example.com/products/forceps/main.jpg"
          }
        ]
      },
      material: null,
      medicalSpecialty: "General Surgery",
      metaDescription: null,
      metaTitle: null,
      mrp: 150,
      name: "Curved Artery Forceps",
      packSize: null,
      searchTags: ["forceps", "artery"],
      sellingPrice: 120,
      shortDescription: "Curved artery forceps.",
      sku: "FORCEPS-001",
      slug: "curved-artery-forceps",
      status: "ACTIVE",
      sterile: true,
      subcategoryId: activeSubcategory.id,
      taxRate: 18,
      unit: "piece",
      variants: {
        create: [
          {
            attributes: {
              size: "6 inch"
            },
            mrp: 175,
            name: "6 inch",
            sellingPrice: 140,
            sku: "FORCEPS-001-6IN",
            status: "ACTIVE"
          }
        ]
      }
    },
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
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
      ipAddress: string;
      userAgent: string;
    };
  };
  assert.equal(auditCall.data.action, "product.create");
  assert.equal(auditCall.data.adminUserId, "admin-1");
  assert.equal(auditCall.data.after.id, "created-product");
  assert.equal(auditCall.data.entityId, "created-product");
  assert.equal(auditCall.data.entityType, "Product");
  assert.equal(auditCall.data.ipAddress, "10.0.0.1");
  assert.equal(auditCall.data.userAgent, "node-test-agent");
});

test("updateProduct replaces only nested collections that are provided", async () => {
  const product = productFixture();
  const prisma = createProductPrismaMock([product]);
  const service = new ProductsService(prisma);

  await service.updateProduct(
    product.id,
    {
      images: [
        {
          altText: "Updated forceps image",
          isPrimary: true,
          sortOrder: 0,
          url: "https://cdn.example.com/products/forceps/updated.jpg"
        }
      ],
      name: "Updated Forceps",
      variants: [
        {
          attributes: {
            size: "8 inch"
          },
          mrp: 190,
          name: "8 inch",
          sellingPrice: 150,
          sku: "FORCEPS-001-8IN",
          status: "ACTIVE"
        }
      ]
    },
    adminContext
  );

  assert.deepEqual(prisma.calls.productImageDeleteMany[0], {
    where: {
      productId: product.id
    }
  });
  assert.deepEqual(prisma.calls.productImageCreateMany[0], {
    data: [
      {
        altText: "Updated forceps image",
        isPrimary: true,
        productId: product.id,
        sortOrder: 0,
        url: "https://cdn.example.com/products/forceps/updated.jpg"
      }
    ]
  });
  assert.deepEqual(prisma.calls.productVariantDeleteMany[0], {
    where: {
      productId: product.id
    }
  });
  assert.deepEqual(prisma.calls.productVariantCreateMany[0], {
    data: [
      {
        attributes: {
          size: "8 inch"
        },
        mrp: 190,
        name: "8 inch",
        productId: product.id,
        sellingPrice: 150,
        sku: "FORCEPS-001-8IN",
        status: "ACTIVE"
      }
    ]
  });
  assert.deepEqual(prisma.calls.productUpdate[0], {
    data: {
      name: "Updated Forceps"
    },
    include: {
      brand: true,
      category: true,
      subcategory: true,
      documents: {
        orderBy: [{ type: "asc" }, { title: "asc" }]
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      inventoryStocks: {
        select: {
          availableQuantity: true,
          reservedQuantity: true
        },
        where: {
          warehouse: {
            deletedAt: null,
            status: "ACTIVE"
          }
        }
      },
      variants: {
        orderBy: [{ name: "asc" }],
        where: {
          deletedAt: null
        }
      }
    },
    where: {
      id: product.id
    }
  });
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
  assert.equal(auditCall.data.action, "product.update");
  assert.equal(auditCall.data.before.id, product.id);
  assert.equal(auditCall.data.before.name, "Curved Artery Forceps");
  assert.equal(auditCall.data.after.id, product.id);
  assert.equal(auditCall.data.after.name, "Updated Forceps");
  assert.equal(auditCall.data.entityId, product.id);
  assert.equal(auditCall.data.entityType, "Product");
});

test("deleteProduct soft deletes and deactivates products and variants", async () => {
  const product = productFixture();
  const prisma = createProductPrismaMock([product]);
  const service = new ProductsService(prisma);

  await service.deleteProduct(product.id, adminContext);

  const updateCall = prisma.calls.productUpdate[0] as {
    data: {
      deletedAt: unknown;
      status: ProductStatusFixture;
      variants: {
        updateMany: {
          data: {
            deletedAt: unknown;
            status: ProductStatusFixture;
          };
          where: {
            deletedAt: null;
          };
        };
      };
    };
    where: { id: string };
  };

  assert.equal(updateCall.data.deletedAt instanceof Date, true);
  assert.deepEqual(updateCall, {
    data: {
      deletedAt: updateCall.data.deletedAt,
      status: "INACTIVE",
      variants: {
        updateMany: {
          data: {
            deletedAt: updateCall.data.variants.updateMany.data.deletedAt,
            status: "INACTIVE"
          },
          where: {
            deletedAt: null
          }
        }
      }
    },
    where: {
      id: product.id
    }
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
  const auditCall = prisma.calls.adminAuditLogCreate[0] as {
    data: {
      action: string;
      after: { id: string; status: ProductStatusFixture };
      before: { id: string; status: ProductStatusFixture };
      entityId: string;
      entityType: string;
    };
  };
  assert.equal(auditCall.data.action, "product.delete");
  assert.equal(auditCall.data.before.id, product.id);
  assert.equal(auditCall.data.before.status, "ACTIVE");
  assert.equal(auditCall.data.after.id, product.id);
  assert.equal(auditCall.data.after.status, "INACTIVE");
  assert.equal(auditCall.data.entityId, product.id);
  assert.equal(auditCall.data.entityType, "Product");
});

test("admin product controller methods declare product permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminProductsController.prototype.createProduct
    ),
    [PermissionCode.ProductsCreate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminProductsController.prototype.listProducts
    ),
    [PermissionCode.ProductsRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminProductsController.prototype.getProduct
    ),
    [PermissionCode.ProductsRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminProductsController.prototype.updateProduct
    ),
    [PermissionCode.ProductsUpdate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminProductsController.prototype.deleteProduct
    ),
    [PermissionCode.ProductsDelete]
  );
});
