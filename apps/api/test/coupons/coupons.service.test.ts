import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { PrismaService } from "../../src/database/prisma.service";
import { CustomerJwtGuard } from "../../src/modules/auth/guards/customer-jwt.guard";
import { CouponsController } from "../../src/modules/coupons/coupons.controller";
import { CouponsService } from "../../src/modules/coupons/coupons.service";
import { CreateCouponDto, UpdateCouponDto } from "../../src/modules/coupons/dto/coupon.dto";

const now = new Date("2026-06-01T10:00:00.000Z");

function matchesCouponWhere(record: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, filter]) => {
    if (key === "AND" || key === "OR") {
      const matches = (filter as Record<string, unknown>[]).map((part) => matchesCouponWhere(record, part));
      return key === "AND" ? matches.every(Boolean) : matches.some(Boolean);
    }
    const actual = record[key];
    if (filter === null || typeof filter !== "object" || filter instanceof Date) {
      return actual === filter;
    }
    return Object.entries(filter).every(([operator, value]) => {
      const expected = value && typeof value === "object" && "name" in value
        ? record[String(value.name)]
        : value;
      if (operator === "mode") return true;
      if (operator === "contains") return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      if (actual === null || expected === null) return false;
      const left = Number(actual);
      const right = Number(expected);
      if (operator === "lt") return left < right;
      if (operator === "lte") return left <= right;
      if (operator === "gte") return left >= right;
      throw new Error(`Unsupported coupon test filter: ${operator}`);
    });
  });
}

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
          expiresAt: null,
          id: "coupon-1",
          isActive: true,
          maxDiscount: "40.00",
          minOrderAmount: "200.00",
          startsAt: null,
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
      cart,
      coupons
    },
    cart: {
      findFirst: async (args: unknown) => {
        calls.cartFindFirst.push(args);
        return cart;
      }
    },
    coupon: {
      fields: { usageLimit: { modelName: "Coupon", name: "usageLimit" } },
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
          ...args.data,
          maxDiscount: args.data.maxDiscount ?? null,
          minOrderAmount: args.data.minOrderAmount ?? null,
          usageLimit: args.data.usageLimit ?? null
        };
        coupons.push(record);
        return record;
      },
      findFirst: async (args: unknown) => {
        calls.couponFindFirst.push(args);
        const where = (args as { where?: { code?: { equals?: string }; deletedAt?: null; id?: string } })
          .where;
        const eligible = coupons.filter(
          (candidate) => where?.deletedAt !== null || candidate.deletedAt === null
        );

        if (where?.id) {
          return eligible.find((candidate) => candidate.id === where.id) ?? null;
        }

        if (where?.code?.equals) {
          return (
            eligible.find(
              (candidate) =>
                String(candidate.code).toLowerCase() ===
                String(where.code?.equals).toLowerCase()
            ) ?? null
          );
        }

        return eligible[0] ?? null;
      },
      findMany: async (args: unknown) => {
        calls.couponFindMany.push(args);
        const query = args as {
          orderBy?: Array<{ code?: string }>;
          take?: number;
          where?: Record<string, unknown>;
        };
        const rows = coupons.filter((coupon) => matchesCouponWhere(coupon, query.where ?? {}));
        if (query.orderBy?.some((field) => field.code)) {
          rows.sort((left, right) => String(left.code).localeCompare(String(right.code)));
        }
        return rows.slice(0, query.take);
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

test("customer coupon preview uses percentage fractions, fixed amounts, and subtotal caps", async () => {
  for (const scenario of [
    { type: "PERCENTAGE" as const, value: 7.5, maxDiscount: null, expected: 75 },
    { type: "PERCENTAGE" as const, value: 10, maxDiscount: 40, expected: 40 },
    { type: "FIXED_AMOUNT" as const, value: 150, maxDiscount: null, expected: 150 },
    { type: "FIXED_AMOUNT" as const, value: 1500, maxDiscount: null, expected: 1000 }
  ]) {
    const prisma = createCouponsPrismaMock({ coupon: null });
    const service = new CouponsService(prisma as unknown as PrismaService);
    await service.createAdminCoupon({
      code: "CHECKOUT",
      isActive: true,
      minOrderAmount: 1000,
      usageLimit: 2,
      ...scenario
    });

    const preview = await service.validateForCustomerCart("customer-1", { code: "checkout" });

    assert.equal(preview.discount, scenario.expected);
    assert.equal(preview.grandTotal, 1180 - scenario.expected);
    assert.equal(prisma.records.coupons[0]?.usedCount, 0, "preview must not consume usage");
  }
});

test("customer coupon preview rejects inactive, scheduled, expired, exhausted, and below-minimum codes", async () => {
  const cases = [
    { changes: { isActive: false }, message: /not active/ },
    { changes: { startsAt: new Date(Date.now() + 86_400_000) }, message: /not active yet/ },
    { changes: { expiresAt: new Date(Date.now() - 86_400_000) }, message: /expired/ },
    { changes: { usageLimit: 1, usedCount: 1 }, message: /usage limit/ },
    { changes: { minOrderAmount: 1000.01 }, message: /minimum order subtotal/ }
  ];

  for (const scenario of cases) {
    const prisma = createCouponsPrismaMock();
    Object.assign(prisma.records.coupons[0]!, scenario.changes);
    await assert.rejects(
      () => new CouponsService(prisma as unknown as PrismaService)
        .validateForCustomerCart("customer-1", { code: "SURGICAL10" }),
      scenario.message
    );
    assert.equal(prisma.calls.couponUpdate.length, 0);
  }
});

test("customer coupon preview reads the current cart price and rejects unavailable products", async () => {
  const prisma = createCouponsPrismaMock();
  const service = new CouponsService(prisma as unknown as PrismaService);
  const item = prisma.records.cart.items[0]!;
  item.product.sellingPrice = "120.00";

  const preview = await service.validateForCustomerCart("customer-1", { code: "SURGICAL10" });
  assert.equal(preview.subtotal, 240);
  assert.equal(preview.discount, 24);
  assert.equal(preview.grandTotal, 259.2);

  item.product.status = "INACTIVE";
  await assert.rejects(
    () => service.validateForCustomerCart("customer-1", { code: "SURGICAL10" }),
    /unavailable product/
  );
});

test("archived coupons cannot be applied or reused under the same code", async () => {
  const prisma = createCouponsPrismaMock();
  const service = new CouponsService(prisma as unknown as PrismaService);
  await service.deleteAdminCoupon("coupon-1");

  await assert.rejects(
    () => service.validateForCustomerCart("customer-1", { code: "SURGICAL10" }),
    NotFoundException
  );
  await assert.rejects(
    () => service.createAdminCoupon({ code: " surgical10 ", type: "PERCENTAGE", value: 10 }),
    /already exists/
  );
});

test("admin coupon validation rejects inverted date windows and duplicate code edits", async () => {
  const prisma = createCouponsPrismaMock();
  const service = new CouponsService(prisma as unknown as PrismaService);
  await assert.rejects(
    () => service.createAdminCoupon({
      code: "INVALID",
      startsAt: "2026-07-02T00:00:00.000Z",
      expiresAt: "2026-07-01T00:00:00.000Z",
      type: "PERCENTAGE",
      value: 10
    }),
    /start date must be before expiry date/
  );
  const other = await service.createAdminCoupon({ code: "OTHER", type: "FIXED_AMOUNT", value: 50 });
  await assert.rejects(
    () => service.updateAdminCoupon(other.id, { code: " surgical10 " }),
    /already exists/
  );
  assert.equal(prisma.calls.couponUpdate.length, 0);
});

test("available coupon listing excludes inactive, scheduled, expired, archived, and exhausted coupons", async () => {
  const prisma = createCouponsPrismaMock();
  const base = prisma.records.coupons[0]!;
  const past = new Date(Date.now() - 86_400_000);
  const future = new Date(Date.now() + 86_400_000);
  const examples = [
    { code: "ACTIVE", minOrderAmount: "5000.00" },
    { code: "DATED", startsAt: past, expiresAt: future },
    { code: "UNLIMITED", usageLimit: null, usedCount: 10000 },
    { code: "INACTIVE", isActive: false },
    { code: "SCHEDULED", startsAt: future },
    { code: "EXPIRED", expiresAt: past },
    { code: "ARCHIVED", deletedAt: past },
    { code: "EXHAUSTED", usageLimit: 5, usedCount: 5 },
    { code: "OVERUSED", usageLimit: 5, usedCount: 6 }
  ];
  prisma.records.coupons.splice(0, 1, ...examples.map((changes) => ({ ...base, ...changes })));

  const result = await new CouponsService(prisma as unknown as PrismaService).listAvailableCoupons();

  assert.deepEqual(result.items.map((coupon) => coupon.code), ["ACTIVE", "DATED", "UNLIMITED"]);
  assert.deepEqual(result.items[0], {
    code: "ACTIVE",
    type: "PERCENTAGE",
    value: 10,
    minOrderAmount: 5000,
    maxDiscount: 40,
    expiresAt: null
  });
  assert.equal(result.items[1]?.expiresAt, future);
  assert.equal(prisma.calls.cartFindFirst.length, 0, "browsing offers does not require a populated cart");
  assert.equal(prisma.calls.couponUpdate.length, 0, "browsing offers does not consume usage");
  const query = prisma.calls.couponFindMany[0] as { select: Record<string, boolean> };
  assert.deepEqual(Object.keys(query.select).sort(), ["code", "expiresAt", "maxDiscount", "minOrderAmount", "type", "value"]);
});

test("available coupon listing is bounded, deterministic, and returns an empty items array when none qualify", async () => {
  const prisma = createCouponsPrismaMock();
  const base = prisma.records.coupons[0]!;
  prisma.records.coupons.splice(0, 1, ...Array.from({ length: 105 }, (_, index) => ({
    ...base,
    code: `OFFER${String(104 - index).padStart(3, "0")}`
  })));
  const service = new CouponsService(prisma as unknown as PrismaService);
  const result = await service.listAvailableCoupons();
  assert.equal(result.items.length, 100);
  assert.equal(result.items[0]?.code, "OFFER000");
  assert.equal(result.items[99]?.code, "OFFER099");
  const query = prisma.calls.couponFindMany[0] as { orderBy: unknown; take: number };
  assert.deepEqual(query.orderBy, [{ code: "asc" }, { id: "asc" }]);
  assert.equal(query.take, 100);

  for (const coupon of prisma.records.coupons) coupon.isActive = false;
  assert.deepEqual(await service.listAvailableCoupons(), { items: [] });
});

test("available coupons and coupon validation both require the customer JWT guard", () => {
  for (const handler of [CouponsController.prototype.listAvailableCoupons, CouponsController.prototype.validateCoupon]) {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, handler), [CustomerJwtGuard]);
  }
});

