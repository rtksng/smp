import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { DeliveryChargesService } from "../../src/modules/delivery-charges/delivery-charges.service";

const now = new Date("2026-06-17T10:00:00.000Z");

type DeliveryChargeRuleFixture = {
  charge: string;
  createdAt: Date;
  deletedAt: Date | null;
  freeDeliveryThreshold: string | null;
  id: string;
  isActive: boolean;
  maxOrderAmount: string | null;
  minOrderAmount: string | null;
  name: string;
  pincode: string | null;
  priority: number;
  updatedAt: Date;
  warehouseId: string | null;
};

function ruleFixture(
  input: Partial<DeliveryChargeRuleFixture> = {}
): DeliveryChargeRuleFixture {
  return {
    charge: "80.00",
    createdAt: now,
    deletedAt: null,
    freeDeliveryThreshold: null,
    id: "rule-1",
    isActive: true,
    maxOrderAmount: null,
    minOrderAmount: null,
    name: "Default delivery",
    pincode: null,
    priority: 0,
    updatedAt: now,
    warehouseId: null,
    ...input
  };
}

function createDeliveryChargePrismaMock(rules: DeliveryChargeRuleFixture[]) {
  const calls: Record<string, unknown[]> = {
    deliveryChargeRuleCreate: [],
    deliveryChargeRuleFindFirst: [],
    deliveryChargeRuleFindMany: [],
    deliveryChargeRuleUpdate: []
  };
  const prisma = {
    calls,
    deliveryChargeRule: {
      create: async (args: { data: Partial<DeliveryChargeRuleFixture> }) => {
        calls.deliveryChargeRuleCreate.push(args);
        const rule = ruleFixture({
          id: `rule-${rules.length + 1}`,
          ...args.data
        });
        rules.push(rule);
        return rule;
      },
      findFirst: async (args: { where?: { id?: string } }) => {
        calls.deliveryChargeRuleFindFirst.push(args);
        return rules.find((rule) => rule.id === args.where?.id) ?? null;
      },
      findMany: async (args: unknown) => {
        calls.deliveryChargeRuleFindMany.push(args);
        return rules.filter((rule) => !rule.deletedAt);
      },
      update: async (args: { data: Partial<DeliveryChargeRuleFixture>; where: { id: string } }) => {
        calls.deliveryChargeRuleUpdate.push(args);
        const index = rules.findIndex((rule) => rule.id === args.where.id);
        rules[index] = {
          ...rules[index],
          ...args.data,
          updatedAt: now
        } as DeliveryChargeRuleFixture;
        return rules[index];
      }
    }
  };

  return prisma as unknown as PrismaService & { calls: typeof calls };
}

test("calculateDeliveryCharge chooses the most specific matching pincode and warehouse rule", async () => {
  const prisma = createDeliveryChargePrismaMock([
    ruleFixture({ charge: "90.00", id: "default-rule", name: "Default" }),
    ruleFixture({
      charge: "60.00",
      id: "pincode-rule",
      name: "Delhi pincode",
      pincode: "110001",
      priority: 1
    }),
    ruleFixture({
      charge: "40.00",
      id: "warehouse-pincode-rule",
      name: "Delhi warehouse pincode",
      pincode: "110001",
      priority: 0,
      warehouseId: "warehouse-1"
    })
  ]);
  const service = new DeliveryChargesService(prisma);

  const quote = await service.calculateDeliveryCharge({
    pincode: " 110001 ",
    subtotal: 240,
    warehouseId: "warehouse-1"
  });

  assert.equal(quote.deliveryCharge, 40);
  assert.equal(quote.rule?.id, "warehouse-pincode-rule");
});

test("calculateDeliveryCharge makes matching rules free after the free delivery threshold", async () => {
  const prisma = createDeliveryChargePrismaMock([
    ruleFixture({
      charge: "75.00",
      freeDeliveryThreshold: "500.00",
      id: "threshold-rule"
    })
  ]);
  const service = new DeliveryChargesService(prisma);

  const quote = await service.calculateDeliveryCharge({
    pincode: null,
    subtotal: 500,
    warehouseId: null
  });

  assert.equal(quote.deliveryCharge, 0);
  assert.equal(quote.rule?.id, "threshold-rule");
});

test("createAdminRule rejects invalid order amount ranges", async () => {
  const prisma = createDeliveryChargePrismaMock([]);
  const service = new DeliveryChargesService(prisma);

  await assert.rejects(
    () =>
      service.createAdminRule({
        charge: 50,
        isActive: true,
        maxOrderAmount: 999,
        minOrderAmount: 1000,
        name: "Invalid range",
        pincode: null,
        priority: 0,
        warehouseId: null
      }),
    BadRequestException
  );
});
