import type { QueryParams } from "./admin-api";

export type DashboardReportFilters = {
  dateFrom: string;
  dateTo: string;
  nearExpiryDays: string;
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
    warehouseId: trimmedOrUndefined(filters.warehouseId)
  };
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
