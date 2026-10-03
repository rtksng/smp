import type { ReportExportData } from "@surgical/types";
import type { QueryParams } from "./admin-api";
import { ADMIN_PERMISSION } from "./permissions";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  formatOrderLabel,
  type OrderStatus,
  type PaymentStatus
} from "./order-management";
import { buildWarehouseDetailPath } from "./warehouse-management";

export const REPORT_ORDER_STATUSES = ORDER_STATUSES;
export const REPORT_PAYMENT_STATUSES = PAYMENT_STATUSES;
export const REPORT_EXPORT_FORMATS = ["csv", "pdf"] as const;
export const REPORT_VIEWS = ["overview", "orders", "sales", "products", "inventory", "warehouses"] as const;

export type ReportOrderStatus = OrderStatus;
export type ReportPaymentStatus = PaymentStatus;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];
export type ReportView = (typeof REPORT_VIEWS)[number];
export type ReportDrilldownTarget =
  | "customers"
  | "inventory-low-stock"
  | "inventory-near-expiry"
  | "orders"
  | "orders-pending"
  | "product"
  | "warehouse";

export type DashboardReportFilters = {
  dateFrom: string;
  dateTo: string;
  nearExpiryDays: string;
  orderStatus: "" | ReportOrderStatus;
  paymentStatus: "" | ReportPaymentStatus;
  warehouseId: string;
};

export type DashboardCards = {
  activeCustomers: number;
  activeDeliveryPartners: number;
  activeWarehouses: number;
  lowStockProducts: number;
  nearExpiryBatches: number;
  pendingOrders: number;
  revenue: number;
  todayOrders: number;
  totalOrders: number;
};

export type OrdersByDayPoint = {
  date: string;
  orders: number;
};

export type RevenueByDayPoint = {
  date: string;
  revenue: number;
};

export type TopSellingProductPoint = {
  name: string;
  productId: string;
  quantity: number;
  revenue: number;
  sku: string;
};

export type StockAlertPoint = {
  lowStockProducts: number;
  nearExpiryBatches: number;
  warehouseCode: string;
  warehouseId: string;
  warehouseName: string;
};

export type WarehouseStockSummaryPoint = StockAlertPoint & {
  activeBatches: number;
  availableQuantity: number;
  reservedQuantity: number;
};

export type DashboardCharts = {
  ordersByDay: OrdersByDayPoint[];
  revenueByDay: RevenueByDayPoint[];
  stockAlerts: StockAlertPoint[];
  topSellingProducts: TopSellingProductPoint[];
  warehouseStockSummary: WarehouseStockSummaryPoint[];
};

