import type { QueryParams } from "./admin-api";
import type { DispatchQueueOrder } from "./delivery-management";
import type { InventorySummary } from "./inventory-management";

export const WAREHOUSE_DASHBOARD_RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" }
] as const;

export type WarehouseDashboardRangeDays = (typeof WAREHOUSE_DASHBOARD_RANGES)[number]["days"];

/** How often the dashboard refreshes while it is open. */
export const WAREHOUSE_DASHBOARD_REFRESH_MS = 30_000;

export type WarehouseDashboardWarehouse = {
  city: string;
  code: string;
  id: string;
  name: string;
  state: string;
  status: string;
};

export type WarehouseDashboard = {
  dispatch: {
    awaitingPickup: number;
    deliveredToday: number;
    failedToday: number;
    inTransit: number;
    oldestReadySince: string | null;
    readyToDispatch: number;
  };
  filters: { dateFrom: string; dateTo: string; warehouseId: string | null };
  fulfillment: {
    cancelled: number;
    delivered: number;
    deliveryAttempts: number;
    deliverySuccessRate: number | null;
    fulfillmentRate: number | null;
    inProgress: number;
    ordersPlaced: number;
  };
  generatedAt: string;
  queues: {
    activeDeliveries: Array<{
      assignedAt: string;
      id: string;
      orderId: string;
      orderNumber: string;
      partnerMobile: string;
      partnerName: string;
      status: string;
      updatedAt: string;
      warehouseName: string | null;
    }>;
    dispatch: DispatchQueueOrder[];
    lowStock: Array<{
      availableQuantity: number;
      id: string;
      lowStockThreshold: number;
      productId: string;
      productName: string;
      sku: string;
      status: "LOW_STOCK" | "OUT_OF_STOCK";
      variantId: string | null;
      variantName: string | null;
      warehouseId: string;
      warehouseName: string;
    }>;
    riders: Array<{
      activeDeliveries: number;
      fullName: string;
      id: string;
      isOnline: boolean;
      lastSeenAt: string | null;
      mobileNumber: string;
      vehicleNumber: string | null;
    }>;
  };
  riders: { assigned: number; available: number; onDelivery: number; online: number };
  stock: InventorySummary;
  todayDate: string;
  warehouse: WarehouseDashboardWarehouse | null;
  warehouseOptions: WarehouseDashboardWarehouse[];
};

export function buildWarehouseDashboardQuery(
  warehouseId: string,
  rangeDays: WarehouseDashboardRangeDays,
  now = new Date()
): QueryParams {
  const from = new Date(now);
  from.setDate(from.getDate() - (rangeDays - 1));

  return {
    dateFrom: formatDateInput(from),
    dateTo: formatDateInput(now),
    warehouseId: warehouseId || undefined
  };
}

/** "Waiting 3h 20m" style age, from the oldest order's placement time. */
export function formatWaitingTime(since: string | null, now = new Date()) {
  if (!since) {
    return null;
  }

  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 48) {
    return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

/** "5 min ago" style label for live activity, worded to follow "Updated" or "Last seen". */
export function formatRelativeTime(value: string, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;

  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function formatRate(value: number | null) {
  return value === null ? "No data yet" : `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

export function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}


export function withWarehouse(path: string, warehouseId: string, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams(params);

  if (warehouseId) {
    searchParams.set("warehouseId", warehouseId);
  }

  const query = searchParams.toString();

  return query ? `${path}?${query}` : path;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
