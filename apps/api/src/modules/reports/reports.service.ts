import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  DeliveryPartnerStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  WarehouseStatus
} from "../../generated/prisma/client";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type { DashboardReportQueryDto } from "./dto/reports.dto";

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };

type WarehouseScopeFilter =
  | {
      allWarehouses: true;
      selectedWarehouseId: null;
      warehouseIds: null;
    }
  | {
      allWarehouses: false;
      selectedWarehouseId: string | null;
      warehouseIds: string[];
    };

type OrdersByDayRow = {
  date: Date | string;
  orders: bigint | number | string;
};

type RevenueByDayRow = {
  date: Date | string;
  revenue: DecimalValue | null;
};

type TopSellingProductRow = {
  name: string;
  productId: string;
  quantity: bigint | number | string;
  revenue: DecimalValue | null;
  sku: string;
};

type StockAlertRow = {
  lowStockProducts: bigint | number | string;
  nearExpiryBatches: bigint | number | string;
  warehouseCode: string;
  warehouseId: string;
  warehouseName: string;
};

type WarehouseStockSummaryRow = StockAlertRow & {
  activeBatches: bigint | number | string;
  availableQuantity: bigint | number | string | null;
  reservedQuantity: bigint | number | string | null;
};

const DASHBOARD_SERIES_LIMIT = 30;
const TOP_PRODUCTS_LIMIT = 8;
const STOCK_ALERT_LIMIT = 8;
const PENDING_ORDER_STATUSES = [
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY
];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService
  ) {}

  async getDashboard(query: DashboardReportQueryDto, auth: AuthJwtPayload) {
    const warehouseScope = await this.resolveWarehouseScope(query.warehouseId, auth);
    const warehouseFilter = this.toPrismaWarehouseFilter(warehouseScope);
    const dateRange = buildDateRangeFilter(query.dateFrom, query.dateTo);
    const now = new Date();
    const nearExpiryCutoff = addDays(now, query.nearExpiryDays ?? 30);
    const todayRange = getUtcDayRange(now);
    const orderWhere = stripUndefined({
      createdAt: dateRange,
      deletedAt: null,
      warehouseId: warehouseFilter
    });
    const paidOrderWhere = stripUndefined({
      ...orderWhere,
      paymentStatus: PaymentStatus.PAID
    });
    const pendingOrderWhere = stripUndefined({
      ...orderWhere,
      status: {
        in: PENDING_ORDER_STATUSES
      }
    });
    const stockWhere = stripUndefined({
      warehouseId: warehouseFilter
    });
    const nearExpiryWhere = stripUndefined({
      expiryDate: {
        gte: now,
        lte: nearExpiryCutoff
      },
      quantity: {
        gt: 0
      },
      warehouseId: warehouseFilter
    });
    const activeWarehouseWhere = stripUndefined({
      deletedAt: null,
      id: warehouseFilter,
      status: WarehouseStatus.ACTIVE
    });

    const [
      totalOrders,
      todayOrders,
      revenueAggregate,
      pendingOrders,
      lowStockProducts,
      nearExpiryBatches,
      activeCustomers,
      activeDeliveryPartners,
      activeWarehouses,
      ordersByDay,
      revenueByDay,
      topSellingProducts,
      stockAlerts,
      warehouseStockSummary
    ] = await Promise.all([
      this.prisma.order.count({
        where: orderWhere
      }),
      this.prisma.order.count({
        where: {
          ...orderWhere,
          createdAt: todayRange
        }
      }),
      this.prisma.order.aggregate({
        _sum: {
          grandTotal: true
        },
        where: paidOrderWhere
      }),
      this.prisma.order.count({
        where: pendingOrderWhere
      }),
      this.prisma.inventoryStock.count({
        where: {
          ...stockWhere,
          availableQuantity: {
            lte: this.prisma.inventoryStock.fields.reorderLevel
          }
        }
      }),
      this.prisma.stockBatch.count({
        where: nearExpiryWhere
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          isActive: true
        }
      }),
      this.prisma.deliveryPartner.count({
        where: {
          deletedAt: null,
          status: DeliveryPartnerStatus.ACTIVE
        }
      }),
      this.prisma.warehouse.count({
        where: activeWarehouseWhere
      }),
      this.queryOrdersByDay(dateRange, warehouseScope),
      this.queryRevenueByDay(dateRange, warehouseScope),
      this.queryTopSellingProducts(dateRange, warehouseScope),
      this.queryStockAlerts(now, nearExpiryCutoff, warehouseScope),
      this.queryWarehouseStockSummary(now, nearExpiryCutoff, warehouseScope)
    ]);

    return {
      cards: {
        activeCustomers,
        activeDeliveryPartners,
        activeWarehouses,
        lowStockProducts,
        nearExpiryBatches,
        pendingOrders,
        revenue: roundMoney(toNumber(revenueAggregate._sum.grandTotal)),
        todayOrders,
        totalOrders
      },
      charts: {
        ordersByDay: ordersByDay.map((item) => ({
          date: formatDateOnly(item.date),
          orders: toInteger(item.orders)
        })),
        revenueByDay: revenueByDay.map((item) => ({
          date: formatDateOnly(item.date),
          revenue: roundMoney(toNumber(item.revenue))
        })),
        stockAlerts: stockAlerts.map((item) => ({
          lowStockProducts: toInteger(item.lowStockProducts),
          nearExpiryBatches: toInteger(item.nearExpiryBatches),
          warehouseCode: item.warehouseCode,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName
        })),
        topSellingProducts: topSellingProducts.map((item) => ({
          name: item.name,
          productId: item.productId,
          quantity: toInteger(item.quantity),
          revenue: roundMoney(toNumber(item.revenue)),
          sku: item.sku
        })),
        warehouseStockSummary: warehouseStockSummary.map((item) => ({
          activeBatches: toInteger(item.activeBatches),
          availableQuantity: toInteger(item.availableQuantity),
          lowStockProducts: toInteger(item.lowStockProducts),
          nearExpiryBatches: toInteger(item.nearExpiryBatches),
          reservedQuantity: toInteger(item.reservedQuantity),
          warehouseCode: item.warehouseCode,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName
        }))
      },
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        nearExpiryDays: query.nearExpiryDays ?? 30,
        warehouseId: query.warehouseId ?? null,
        warehouseScope: warehouseScope.allWarehouses
          ? {
              allWarehouses: true as const
            }
          : {
              allWarehouses: false as const,
              warehouseIds: warehouseScope.warehouseIds
            }
      }
    };
  }

  private async resolveWarehouseScope(
    warehouseId: string | undefined,
    auth: AuthJwtPayload
  ): Promise<WarehouseScopeFilter> {
    if (warehouseId !== undefined) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);

      return {
        allWarehouses: false,
        selectedWarehouseId: warehouseId,
        warehouseIds: [warehouseId]
      };
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    return scope.allWarehouses
      ? {
          allWarehouses: true,
          selectedWarehouseId: null,
          warehouseIds: null
        }
      : {
          allWarehouses: false,
          selectedWarehouseId: null,
          warehouseIds: scope.warehouseIds
        };
  }

  private toPrismaWarehouseFilter(scope: WarehouseScopeFilter) {
    if (scope.allWarehouses) {
      return undefined;
    }

    if (scope.selectedWarehouseId) {
      return scope.selectedWarehouseId;
    }

    return {
      in: scope.warehouseIds
    };
  }

  private queryOrdersByDay(
    dateRange: DateRangeFilter | undefined,
    warehouseScope: WarehouseScopeFilter
  ) {
    return this.prisma.$queryRaw<OrdersByDayRow[]>`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS "date",
        COUNT(*)::int AS "orders"
      FROM "Order" o
      WHERE o."deletedAt" IS NULL
        ${dateRangeSql(Prisma.sql`o."createdAt"`, dateRange)}
        ${warehouseSql(Prisma.sql`o."warehouseId"`, warehouseScope)}
      GROUP BY date_trunc('day', o."createdAt")
      ORDER BY date_trunc('day', o."createdAt") ASC
      LIMIT ${DASHBOARD_SERIES_LIMIT}
    `;
  }

  private queryRevenueByDay(
    dateRange: DateRangeFilter | undefined,
    warehouseScope: WarehouseScopeFilter
  ) {
    return this.prisma.$queryRaw<RevenueByDayRow[]>`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS "date",
        COALESCE(SUM(o."grandTotal"), 0) AS "revenue"
      FROM "Order" o
      WHERE o."deletedAt" IS NULL
        AND o."paymentStatus" = ${PaymentStatus.PAID}::"PaymentStatus"
        ${dateRangeSql(Prisma.sql`o."createdAt"`, dateRange)}
        ${warehouseSql(Prisma.sql`o."warehouseId"`, warehouseScope)}
      GROUP BY date_trunc('day', o."createdAt")
      ORDER BY date_trunc('day', o."createdAt") ASC
      LIMIT ${DASHBOARD_SERIES_LIMIT}
    `;
  }

  private queryTopSellingProducts(
    dateRange: DateRangeFilter | undefined,
    warehouseScope: WarehouseScopeFilter
  ) {
    return this.prisma.$queryRaw<TopSellingProductRow[]>`
      SELECT
        p."id" AS "productId",
        p."name" AS "name",
        p."sku" AS "sku",
        COALESCE(SUM(oi."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(oi."total"), 0) AS "revenue"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      INNER JOIN "Product" p ON p."id" = oi."productId"
      WHERE o."deletedAt" IS NULL
        AND o."status" NOT IN (${Prisma.join([
          OrderStatus.CANCELLED,
          OrderStatus.RETURNED
        ])})
        ${dateRangeSql(Prisma.sql`o."createdAt"`, dateRange)}
        ${warehouseSql(
          Prisma.sql`COALESCE(oi."warehouseId", o."warehouseId")`,
          warehouseScope
        )}
      GROUP BY p."id", p."name", p."sku"
      ORDER BY SUM(oi."quantity") DESC, SUM(oi."total") DESC, p."name" ASC
      LIMIT ${TOP_PRODUCTS_LIMIT}
    `;
  }

  private queryStockAlerts(
    now: Date,
    nearExpiryCutoff: Date,
    warehouseScope: WarehouseScopeFilter
  ) {
    return this.prisma.$queryRaw<StockAlertRow[]>`
      WITH inventory_alerts AS (
        SELECT
          i."warehouseId",
          COUNT(*) FILTER (
            WHERE i."availableQuantity" <= i."reorderLevel"
          )::int AS "lowStockProducts"
        FROM "InventoryStock" i
        WHERE TRUE
          ${warehouseSql(Prisma.sql`i."warehouseId"`, warehouseScope)}
        GROUP BY i."warehouseId"
      ),
      batch_alerts AS (
        SELECT
          sb."warehouseId",
          COUNT(*) FILTER (
            WHERE sb."quantity" > 0
              AND sb."expiryDate" >= ${now}
              AND sb."expiryDate" <= ${nearExpiryCutoff}
          )::int AS "nearExpiryBatches"
        FROM "StockBatch" sb
        WHERE TRUE
          ${warehouseSql(Prisma.sql`sb."warehouseId"`, warehouseScope)}
        GROUP BY sb."warehouseId"
      )
      SELECT
        w."id" AS "warehouseId",
        w."name" AS "warehouseName",
        w."code" AS "warehouseCode",
        COALESCE(ia."lowStockProducts", 0)::int AS "lowStockProducts",
        COALESCE(ba."nearExpiryBatches", 0)::int AS "nearExpiryBatches"
      FROM "Warehouse" w
      LEFT JOIN inventory_alerts ia ON ia."warehouseId" = w."id"
      LEFT JOIN batch_alerts ba ON ba."warehouseId" = w."id"
      WHERE w."deletedAt" IS NULL
        AND w."status" = ${WarehouseStatus.ACTIVE}::"WarehouseStatus"
        ${warehouseSql(Prisma.sql`w."id"`, warehouseScope)}
        AND (
          COALESCE(ia."lowStockProducts", 0) > 0
          OR COALESCE(ba."nearExpiryBatches", 0) > 0
        )
      ORDER BY "lowStockProducts" DESC, "nearExpiryBatches" DESC, w."name" ASC
      LIMIT ${STOCK_ALERT_LIMIT}
    `;
  }

  private queryWarehouseStockSummary(
    now: Date,
    nearExpiryCutoff: Date,
    warehouseScope: WarehouseScopeFilter
  ) {
    return this.prisma.$queryRaw<WarehouseStockSummaryRow[]>`
      WITH inventory_summary AS (
        SELECT
          i."warehouseId",
          COALESCE(SUM(i."availableQuantity"), 0)::int AS "availableQuantity",
          COALESCE(SUM(i."reservedQuantity"), 0)::int AS "reservedQuantity",
          COUNT(*) FILTER (
            WHERE i."availableQuantity" <= i."reorderLevel"
          )::int AS "lowStockProducts"
        FROM "InventoryStock" i
        WHERE TRUE
          ${warehouseSql(Prisma.sql`i."warehouseId"`, warehouseScope)}
        GROUP BY i."warehouseId"
      ),
      batch_summary AS (
        SELECT
          sb."warehouseId",
          COUNT(*) FILTER (
            WHERE sb."quantity" > 0
              AND sb."expiryDate" >= ${now}
              AND sb."expiryDate" <= ${nearExpiryCutoff}
          )::int AS "nearExpiryBatches",
          COUNT(*) FILTER (
            WHERE sb."quantity" > 0
          )::int AS "activeBatches"
        FROM "StockBatch" sb
        WHERE TRUE
          ${warehouseSql(Prisma.sql`sb."warehouseId"`, warehouseScope)}
        GROUP BY sb."warehouseId"
      )
      SELECT
        w."id" AS "warehouseId",
        w."name" AS "warehouseName",
        w."code" AS "warehouseCode",
        COALESCE(isu."availableQuantity", 0)::int AS "availableQuantity",
        COALESCE(isu."reservedQuantity", 0)::int AS "reservedQuantity",
        COALESCE(isu."lowStockProducts", 0)::int AS "lowStockProducts",
        COALESCE(bs."nearExpiryBatches", 0)::int AS "nearExpiryBatches",
        COALESCE(bs."activeBatches", 0)::int AS "activeBatches"
      FROM "Warehouse" w
      LEFT JOIN inventory_summary isu ON isu."warehouseId" = w."id"
      LEFT JOIN batch_summary bs ON bs."warehouseId" = w."id"
      WHERE w."deletedAt" IS NULL
        AND w."status" = ${WarehouseStatus.ACTIVE}::"WarehouseStatus"
        ${warehouseSql(Prisma.sql`w."id"`, warehouseScope)}
      ORDER BY w."name" ASC
      LIMIT ${STOCK_ALERT_LIMIT}
    `;
  }
}