test("coupon DTOs and service reject database overflow and excess monetary precision", async () => {
  const invalidFields = [
    { value: 10_000_000_000 },
    { minOrderAmount: 10_000_000_000 },
    { maxDiscount: 10_000_000_000 },
    { usageLimit: 2_147_483_648 },
    { value: 12.345 },
    { minOrderAmount: 12.345 },
    { maxDiscount: 12.345 }
  ];
  for (const changes of invalidFields) {
    const createInput = { code: "INVALID", type: "PERCENTAGE" as const, value: 10, ...changes };
    assert.ok(validateSync(plainToInstance(CreateCouponDto, createInput)).length > 0);
    assert.ok(validateSync(plainToInstance(UpdateCouponDto, changes)).length > 0);
    const prisma = createCouponsPrismaMock();
    const service = new CouponsService(prisma as unknown as PrismaService);
    await assert.rejects(() => service.createAdminCoupon(createInput), BadRequestException);
    await assert.rejects(() => service.updateAdminCoupon("coupon-1", changes), BadRequestException);
    assert.equal(prisma.calls.couponCreate.length, 0);
    assert.equal(prisma.calls.couponUpdate.length, 0);
  }
});

test("coupon monetary and usage values accept their exact storage boundaries", async () => {
  const input = {
    code: "LIMITS",
    type: "FIXED_AMOUNT" as const,
    value: 9_999_999_999.99,
    minOrderAmount: 0,
    maxDiscount: 9_999_999_999.99,
    usageLimit: 2_147_483_647
  };
  assert.deepEqual(validateSync(plainToInstance(CreateCouponDto, input)), []);
  const prisma = createCouponsPrismaMock();
  const result = await new CouponsService(prisma as unknown as PrismaService).createAdminCoupon(input);
  assert.equal(result.value, input.value);
  assert.equal(result.maxDiscount, input.maxDiscount);
  assert.equal(result.usageLimit, input.usageLimit);
});
