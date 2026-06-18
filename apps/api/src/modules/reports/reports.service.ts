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
import type {
  DashboardExportFormat,
  DashboardReportQueryDto
} from "./dto/reports.dto";

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

type DashboardReport = Awaited<ReturnType<ReportsService["getDashboard"]>>;
type DashboardExportFile = {
  body: Buffer;
  contentType: string;
  filename: string;
};

type ReportSqlFilters = {
  dateRange: DateRangeFilter | undefined;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  warehouseScope: WarehouseScopeFilter;
};

const DASHBOARD_SERIES_LIMIT = 30;
const TOP_PRODUCTS_LIMIT = 8;
const STOCK_ALERT_LIMIT = 8;
const PENDING_ORDER_STATUSES: OrderStatus[] = [
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
      paymentStatus: query.paymentStatus,
      status: query.orderStatus,
      warehouseId: warehouseFilter
    });
    const paidOrderWhere = stripUndefined({
      ...orderWhere,
      paymentStatus: query.paymentStatus ?? PaymentStatus.PAID
    });
    const pendingOrderWhere = stripUndefined({
      ...orderWhere,
      status: {
        in: query.orderStatus
          ? pendingStatusFilter(query.orderStatus)
          : PENDING_ORDER_STATUSES
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
      this.queryOrdersByDay({
        dateRange,
        orderStatus: query.orderStatus,
        paymentStatus: query.paymentStatus,
        warehouseScope
      }),
      this.queryRevenueByDay({
        dateRange,
        orderStatus: query.orderStatus,
        paymentStatus: query.paymentStatus,
        warehouseScope
      }),
      this.queryTopSellingProducts({
        dateRange,
        orderStatus: query.orderStatus,
        paymentStatus: query.paymentStatus,
        warehouseScope
      }),
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
        orderStatus: query.orderStatus ?? null,
        paymentStatus: query.paymentStatus ?? null,
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

  async exportDashboard(
    query: DashboardReportQueryDto,
    auth: AuthJwtPayload,
    format: DashboardExportFormat
  ): Promise<DashboardExportFile> {
    const report = await this.getDashboard(query, auth);
    const filename = dashboardReportFilename(report, format);

    if (format === "pdf") {
      return {
        body: renderDashboardPdf(report),
        contentType: "application/pdf",
        filename
      };
    }

    return {
      body: Buffer.from(renderDashboardCsv(report), "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename
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

  private queryOrdersByDay(filters: ReportSqlFilters) {
    return this.prisma.$queryRaw<OrdersByDayRow[]>`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS "date",
        COUNT(*)::int AS "orders"
      FROM "Order" o
      WHERE o."deletedAt" IS NULL
        ${dateRangeSql(Prisma.sql`o."createdAt"`, filters.dateRange)}
        ${orderStatusSql(Prisma.sql`o."status"`, filters.orderStatus)}
        ${paymentStatusSql(Prisma.sql`o."paymentStatus"`, filters.paymentStatus)}
        ${warehouseSql(Prisma.sql`o."warehouseId"`, filters.warehouseScope)}
      GROUP BY date_trunc('day', o."createdAt")
      ORDER BY date_trunc('day', o."createdAt") ASC
      LIMIT ${DASHBOARD_SERIES_LIMIT}
    `;
  }

  private queryRevenueByDay(filters: ReportSqlFilters) {
    return this.prisma.$queryRaw<RevenueByDayRow[]>`
      SELECT
        to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS "date",
        COALESCE(SUM(o."grandTotal"), 0) AS "revenue"
      FROM "Order" o
      WHERE o."deletedAt" IS NULL
        AND o."paymentStatus" = ${filters.paymentStatus ?? PaymentStatus.PAID}::"PaymentStatus"
        ${dateRangeSql(Prisma.sql`o."createdAt"`, filters.dateRange)}
        ${orderStatusSql(Prisma.sql`o."status"`, filters.orderStatus)}
        ${warehouseSql(Prisma.sql`o."warehouseId"`, filters.warehouseScope)}
      GROUP BY date_trunc('day', o."createdAt")
      ORDER BY date_trunc('day', o."createdAt") ASC
      LIMIT ${DASHBOARD_SERIES_LIMIT}
    `;
  }

  private queryTopSellingProducts(filters: ReportSqlFilters) {
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
        ${dateRangeSql(Prisma.sql`o."createdAt"`, filters.dateRange)}
        ${orderStatusSql(Prisma.sql`o."status"`, filters.orderStatus)}
        ${paymentStatusSql(Prisma.sql`o."paymentStatus"`, filters.paymentStatus)}
        ${warehouseSql(
          Prisma.sql`COALESCE(oi."warehouseId", o."warehouseId")`,
          filters.warehouseScope
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

function dashboardReportFilename(
  report: DashboardReport,
  format: DashboardExportFormat
) {
  const start = report.filters.dateFrom ?? "all";
  const end = report.filters.dateTo ?? "today";

  return `dashboard-report-${start}-to-${end}.${format}`;
}

function renderDashboardCsv(report: DashboardReport) {
  const rows: string[][] = [
    ["Dashboard report"],
    ["Date from", report.filters.dateFrom ?? ""],
    ["Date to", report.filters.dateTo ?? ""],
    ["Warehouse", report.filters.warehouseId ?? "All visible warehouses"],
    ["Order status", report.filters.orderStatus ?? "All statuses"],
    ["Payment status", report.filters.paymentStatus ?? "All payment statuses"],
    ["Near expiry days", String(report.filters.nearExpiryDays)],
    [],
    ["Cards"],
    ["Metric", "Value"],
    ["Total orders", String(report.cards.totalOrders)],
    ["Today orders", String(report.cards.todayOrders)],
    ["Revenue", String(report.cards.revenue)],
    ["Pending orders", String(report.cards.pendingOrders)],
    ["Low stock products", String(report.cards.lowStockProducts)],
    ["Near expiry batches", String(report.cards.nearExpiryBatches)],
    ["Active customers", String(report.cards.activeCustomers)],
    ["Active delivery partners", String(report.cards.activeDeliveryPartners)],
    ["Active warehouses", String(report.cards.activeWarehouses)],
    [],
    ["Orders by day"],
    ["Date", "Orders"],
    ...report.charts.ordersByDay.map((item) => [
      item.date,
      String(item.orders)
    ]),
    [],
    ["Revenue by day"],
    ["Date", "Revenue"],
    ...report.charts.revenueByDay.map((item) => [
      item.date,
      String(item.revenue)
    ]),
    [],
    ["Top selling products"],
    ["Product", "SKU", "Quantity", "Revenue", "Product ID"],
    ...report.charts.topSellingProducts.map((item) => [
      item.name,
      item.sku,
      String(item.quantity),
      String(item.revenue),
      item.productId
    ]),
    [],
    ["Stock alerts"],
    ["Warehouse", "Code", "Low stock products", "Near expiry batches", "Warehouse ID"],
    ...report.charts.stockAlerts.map((item) => [
      item.warehouseName,
      item.warehouseCode,
      String(item.lowStockProducts),
      String(item.nearExpiryBatches),
      item.warehouseId
    ]),
    [],
    ["Warehouse stock summary"],
    [
      "Warehouse",
      "Code",
      "Available quantity",
      "Reserved quantity",
      "Active batches",
      "Low stock products",
      "Near expiry batches",
      "Warehouse ID"
    ],
    ...report.charts.warehouseStockSummary.map((item) => [
      item.warehouseName,
      item.warehouseCode,
      String(item.availableQuantity),
      String(item.reservedQuantity),
      String(item.activeBatches),
      String(item.lowStockProducts),
      String(item.nearExpiryBatches),
      item.warehouseId
    ])
  ];

  return `${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_X = 50;
const PDF_MARGIN_TOP = 50;
const PDF_MARGIN_BOTTOM = 50;
const PDF_START_Y = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

type PdfFont = "F1" | "F2";
type PdfTextLine = {
  font?: PdfFont;
  fontSize?: number;
  gapAfter?: number;
  text: string;
};
type PdfPlacedLine = Required<Omit<PdfTextLine, "gapAfter">> & {
  x: number;
  y: number;
};

function renderDashboardPdf(report: DashboardReport) {
  const pages = paginatePdfLines(buildDashboardPdfLines(report));
  const kids = pages
    .map((_, index) => `${getPdfPageObjectNumber(index)} 0 R`)
    .join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  for (const [index, page] of pages.entries()) {
    const pageObjectNumber = getPdfPageObjectNumber(index);
    const contentObjectNumber = getPdfContentObjectNumber(index);
    const content = buildPdfPageContent(page, index + 1, pages.length);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
    );
  }

  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");

  for (let index = 1; index < offsets.length; index += 1) {
    chunks.push(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return Buffer.from(chunks.join(""), "utf8");
}

function buildDashboardPdfLines(report: DashboardReport): PdfTextLine[] {
  return [
    { font: "F2", fontSize: 20, gapAfter: 8, text: "Dashboard Report" },
    { text: `Date range: ${report.filters.dateFrom ?? "All"} to ${report.filters.dateTo ?? "Today"}` },
    { text: `Warehouse: ${report.filters.warehouseId ?? "All visible warehouses"}` },
    { text: `Order status: ${report.filters.orderStatus ?? "All statuses"}` },
    { text: `Payment status: ${report.filters.paymentStatus ?? "All payment statuses"}` },
    { gapAfter: 8, text: `Near expiry window: ${report.filters.nearExpiryDays} days` },
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Cards" },
    ...[
      `Total orders: ${report.cards.totalOrders}`,
      `Today orders: ${report.cards.todayOrders}`,
      `Revenue: ${formatMoney(report.cards.revenue)}`,
      `Pending orders: ${report.cards.pendingOrders}`,
      `Low stock products: ${report.cards.lowStockProducts}`,
      `Near expiry batches: ${report.cards.nearExpiryBatches}`,
      `Active customers: ${report.cards.activeCustomers}`,
      `Active delivery partners: ${report.cards.activeDeliveryPartners}`,
      `Active warehouses: ${report.cards.activeWarehouses}`
    ].map((text): PdfTextLine => ({ text })),
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Top selling products" },
    ...pdfRows(
      report.charts.topSellingProducts,
      (item, index) =>
        `${index + 1}. ${item.name} | SKU: ${item.sku} | Qty: ${item.quantity} | Revenue: ${formatMoney(item.revenue)}`
    ),
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Stock alerts" },
    ...pdfRows(
      report.charts.stockAlerts,
      (item) =>
        `${item.warehouseName} (${item.warehouseCode}) | Low stock: ${item.lowStockProducts} | Near expiry: ${item.nearExpiryBatches}`
    ),
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Warehouse stock summary" },
    ...pdfRows(
      report.charts.warehouseStockSummary,
      (item) =>
        `${item.warehouseName} (${item.warehouseCode}) | Available: ${item.availableQuantity} | Reserved: ${item.reservedQuantity} | Batches: ${item.activeBatches}`
    ),
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Orders by day" },
    ...pdfRows(
      report.charts.ordersByDay,
      (item) => `${item.date}: ${item.orders} orders`
    ),
    { font: "F2", fontSize: 13, gapAfter: 4, text: "Revenue by day" },
    ...pdfRows(
      report.charts.revenueByDay,
      (item) => `${item.date}: ${formatMoney(item.revenue)}`
    )
  ];
}

function pdfRows<T>(items: T[], render: (item: T, index: number) => string) {
  if (items.length === 0) {
    return [{ gapAfter: 4, text: "No data for this section." }];
  }

  return items.flatMap((item, index) =>
    wrapPdfText(render(item, index), 105).map((text): PdfTextLine => ({
      gapAfter: 1,
      text
    }))
  );
}

function paginatePdfLines(lines: PdfTextLine[]) {
  const pages: PdfPlacedLine[][] = [];
  let page: PdfPlacedLine[] = [];
  let y = PDF_START_Y;

  for (const line of lines) {
    const fontSize = line.fontSize ?? 10;
    const lineHeight = fontSize + 4;

    if (y - lineHeight < PDF_MARGIN_BOTTOM && page.length > 0) {
      pages.push(page);
      page = [];
      y = PDF_START_Y;
    }

    page.push({
      font: line.font ?? "F1",
      fontSize,
      text: line.text,
      x: PDF_MARGIN_X,
      y
    });
    y -= lineHeight + (line.gapAfter ?? 0);
  }

  if (page.length > 0) {
    pages.push(page);
  }

  const emptyPage: PdfPlacedLine[] = [{
    font: "F1",
    fontSize: 10,
    text: "No report data.",
    x: PDF_MARGIN_X,
    y: PDF_START_Y
  }];

  return pages.length > 0 ? pages : [emptyPage];
}

function buildPdfPageContent(
  page: PdfPlacedLine[],
  pageNumber: number,
  pageCount: number
) {
  const lines = page.flatMap((line) => [
    `BT /${line.font} ${line.fontSize} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`
  ]);
  lines.push(
    `BT /F1 8 Tf ${PDF_MARGIN_X} 24 Td (${escapePdfText(`Page ${pageNumber} of ${pageCount}`)}) Tj ET`
  );

  return lines.join("\n");
}

function wrapPdfText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function getPdfPageObjectNumber(pageIndex: number) {
  return 5 + pageIndex * 2;
}

function getPdfContentObjectNumber(pageIndex: number) {
  return getPdfPageObjectNumber(pageIndex) + 1;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
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

function orderStatusSql(column: Prisma.Sql, status: OrderStatus | undefined) {
  return status
    ? Prisma.sql`AND ${column} = ${status}::"OrderStatus"`
    : Prisma.empty;
}

function paymentStatusSql(column: Prisma.Sql, status: PaymentStatus | undefined) {
  return status
    ? Prisma.sql`AND ${column} = ${status}::"PaymentStatus"`
    : Prisma.empty;
}

function pendingStatusFilter(status: OrderStatus) {
  return PENDING_ORDER_STATUSES.includes(status) ? [status] : [];
}
