import "reflect-metadata";
import { type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { PrismaService } from "../../src/database/prisma.service";
import { Prisma } from "../../src/generated/prisma/client";
import { createValidationPipe } from "../../src/config/validation.config";
import { ApiResponseInterceptor } from "../../src/common/interceptors/api-response.interceptor";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { AdminDeliveryChargesController } from "../../src/modules/delivery-charges/delivery-charges.controller";
import { DeliveryChargesService } from "../../src/modules/delivery-charges/delivery-charges.service";
import {
  AdminDeliveryChargeRuleListQueryDto, CreateDeliveryChargeRuleDto, UpdateDeliveryChargeRuleDto
} from "../../src/modules/delivery-charges/dto/delivery-charge.dto";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";

const now = new Date("2026-09-03T12:00:00.000Z");
export const DELIVERY_TEST_WAREHOUSE_ID = "00000000-0000-4000-8000-000000000101";
export const DELIVERY_DELETED_WAREHOUSE_ID = "00000000-0000-4000-8000-000000000102";
type RuleRecord = {
  id: string; name: string; charge: Prisma.Decimal; minOrderAmount: Prisma.Decimal | null;
  maxOrderAmount: Prisma.Decimal | null; freeDeliveryThreshold: Prisma.Decimal | null;
  pincode: string | null; warehouseId: string | null; priority: number; isActive: boolean;
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;
};
type RuleWhere = {
  id?: string; deletedAt?: null; isActive?: boolean; pincode?: string; warehouseId?: string;
  name?: { contains: string; mode: string };
};

export async function createDeliveryChargesHttpFixture(
  permissions: string[] = [PermissionCode.SettingsManage]
) {
  const rules: RuleRecord[] = [];
  const calls = { created: 0, updated: 0 };
  const warehouses = [
    { id: DELIVERY_TEST_WAREHOUSE_ID, name: "Delhi warehouse", code: "DEL-01", deletedAt: null },
    { id: DELIVERY_DELETED_WAREHOUSE_ID, name: "Archived warehouse", code: "OLD-01", deletedAt: now }
  ];
  const matches = (rule: RuleRecord, where: RuleWhere = {}) =>
    (where.deletedAt === undefined || rule.deletedAt === null) &&
    (where.id === undefined || rule.id === where.id) &&
    (where.isActive === undefined || rule.isActive === where.isActive) &&
    (where.pincode === undefined || rule.pincode === where.pincode) &&
    (where.warehouseId === undefined || rule.warehouseId === where.warehouseId) &&
    (!where.name || rule.name.toLowerCase().includes(where.name.contains.toLowerCase()));
  const includeWarehouse = (rule: RuleRecord) => ({
    ...rule,
    warehouse: warehouses.find((warehouse) => warehouse.id === rule.warehouseId) ?? null
  });
  const decimal = (value: unknown) => value === null || value === undefined
    ? null : new Prisma.Decimal(value as number | string);
  const prisma = {
    warehouse: {
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) =>
        warehouses.find((warehouse) => warehouse.id === where.id && warehouse.deletedAt === null) ?? null
    },
    deliveryChargeRule: {
      findFirst: async ({ where }: { where: RuleWhere }) => {
        const rule = rules.find((item) => matches(item, where));
        return rule ? includeWarehouse(rule) : null;
      },
      findMany: async ({ where, skip = 0, take }: { where: RuleWhere; skip?: number; take?: number }) =>
        rules.filter((rule) => matches(rule, where))
          .sort((left, right) => right.priority - left.priority ||
            right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id))
          .slice(skip, take === undefined ? undefined : skip + take).map(includeWarehouse),
      count: async ({ where }: { where: RuleWhere }) => rules.filter((rule) => matches(rule, where)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.created++;
        const rule: RuleRecord = {
          id: `00000000-0000-4000-8000-${String(rules.length + 1).padStart(12, "0")}`,
          name: String(data.name), charge: new Prisma.Decimal(data.charge as number),
          minOrderAmount: decimal(data.minOrderAmount), maxOrderAmount: decimal(data.maxOrderAmount),
          freeDeliveryThreshold: decimal(data.freeDeliveryThreshold), pincode: (data.pincode as string | null) ?? null,
          warehouseId: (data.warehouseId as string | null) ?? null, priority: (data.priority as number) ?? 0,
          isActive: (data.isActive as boolean) ?? true, createdAt: now, updatedAt: now, deletedAt: null
        };
        rules.push(rule);
        return includeWarehouse(rule);
      },
      update: async ({ data, where }: { data: Record<string, unknown>; where: { id: string } }) => {
        const rule = rules.find((item) => item.id === where.id);
        if (!rule) throw new Error("Fixture rule missing.");
        calls.updated++;
        Object.assign(rule, data, { updatedAt: now });
        for (const key of ["charge", "minOrderAmount", "maxOrderAmount", "freeDeliveryThreshold"] as const) {
          if (data[key] !== undefined) {
            Object.assign(rule, { [key]: decimal(data[key]) });
          }
        }
        return includeWarehouse(rule);
      }
    }
  };
  const service = new DeliveryChargesService(prisma as unknown as PrismaService);
  Reflect.defineMetadata("design:paramtypes", [DeliveryChargesService], AdminDeliveryChargesController);
  Reflect.defineMetadata("design:paramtypes", [AdminDeliveryChargeRuleListQueryDto], AdminDeliveryChargesController.prototype, "listAdminRules");
  Reflect.defineMetadata("design:paramtypes", [CreateDeliveryChargeRuleDto], AdminDeliveryChargesController.prototype, "createAdminRule");
  Reflect.defineMetadata("design:paramtypes", [String, UpdateDeliveryChargeRuleDto], AdminDeliveryChargesController.prototype, "updateAdminRule");
  Reflect.defineMetadata("design:paramtypes", [String], AdminDeliveryChargesController.prototype, "deleteAdminRule");
  // Match the production compiler's reflected primitive property types under tsx.
  for (const dto of [CreateDeliveryChargeRuleDto, UpdateDeliveryChargeRuleDto]) {
    Reflect.defineMetadata("design:type", Boolean, dto.prototype, "isActive");
    Reflect.defineMetadata("design:type", String, dto.prototype, "name");
  }
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminDeliveryChargesController],
    providers: [{ provide: DeliveryChargesService, useValue: service }]
  }).overrideGuard(AdminJwtGuard).useValue({
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().auth = { permissions };
      return true;
    }
  }).overrideGuard(PermissionGuard).useValue(new PermissionGuard(new Reflector())).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useLogger(false);
  await app.init();
  return { app, service, rules, calls };
}