export type DashboardReport = {
  cards: DashboardCards;
  charts: DashboardCharts;
  todayDate?: string;
  warehouseOptions?: Array<{ id: string; name: string; code: string }>;
  filters?: {
    dateFrom: string | null;
    dateTo: string | null;
    nearExpiryDays: number;
    orderStatus: ReportOrderStatus | null;
    paymentStatus: ReportPaymentStatus | null;
    warehouseId: string | null;
  };
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

const numberFormatter = new Intl.NumberFormat("en-IN");

export function createDefaultReportFilters(now = new Date()): DashboardReportFilters {
  const from = new Date(now);
  from.setDate(from.getDate() - 29);

  return {
    dateFrom: formatDateInput(from),
    dateTo: formatDateInput(now),
    nearExpiryDays: "30",
    orderStatus: "",
    paymentStatus: "",
    warehouseId: ""
  };
}

export function buildDashboardReportQuery(filters: DashboardReportFilters): QueryParams {
  const nearExpiryDays = Number(filters.nearExpiryDays);

  return {
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    nearExpiryDays:
      Number.isInteger(nearExpiryDays) && nearExpiryDays >= 1 && nearExpiryDays <= 365
        ? nearExpiryDays
        : undefined,
    orderStatus: filters.orderStatus || undefined,
    paymentStatus: filters.paymentStatus || undefined,
    warehouseId: trimmedOrUndefined(filters.warehouseId)
  };
}

export function buildReportDrilldownHref(
  target: ReportDrilldownTarget,
  filters: DashboardReportFilters,
  resourceId?: string
) {
  switch (target) {
    case "customers":
      return "/customers";
    case "inventory-low-stock":
      return buildRelativePath("/inventory", {
        lowStock: true,
        warehouseId: resourceId || filters.warehouseId || undefined
      });
    case "inventory-near-expiry":
      return buildRelativePath("/inventory", {
        nearExpiry: true,
        nearExpiryDays: buildDashboardReportQuery(filters).nearExpiryDays ?? 30,
        warehouseId: resourceId || filters.warehouseId || undefined
      });
    case "orders":
    case "orders-pending":
      return buildRelativePath("/orders", {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        pendingOnly: target === "orders-pending" ? true : undefined,
        status: filters.orderStatus || undefined,
        warehouseId: filters.warehouseId || undefined
      });
    case "product":
      return resourceId ? `/products/${encodeURIComponent(resourceId)}/edit` : "/products";
    case "warehouse":
      // A report row opens that warehouse; report-wide links open the list filtered by the report.
      return resourceId
        ? buildWarehouseDetailPath(resourceId)
        : buildRelativePath("/warehouses", {
            warehouseId: filters.warehouseId || undefined
          });
  }
}

export async function downloadDashboardReportExport(
  filters: DashboardReportFilters,
  format: ReportExportFormat,
  report: DashboardReport,
  view: ReportView = "overview"
) {
  const snapshot = structuredClone(buildReportExportData(filters, report));
  const { renderReportExport } = await import("@surgical/types");
  const exported = renderReportExport(snapshot, view, format);
  const blob = new Blob([new Uint8Array(exported.body)], { type: exported.contentType });

  triggerBrowserDownload(blob, exported.filename);

  return exported.filename;
}

export function getReportWarehouseOptions(report: DashboardReport | undefined) {
  return report?.warehouseOptions ?? report?.charts.warehouseStockSummary.map((warehouse) => ({
    id: warehouse.warehouseId,
    name: warehouse.warehouseName,
    code: warehouse.warehouseCode
  })) ?? [];
}

export function buildReportExportData(
  filters: DashboardReportFilters,
  report: DashboardReport
): ReportExportData {
  const resolved = resolveReportFilters(filters, report);

  return {
    cards: report.cards,
    charts: report.charts,
    todayDate: report.todayDate ?? new Date().toISOString().slice(0, 10),
    warehouseOptions: getReportWarehouseOptions(report),
    filters: {
      dateFrom: resolved.dateFrom,
      dateTo: resolved.dateTo,
      nearExpiryDays: Number(buildDashboardReportQuery(resolved).nearExpiryDays ?? 30),
      orderStatus: resolved.orderStatus || null,
      paymentStatus: resolved.paymentStatus || null,
      warehouseId: resolved.warehouseId || null
    }
  };
}

export function resolveReportFilters(
  filters: DashboardReportFilters,
  report: DashboardReport | undefined
): DashboardReportFilters {
  return {
    ...filters,
    dateFrom: report?.filters?.dateFrom?.slice(0, 10) ?? filters.dateFrom,
    dateTo: report?.filters?.dateTo?.slice(0, 10) ?? filters.dateTo,
    nearExpiryDays: String(report?.filters?.nearExpiryDays ?? filters.nearExpiryDays),
    orderStatus: report?.filters ? report.filters.orderStatus ?? "" : filters.orderStatus,
    paymentStatus: report?.filters ? report.filters.paymentStatus ?? "" : filters.paymentStatus,
    warehouseId: report?.filters ? report.filters.warehouseId ?? "" : filters.warehouseId
  };
}

export function getReportRevenueContext(filters: DashboardReportFilters) {
  const paymentStatus = filters.paymentStatus || "PAID";
  const statusLabel = formatReportStatusLabel(paymentStatus);

  return {
    paymentStatus,
    label: paymentStatus === "PAID" ? "Paid revenue" : `${statusLabel} order value`,
    orderLinkLabel: `Open ${statusLabel.toLowerCase()} orders`
  };
}

export function buildTodayOrdersHref(filters: DashboardReportFilters, todayDate: string) {
  return buildReportDrilldownHref("orders", {
    ...filters,
    dateFrom: todayDate,
    dateTo: todayDate
  });
}

export function canAccessReportHref(href: string, hasPermission: (permission: string) => boolean) {
  const route = href.split(/[?#]/, 1)[0] ?? "";
  const requiredPermission = [
    ["/orders", ADMIN_PERMISSION.OrdersRead],
    ["/inventory", ADMIN_PERMISSION.InventoryRead],
    ["/products", ADMIN_PERMISSION.ProductsRead],
    ["/warehouses", ADMIN_PERMISSION.WarehouseRead],
    ["/customers", ADMIN_PERMISSION.UsersRead],
    ["/reports", ADMIN_PERMISSION.ReportsRead]
  ].find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`))?.[1];

  return Boolean(requiredPermission && hasPermission(requiredPermission));
}

export function reportDateRangeError(filters: DashboardReportFilters) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return "Start date must be before end date.";
  }

  const days = Number(filters.nearExpiryDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return "Expiry window must be a whole number between 1 and 365 days.";
  }

  return null;
}

export function getDashboardEmptyState(report: DashboardReport | undefined) {
  if (!report) {
    return null;
  }

  const hasCardData = Object.values(report.cards).some((value) => value > 0);
  const hasChartData = Object.values(report.charts).some((values) => values.length > 0);

  return hasCardData || hasChartData
    ? null
    : "No report data matches the selected filters.";
}

export function formatReportCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatReportNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatReportStatusLabel(value: string) {
  return formatOrderLabel(value);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function trimmedOrUndefined(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function buildRelativePath(path: string, query: QueryParams) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