type DateRangeFilter = {
  gte?: Date;
  lte?: Date;
};

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);

  return result;
}

function buildDateRangeFilter(dateFrom?: string, dateTo?: string) {
  const gte = parseDateBoundary(dateFrom, "start");
  const lte = parseDateBoundary(dateTo, "end");

  if (!gte && !lte) {
    return undefined;
  }

  return stripUndefined({
    gte,
    lte
  });
}

function dateRangeSql(column: Prisma.Sql, dateRange: DateRangeFilter | undefined) {
  if (!dateRange) {
    return Prisma.empty;
  }

  const lowerBound = dateRange.gte
    ? Prisma.sql`AND ${column} >= ${dateRange.gte}`
    : Prisma.empty;
  const upperBound = dateRange.lte
    ? Prisma.sql`AND ${column} <= ${dateRange.lte}`
    : Prisma.empty;

  return Prisma.sql`${lowerBound} ${upperBound}`;
}

function formatDateOnly(value: Date | string) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function getUtcDayRange(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);

  return {
    gte: start,
    lte: end
  };
}

function parseDateBoundary(value: string | undefined, boundary: "end" | "start") {
  if (!value) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    if (!year || !month || !day) {
      return undefined;
    }

    return boundary === "start"
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function toInteger(value: bigint | number | string | null) {
  if (value === null) {
    return 0;
  }

  return Number(value);
}

function toNumber(value: DecimalValue | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value.toNumber?.() ?? Number(value.toString());
}

function warehouseSql(column: Prisma.Sql, warehouseScope: WarehouseScopeFilter) {
  if (warehouseScope.allWarehouses) {
    return Prisma.empty;
  }

  if (warehouseScope.selectedWarehouseId) {
    return Prisma.sql`AND ${column} = ${warehouseScope.selectedWarehouseId}`;
  }

  if (warehouseScope.warehouseIds.length === 0) {
    return Prisma.sql`AND FALSE`;
  }

  return Prisma.sql`AND ${column} IN (${Prisma.join(warehouseScope.warehouseIds)})`;
}
