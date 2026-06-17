import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { WishlistService } from "../../src/modules/wishlist/wishlist.service";

const now = new Date("2026-06-15T10:00:00.000Z");

function createWishlistPrismaMock(input?: { productExists?: boolean }) {
  const logs: Array<{
    channel: string;
    createdAt: Date;
    id: string;
    recipient: string;
    status: string;
    templateKey: string;
    updatedAt: Date;
    userId: string;
  }> = [];
  const calls: Record<string, unknown[]> = {
    findFirstLog: [],
    findFirstProduct: [],
    findManyLog: [],
    createLog: [],
    updateLog: [],
    updateManyLog: []
  };

  return {
    calls,
    notificationLog: {
      create: async (args: {
        data: {
          channel: string;
          recipient: string;
          status: string;
          templateKey: string;
          userId: string;
        };
      }) => {
        calls.createLog.push(args);
        const record = {
          ...args.data,
          createdAt: now,
          id: `wishlist-${logs.length + 1}`,
          updatedAt: now
        };
        logs.push(record);
        return record;
      },
      findFirst: async (args: {
        where: {
          channel: string;
          recipient: string;
          templateKey: string;
          userId: string;
        };
      }) => {
        calls.findFirstLog.push(args);
        return (
          logs.find(
            (log) =>
              log.channel === args.where.channel &&
              log.recipient === args.where.recipient &&
              log.templateKey === args.where.templateKey &&
              log.userId === args.where.userId
          ) ?? null
        );
      },
      findMany: async (args: { where: { status: string; userId: string } }) => {
        calls.findManyLog.push(args);
        return logs.filter(
          (log) =>
            log.status === args.where.status && log.userId === args.where.userId
        );
      },
      update: async (args: { data: { status: string }; where: { id: string } }) => {
        calls.updateLog.push(args);
        const record = logs.find((log) => log.id === args.where.id);

        if (!record) {
          throw new Error("Wishlist log not found.");
        }

        record.status = args.data.status;
        record.updatedAt = now;
        return record;
      },
      updateMany: async (args: {
        data: { status: string };
        where: { recipient: string; status: string; userId: string };
      }) => {
        calls.updateManyLog.push(args);
        let count = 0;

        for (const log of logs) {
          if (
            log.recipient === args.where.recipient &&
            log.status === args.where.status &&
            log.userId === args.where.userId
          ) {
            log.status = args.data.status;
            count += 1;
          }
        }

        return { count };
      }
    },
    product: {
      findFirst: async (args: unknown) => {
        calls.findFirstProduct.push(args);
        return input?.productExists === false
          ? null
          : {
              deletedAt: null,
              id: "product-1",
              status: "ACTIVE"
            };
      }
    }
  };
}

function createProductsServiceMock() {
  const calls: string[][] = [];

  return {
    calls,
    getPublicProductsByIds: async (ids: string[]) => {
      calls.push(ids);
      return {
        items: ids.map((id) => ({ id, name: `Product ${id}` })),
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          limit: ids.length,
          page: 1,
          total: ids.length,
          totalPages: ids.length > 0 ? 1 : 0
        }
      };
    }
  };
}

test("wishlist saves, resurfaces, and removes customer products", async () => {
  const prisma = createWishlistPrismaMock();
  const productsService = createProductsServiceMock();
  const service = new WishlistService(
    prisma as unknown as PrismaService,
    productsService as never
  );

  const added = await service.addWishlistItem("customer-1", "product-1");

  assert.deepEqual(
    added.items.map((item) => item.id),
    ["product-1"]
  );
  assert.equal(prisma.calls.createLog.length, 1);
  assert.deepEqual(productsService.calls.at(-1), ["product-1"]);

  const removed = await service.removeWishlistItem("customer-1", "product-1");

  assert.deepEqual(removed.items, []);
  assert.equal(prisma.calls.updateManyLog.length, 1);
  assert.deepEqual(productsService.calls.at(-1), []);

  const resaved = await service.addWishlistItem("customer-1", "product-1");

  assert.deepEqual(
    resaved.items.map((item) => item.id),
    ["product-1"]
  );
  assert.equal(prisma.calls.createLog.length, 1);
  assert.equal(prisma.calls.updateLog.length, 1);
});

test("wishlist rejects products that are not public", async () => {
  const prisma = createWishlistPrismaMock({ productExists: false });
  const productsService = createProductsServiceMock();
  const service = new WishlistService(
    prisma as unknown as PrismaService,
    productsService as never
  );

  await assert.rejects(
    () => service.addWishlistItem("customer-1", "missing-product"),
    NotFoundException
  );
  assert.equal(productsService.calls.length, 0);
});
