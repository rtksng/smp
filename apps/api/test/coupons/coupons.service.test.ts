import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { CouponsService } from "../../src/modules/coupons/coupons.service";

const now = new Date("2026-06-01T10:00:00.000Z");

function createCouponsPrismaMock(input?: {
  cartEmpty?: boolean;
  coupon?: Record<string, unknown> | null;
}) {
  const defaultCoupon =
    input?.coupon === undefined
      ? {
          code: "SURGICAL10",
          createdAt: now,
          deletedAt: null,
          expiresAt: new Date("2026-12-31T23:59:59.999Z"),
          id: "coupon-1",
          isActive: true,
          maxDiscount: "40.00",
          minOrderAmount: "200.00",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          type: "PERCENTAGE",
          updatedAt: now,
          usageLimit: 100,
          usedCount: 0,
          value: "10.00"
        }
      : input.coupon;
  const coupons = defaultCoupon ? [defaultCoupon] : [];
  const cart = {
    id: "cart-1",
    items: input?.cartEmpty
      ? []
      : [
          {
            product: {
              deletedAt: null,
              sellingPrice: "500.00",
              status: "ACTIVE",
              taxRate: "18.00"
            },
            quantity: 2,
            variant: null,
            variantId: null
          }
        ]
  };
  const calls: Record<string, unknown[]> = {
    cartFindFirst: [],
    couponCount: [],
    couponCreate: [],
    couponFindFirst: [],
    couponFindMany: [],
    couponUpdate: []
  };

  return {
    calls,
    records: {
      coupons
    },
    cart: {
      findFirst: async (args: unknown) => {
        calls.cartFindFirst.push(args);
        return cart;
      }
    },
    coupon: {
      count: async (args: unknown) => {
        calls.couponCount.push(args);
        return coupons.length;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.couponCreate.push(args);
        const record = {
          createdAt: now,
          deletedAt: null,
          id: `coupon-${coupons.length + 1}`,
          updatedAt: now,
          usedCount: 0,
          ...args.data
        };
        coupons.push(record);
        return record;
      },
      findFirst: async (args: unknown) => {
        calls.couponFindFirst.push(args);
        const where = (args as { where?: { code?: { equals?: string }; id?: string } })
          .where;

        if (where?.id) {
          return coupons.find((candidate) => candidate.id === where.id) ?? null;
        }

        if (where?.code?.equals) {
          return (
            coupons.find(
              (candidate) =>
                String(candidate.code).toLowerCase() ===
                String(where.code?.equals).toLowerCase()
            ) ?? null
          );
        }

        return coupons[0] ?? null;
      },
      findMany: async (args: unknown) => {
        calls.couponFindMany.push(args);
        return coupons.filter((coupon) => coupon.deletedAt === null);
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.couponUpdate.push(args);
        const record = coupons.find((coupon) => coupon.id === args.where.id);

        if (!record) {
          throw new Error("Coupon not found.");
        }

        Object.assign(record, args.data, { updatedAt: now });
        return record;
      }
    }
  };
}

test("validateForCustomerCart previews a coupon discount against live cart totals", async () => {
  const prisma = createCouponsPrismaMock();
  const service = new CouponsService(prisma as unknown as PrismaService);

  const result = await service.validateForCustomerCart("customer-1", {
    code: " surgical10 "
  });

  assert.deepEqual(result, {
    code: "SURGICAL10",
    discount: 40,
    grandTotal: 1140,
    message: "Coupon applied.",
    subtotal: 1000,
    tax: 180
  });
  assert.equal(prisma.calls.couponFindFirst.length, 1);
  assert.equal(prisma.calls.cartFindFirst.length, 1);
});

test("validateForCustomerCart rejects missing coupons and empty carts", async () => {
  const missingCouponPrisma = createCouponsPrismaMock({ coupon: null });
  const emptyCartPrisma = createCouponsPrismaMock({ cartEmpty: true });

  await assert.rejects(
    () =>
      new CouponsService(
        missingCouponPrisma as unknown as PrismaService
      ).validateForCustomerCart("customer-1", { code: "NOPE" }),
    NotFoundException
  );
  await assert.rejects(
    () =>
      new CouponsService(
        emptyCartPrisma as unknown as PrismaService
      ).validateForCustomerCart("customer-1", { code: "SURGICAL10" }),
    BadRequestException
  );
});

test("admin coupon management creates, updates, lists, and soft deletes coupons", async () => {
  const prisma = createCouponsPrismaMock({ coupon: null });
  const service = new CouponsService(prisma as unknown as PrismaService);

  const created = await service.createAdminCoupon({
    code: " surgical10 ",
    expiresAt: "2026-12-31T23:59:59.999Z",
    isActive: true,
    maxDiscount: 300,
    minOrderAmount: 1000,
    startsAt: "2026-06-01T00:00:00.000Z",
    type: "PERCENTAGE",
    usageLimit: 50,
    value: 10
  });

  assert.equal(created.code, "SURGICAL10");
  assert.equal(created.type, "PERCENTAGE");
  assert.equal(created.value, 10);
  assert.equal(created.minOrderAmount, 1000);
  assert.equal(created.maxDiscount, 300);
  assert.equal(created.usageLimit, 50);
  assert.equal(created.isActive, true);

  const updated = await service.updateAdminCoupon(created.id, {
    isActive: false,
    maxDiscount: null,
    usageLimit: null,
    value: 12
  });

  assert.equal(updated.value, 12);
  assert.equal(updated.maxDiscount, null);
  assert.equal(updated.usageLimit, null);
  assert.equal(updated.isActive, false);

  const listed = await service.listAdminCoupons({ search: "surg" });

  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0]?.code, "SURGICAL10");

  await service.deleteAdminCoupon(created.id);

  assert.notEqual(prisma.records.coupons[0]?.deletedAt, null);
  assert.equal(prisma.calls.couponCreate.length, 1);
  assert.equal(prisma.calls.couponUpdate.length, 2);
});
