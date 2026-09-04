import "reflect-metadata";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma, OrderStatus, PaymentStatus } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience, type AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { ReportsController } from "../../src/modules/reports/reports.controller";
import { DashboardReportExportQueryDto, DashboardReportQueryDto } from "../../src/modules/reports/dto/reports.dto";
import { ReportsService } from "../../src/modules/reports/reports.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";
import { ApiResponseInterceptor } from "../../src/common/interceptors/api-response.interceptor";
import { createValidationPipe } from "../../src/config/validation.config";

export const FIXTURE_DATE_FROM = "2026-07-06";
export const FIXTURE_DATE_TO = "2026-09-03";
export const FIXTURE_WAREHOUSES = Array.from({ length: 10 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  name: `Warehouse ${String(index + 1).padStart(2, "0")}`,
  code: `WH-${String(index + 1).padStart(2, "0")}`
}));
export const FIXTURE_ORDERS = Array.from({ length: 60 }, (_, index) => {
  const createdAt = new Date(`${FIXTURE_DATE_FROM}T12:00:00.000Z`);
  createdAt.setUTCDate(createdAt.getUTCDate() + index);
  return {
    createdAt,
    warehouseId: FIXTURE_WAREHOUSES[index % 10].id,
    status: index % 3 === 0 ? OrderStatus.CREATED : OrderStatus.DELIVERED,
    paymentStatus: index % 3 === 0 ? PaymentStatus.PENDING : PaymentStatus.PAID,
    grandTotal: 100 + index,
    quantity: 1 + index % 3,
    productId: `product-${index % 2 + 1}`
  };
});

type OrderWhere = {
  createdAt?: { gte?: Date; lte?: Date };
  warehouseId?: string | { in: string[] };
  status?: string | { in: string[] };
  paymentStatus?: string;
};
export function fixtureAuth(permissions: string[] = [PermissionCode.ReportsRead]): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin, permissions, role: AdminRoleCode.SuperAdmin,
    sessionId: "reports-test-session", sub: "reports-test-admin", tokenType: "access"
  };
}

