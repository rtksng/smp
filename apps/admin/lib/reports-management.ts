import {
  AdminApiClientError,
  buildAdminApiUrl,
  fetchAdminApi,
  type QueryParams
} from "./admin-api";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  formatOrderLabel,
  type OrderStatus,
  type PaymentStatus
} from "./order-management";

export const REPORT_ORDER_STATUSES = ORDER_STATUSES;
export const REPORT_PAYMENT_STATUSES = PAYMENT_STATUSES;
export const REPORT_EXPORT_FORMATS = ["csv", "pdf"] as const;

export type ReportOrderStatus = OrderStatus;
export type ReportPaymentStatus = PaymentStatus;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];
export type ReportDrilldownTarget =
  | "customers"
  | "inventory-low-stock"
  | "inventory-near-expiry"
  | "orders"
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

export function buildReportExportUrl(
  filters: DashboardReportFilters,
  format: ReportExportFormat
) {
  const query = buildDashboardReportQuery(filters);

  return buildRelativePath("/admin/reports/dashboard/export", {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    format,
    nearExpiryDays: query.nearExpiryDays,
    orderStatus: query.orderStatus,
    paymentStatus: query.paymentStatus,
    warehouseId: query.warehouseId
  });
}

export function dashboardReportDownloadFilename(
  filters: DashboardReportFilters,
  format: ReportExportFormat
) {
  return `dashboard-report-${filters.dateFrom || "all"}-to-${
    filters.dateTo || "today"
  }.${format}`;
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
        warehouseId: resourceId || filters.warehouseId || undefined
      });
    case "orders":
      return buildRelativePath("/orders", {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        status: filters.orderStatus || undefined,
        warehouseId: filters.warehouseId || undefined
      });
    case "product":
      return resourceId ? `/products/${encodeURIComponent(resourceId)}/edit` : "/products";
    case "warehouse":
      return buildRelativePath("/warehouses/list", {
        warehouseId: resourceId || filters.warehouseId || undefined
      });
  }
}

export async function downloadDashboardReportExport(
  filters: DashboardReportFilters,
  format: ReportExportFormat,
  accessToken: string
) {
  const response = await fetchAdminApi(
    buildAdminApiUrl(buildReportExportUrl(filters, format)),
    {
      headers: {
        Accept: format === "pdf" ? "application/pdf" : "text/csv",
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const message = await readExportErrorMessage(response);

    throw new AdminApiClientError(
      message || "Unable to export dashboard report.",
      response.status
    );
  }

  const blob = await response.blob();
  const filename =
    getDispositionFilename(response.headers.get("content-disposition")) ??
    dashboardReportDownloadFilename(filters, format);

  triggerBrowserDownload(blob, filename);

  return filename;
}

export function reportDateRangeError(filters: DashboardReportFilters) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return "Start date must be before end date.";
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

async function readExportErrorMessage(response: Response) {
  const envelope = await response.json().catch(() => null);
  const message = envelope?.error?.message;

  return Array.isArray(message) ? message.join(", ") : message;
}

function getDispositionFilename(disposition: string | null) {
  const match = disposition?.match(/filename="?(?<filename>[^";]+)"?/i);

  return match?.groups?.filename;
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
