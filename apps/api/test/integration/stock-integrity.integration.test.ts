import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../src/database/prisma.service";

// Checks the database-level stock rules from migration
// 20261020000100_stock_integrity against a real, migrated PostgreSQL database.
const databaseUrl = process.env.DATABASE_TEST_URL;
const skip = databaseUrl ? false : "Set DATABASE_TEST_URL to a migrated test database.";

let prisma: PrismaService;
const created = { brandIds: [] as string[], categoryIds: [] as string[], productIds: [] as string[], warehouseIds: [] as string[] };

async function productInWarehouse() {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({ data: { name: `Stock test ${suffix}`, slug: `stock-test-${suffix}` } });
  const brand = await prisma.brand.create({ data: { name: `Stock brand ${suffix}`, slug: `stock-brand-${suffix}` } });
  const product = await prisma.product.create({
    data: {
      basePrice: "100.00",
      brandId: brand.id,
      categoryId: category.id,
      description: "Stock integrity test product",
      mrp: "120.00",
      name: `Stock product ${suffix}`,
      sellingPrice: "110.00",
      shortDescription: "Test",
      sku: `STOCK-${suffix}`,
      slug: `stock-product-${suffix}`,
      taxRate: "0.00",
      unit: "piece"
    }
  });
  const warehouse = await prisma.warehouse.create({
    data: {
      address: "Test road",
      city: "Delhi",
      code: `ST${suffix}`,
      contactNumber: "9999999999",
      contactPerson: "Tester",
      name: `Stock warehouse ${suffix}`,
      pincode: "110001",
      state: "Delhi"
    }
  });
  created.brandIds.push(brand.id);
  created.categoryIds.push(category.id);
  created.productIds.push(product.id);
  created.warehouseIds.push(warehouse.id);

  return { productId: product.id, warehouseId: warehouse.id };
}

before(async () => {
  if (!databaseUrl) return;
  prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
  await prisma.$connect();
});

after(async () => {
  if (!databaseUrl) return;
  await prisma.stockBatch.deleteMany({ where: { productId: { in: created.productIds } } });
  await prisma.inventoryStock.deleteMany({ where: { productId: { in: created.productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
  await prisma.warehouse.deleteMany({ where: { id: { in: created.warehouseIds } } });
  await prisma.brand.deleteMany({ where: { id: { in: created.brandIds } } });
  await prisma.category.deleteMany({ where: { id: { in: created.categoryIds } } });
  await prisma.$disconnect();
});

test("a product without variants gets only one stock row per warehouse", { skip }, async () => {
  const { productId, warehouseId } = await productInWarehouse();

  await prisma.inventoryStock.create({ data: { availableQuantity: 5, productId, warehouseId } });

  await assert.rejects(() =>
    prisma.inventoryStock.create({ data: { availableQuantity: 3, productId, warehouseId } })
  );
});

test("stock and batch quantities cannot go below zero", { skip }, async () => {
  const { productId, warehouseId } = await productInWarehouse();
  const stock = await prisma.inventoryStock.create({ data: { availableQuantity: 2, productId, warehouseId } });
  const batch = await prisma.stockBatch.create({
    data: { batchNumber: "B-1", mrp: "120.00", productId, purchasePrice: "80.00", quantity: 2, sellingPrice: "110.00", warehouseId }
  });

  await assert.rejects(() =>
    prisma.inventoryStock.update({ data: { availableQuantity: { decrement: 3 } }, where: { id: stock.id } })
  );
  await assert.rejects(() =>
    prisma.inventoryStock.update({ data: { reservedQuantity: { decrement: 1 } }, where: { id: stock.id } })
  );
  await assert.rejects(() =>
    prisma.stockBatch.update({ data: { quantity: { decrement: 3 } }, where: { id: batch.id } })
  );
});

test("a batch number is unique per product and warehouse without variants", { skip }, async () => {
  const { productId, warehouseId } = await productInWarehouse();
  const batch = { batchNumber: "B-DUP", mrp: "120.00", productId, purchasePrice: "80.00", quantity: 1, sellingPrice: "110.00", warehouseId };

  await prisma.stockBatch.create({ data: batch });

  await assert.rejects(() => prisma.stockBatch.create({ data: batch }));
});