export function createReportsServiceFixture(assignedWarehouseIds: string[] = []) {
  const calls: { rawSql: string[]; orderWhere: OrderWhere[]; warehouseWhere: unknown[] } = {
    rawSql: [], orderWhere: [], warehouseWhere: []
  };
  const matchValue = (value: string, filter: string | { in: string[] } | undefined) =>
    !filter || (typeof filter === "string" ? value === filter : filter.in.includes(value));
  const filterOrders = (where: OrderWhere = {}) => FIXTURE_ORDERS.filter((order) =>
    (!where.createdAt?.gte || order.createdAt >= where.createdAt.gte) &&
    (!where.createdAt?.lte || order.createdAt <= where.createdAt.lte) &&
    matchValue(order.warehouseId, where.warehouseId) &&
    matchValue(order.status, where.status) && matchValue(order.paymentStatus, where.paymentStatus));
  const prisma = {
    order: {
      count: async ({ where }: { where: OrderWhere }) => {
        calls.orderWhere.push(where);
        return filterOrders(where).length;
      },
      aggregate: async ({ where }: { where: OrderWhere }) => ({
        _sum: { grandTotal: filterOrders(where).reduce((total, order) => total + order.grandTotal, 0) }
      })
    },
    user: { count: async () => 12 },
    deliveryPartner: { count: async () => 4 },
    inventoryStock: {
      fields: { reorderLevel: "reorderLevel" },
      count: async ({ where }: { where: { warehouseId?: OrderWhere["warehouseId"] } }) =>
        FIXTURE_WAREHOUSES.reduce((total, warehouse, index) =>
          total + (matchValue(warehouse.id, where.warehouseId) ? index % 2 : 0), 0)
    },
    stockBatch: {
      count: async ({ where }: { where: { warehouseId?: OrderWhere["warehouseId"] } }) =>
        FIXTURE_WAREHOUSES.reduce((total, warehouse, index) =>
          total + (matchValue(warehouse.id, where.warehouseId) && index % 3 === 0 ? 1 : 0), 0)
    },
    warehouse: {
      count: async ({ where }: { where: { id?: OrderWhere["warehouseId"] } }) =>
        FIXTURE_WAREHOUSES.filter((warehouse) => matchValue(warehouse.id, where.id)).length,
      findMany: async ({ where }: { where: { id?: OrderWhere["warehouseId"] } }) => {
        calls.warehouseWhere.push(where);
        return FIXTURE_WAREHOUSES.filter((warehouse) => matchValue(warehouse.id, where.id));
      }
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = Prisma.sql(strings, ...values);
      calls.rawSql.push(query.sql);
      const dates = query.values.filter((value): value is Date => value instanceof Date);
      const warehouseIds = query.values.filter((value): value is string =>
        typeof value === "string" && FIXTURE_WAREHOUSES.some((warehouse) => warehouse.id === value));
      const equalityValue = (column: string) => {
        const index = query.sql.indexOf(`AND o."${column}" = ?`);
        return index < 0 ? undefined : query.values[query.sql.slice(0, index).split("?").length - 1];
      };
      const status = equalityValue("status") as OrderStatus | undefined;
      const paymentStatus = equalityValue("paymentStatus") as PaymentStatus | undefined;
      const warehouseId = /AND FALSE/.test(query.sql) ? { in: [] } : warehouseIds.length ? { in: warehouseIds } : undefined;
      const orders = filterOrders({ createdAt: { gte: dates[0], lte: dates[1] }, warehouseId, status, paymentStatus });
      if (query.sql.includes('FROM "Order" o')) {
        const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
        orders.forEach((order) => {
          const date = order.createdAt.toISOString().slice(0, 10);
          const point = byDay.get(date) ?? { date, orders: 0, revenue: 0 };
          point.orders++;
          point.revenue += order.grandTotal;
          byDay.set(date, point);
        });
        return [...byDay.values()];
      }
      if (query.sql.includes('FROM "OrderItem" oi')) {
        const productOrders = filterOrders({
          createdAt: { gte: dates[0], lte: dates[1] }, warehouseId, paymentStatus,
          status
        });
        return [1, 2].map((number) => {
          const matching = productOrders.filter((order) => order.productId === `product-${number}`);
          return {
            productId: `product-${number}`,
            name: number === 1 ? 'Forceps, curved 8" (sterile)' : "Surgical scissors - standard",
            sku: `SKU-${number}`,
            quantity: matching.reduce((total, order) => total + order.quantity, 0),
            revenue: matching.reduce((total, order) => total + order.grandTotal, 0)
          };
        }).filter((product) => product.quantity > 0);
      }
      return FIXTURE_WAREHOUSES.map((warehouse, index) => ({
          warehouseId: warehouse.id, warehouseName: warehouse.name, warehouseCode: warehouse.code,
          activeBatches: index + 1, availableQuantity: 100 + index, reservedQuantity: index,
          lowStockProducts: index % 2, nearExpiryBatches: index % 3 === 0 ? 1 : 0
        })).filter((warehouse) => matchValue(warehouse.warehouseId, warehouseId));
    }
  };
  const warehouseAccess = {
    assertCanManageWarehouse: async (auth: AuthJwtPayload, warehouseId: string) => {
      if (auth.role !== AdminRoleCode.SuperAdmin && !assignedWarehouseIds.includes(warehouseId)) {
        throw new ForbiddenException("Admin is not assigned to this warehouse.");
      }
    },
    getWarehouseScope: async (auth: AuthJwtPayload) => auth.role === AdminRoleCode.SuperAdmin
      ? { allWarehouses: true as const }
      : { allWarehouses: false as const, warehouseIds: assignedWarehouseIds }
  };
  const service = new ReportsService(
    prisma as unknown as PrismaService, warehouseAccess as unknown as WarehouseAccessService
  );
  return { service, calls, orders: FIXTURE_ORDERS, warehouses: FIXTURE_WAREHOUSES };
}

export async function createReportsHttpFixture(options: {
  auth?: AuthJwtPayload;
  assignedWarehouseIds?: string[];
} = {}) {
  const fixture = createReportsServiceFixture(options.assignedWarehouseIds);
  // tsx does not emit constructor metadata; supply the actual controller dependency for this test app.
  Reflect.defineMetadata("design:paramtypes", [ReportsService], ReportsController);
  Reflect.defineMetadata("design:paramtypes", [DashboardReportQueryDto, Object], ReportsController.prototype, "getDashboard");
  Reflect.defineMetadata("design:paramtypes", [DashboardReportExportQueryDto, Object, Object], ReportsController.prototype, "exportDashboard");
  const moduleRef = await Test.createTestingModule({
    controllers: [ReportsController],
    providers: [{ provide: ReportsService, useValue: fixture.service }]
  }).overrideGuard(AdminJwtGuard).useValue({
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().auth = options.auth ?? fixtureAuth();
      return true;
    }
  }).overrideGuard(PermissionGuard).useValue(new PermissionGuard(new Reflector())).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalPipes(createValidationPipe());
  await app.init();
  return { ...fixture, app };
}
