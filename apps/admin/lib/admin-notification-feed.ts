import type { AdminApiRequestOptions } from "./admin-api";
import type { AdminCustomer } from "./customer-management";
import type {
  AdminDeliveryAssignment,
  AdminDeliveryPartner
} from "./delivery-management";
import type { InventoryStock, StockBatch } from "./inventory-management";
import type { AdminOrder, PaginatedResponse } from "./order-management";
import { ADMIN_PERMISSION, hasPermission } from "./permissions";
import type { DashboardReport } from "./reports-management";
import type { AdminProductFeedback, AdminQuoteRequest } from "./support-management";
import { buildWarehouseDetailPath, type WarehouseListResponse } from "./warehouse-management";

export type AdminNotificationKind =
  | "order"
  | "return"
  | "quote"
  | "inventory"
  | "delivery"
  | "feedback"
  | "warehouse"
  | "customer"
  | "report";

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  description: string;
  href: string;
  occurredAt: string | null;
};

export type AdminNotificationFeed = {
  items: AdminNotification[];
  failedSources: string[];
  sourceCount: number;
};

type NotificationApi = {
  request: <T>(path: string, options?: AdminApiRequestOptions) => Promise<T>;
};

const SOURCE_LIMIT = 5;
export const NOTIFICATION_FEED_LIMIT = 20;
export const NOTIFICATION_READ_LIMIT = 1000;

/** These are a bounded view of current operational alerts, not an event log. */
export async function loadAdminNotificationFeed(
  api: NotificationApi,
  permissions: readonly string[],
  signal?: AbortSignal
): Promise<AdminNotificationFeed> {
  const sources: Array<{ name: string; load: () => Promise<AdminNotification[]> }> = [];
  const baseQuery = { limit: SOURCE_LIMIT, page: 1 };

  if (hasPermission(permissions, ADMIN_PERMISSION.OrdersRead)) {
    sources.push(
      {
        name: "New orders",
        load: async () => {
          const response = await api.request<PaginatedResponse<AdminOrder>>(
            "/admin/orders",
            {
              query: { ...baseQuery, status: "CREATED" },
              signal,
              timeoutMs: 10_000
            }
          );
          return response.items.map((order) => ({
            id: `order:${order.id}:${order.status}`,
            kind: "order",
            title: `New order ${order.orderNumber}`,
            description:
              `${order.status.replaceAll("_", " ").toLowerCase()} · ${order.customer.firstName} ${order.customer.lastName ?? ""}`.trim(),
            href: `/orders/${encodeURIComponent(order.id)}`,
            occurredAt: order.updatedAt || order.createdAt
          }));
        }
      },
      {
        name: "Return requests",
        load: async () => {
          const response = await api.request<PaginatedResponse<AdminOrder>>(
            "/admin/returns-refunds",
            {
              query: { ...baseQuery, status: "PENDING" },
              signal,
              timeoutMs: 10_000
            }
          );
          return response.items.flatMap((order) => {
            const refund = order.refunds
              .filter((item) => item.status === "PENDING")
              .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
            return refund
              ? [
                  {
                    id: `return:${refund.id}:${refund.status}`,
                    kind: "return" as const,
                    title: `Return for ${order.orderNumber}`,
                    description: refund.reason || "Return request awaiting review",
                    href: `/orders/${encodeURIComponent(order.id)}`,
                    occurredAt: refund.createdAt
                  }
                ]
              : [];
          });
        }
      }
    );
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.SettingsManage)) {
    sources.push({
      name: "New quote requests",
      load: async () => {
        const response = await api.request<PaginatedResponse<AdminQuoteRequest>>(
          "/admin/quote-requests",
          {
            query: { ...baseQuery, status: "NEW" },
            signal,
            timeoutMs: 10_000
          }
        );
        return response.items.map((quote) => ({
          id: `quote:${quote.id}:${quote.status}`,
          kind: "quote",
          title: `New quote from ${quote.name}`,
          description:
            quote.organization || quote.message || "Quote request awaiting a response",
          href: `/quote-requests/${encodeURIComponent(quote.id)}`,
          occurredAt: quote.createdAt
        }));
      }
    });
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.InventoryRead)) {
    sources.push(
      {
        name: "Low stock",
        load: async () => {
          const response = await api.request<PaginatedResponse<InventoryStock>>(
            "/admin/inventory/low-stock",
            {
              query: baseQuery,
              signal,
              timeoutMs: 10_000
            }
          );
          const total = response.pagination.total;
          if (total === 0) return [];
          // Include the sampled stock state so a changed quantity raises a fresh alert.
          // Sorting keeps the read identity stable when the API returns a different order.
          const state = response.items
            .map(
              (item) => `${item.id}:${item.availableQuantity}:${item.lowStockThreshold}`
            )
            .sort()
            .join("|");
          return [
            {
              id: `inventory:${total}:${state}`,
              kind: "inventory",
              title: `${total} low-stock ${total === 1 ? "record" : "records"}`,
              description:
                "Stock is at or below its reorder threshold. Review inventory.",
              href: "/inventory?lowStock=true",
              occurredAt: null
            }
          ];
        }
      },
      {
        name: "Expiring stock",
        load: async () => {
          const response = await api.request<PaginatedResponse<StockBatch>>(
            "/admin/inventory/near-expiry",
            {
              query: { ...baseQuery, days: 30 },
              signal,
              timeoutMs: 10_000
            }
          );
          const total = response.pagination.total;
          if (total === 0) return [];
          const state = response.items
            .map((item) => `${item.id}:${item.quantity}:${item.expiryDate}`)
            .sort()
            .join("|");
          return [
            {
              id: `expiry:${total}:${state}`,
              kind: "inventory",
              title: `${total} ${total === 1 ? "batch expires" : "batches expire"} within 30 days`,
              description: "Review stock batches approaching their expiry date.",
              href: "/inventory?nearExpiry=true&nearExpiryDays=30",
              occurredAt: null
            }
          ];
        }
      }
    );
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.DeliveryRead)) {
    sources.push(
      {
        name: "Failed deliveries",
        load: async () => {
          const response = await api.request<
            PaginatedResponse<AdminDeliveryAssignment>
          >("/admin/delivery/assignments", {
            query: { ...baseQuery, status: "FAILED" },
            signal,
            timeoutMs: 10_000
          });
          return response.items.map((assignment) => ({
            id: `delivery:${assignment.id}:${assignment.status}:${assignment.updatedAt}`,
            kind: "delivery",
            title: `Delivery failed for ${assignment.orderNumber}`,
            description:
              assignment.failureReason || "Review the failed delivery assignment.",
            href: `/delivery/assignments?status=FAILED&search=${encodeURIComponent(assignment.orderNumber)}`,
            occurredAt: assignment.updatedAt || assignment.createdAt
          }));
        }
      },
      {
        name: "Partner verification",
        load: async () => {
          const response = await api.request<PaginatedResponse<AdminDeliveryPartner>>(
            "/admin/delivery-partners",
            {
              query: { ...baseQuery, status: "PENDING_VERIFICATION" },
              signal,
              timeoutMs: 10_000
            }
          );
          return response.items.map((partner) => ({
            id: `partner:${partner.id}:${partner.status}`,
            kind: "delivery",
            title: `Partner registration: ${partner.fullName}`,
            description: "Delivery partner registration awaiting verification.",
            href: `/delivery/partners/${encodeURIComponent(partner.id)}`,
            occurredAt: partner.createdAt
          }));
        }
      }
    );
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.ProductsRead)) {
    for (const type of ["QUESTION", "REVIEW"] as const) {
      const status = type === "QUESTION" ? "PENDING" : "PENDING_REVIEW";
      sources.push({
        name: type === "QUESTION" ? "Product questions" : "Product reviews",
        load: async () => {
          const response = await api.request<PaginatedResponse<AdminProductFeedback>>(
            "/admin/product-feedback",
            {
              query: { ...baseQuery, type, status },
              signal,
              timeoutMs: 10_000
            }
          );
          return response.items.map((feedback) => ({
            id: `feedback:${feedback.type}:${feedback.id}:${feedback.status}`,
            kind: "feedback",
            title: `${type === "QUESTION" ? "Question" : "Review"}: ${feedback.productName}`,
            description:
              feedback.question ||
              feedback.comment ||
              feedback.title ||
              `From ${feedback.customerName}`,
            href: `/product-feedback/${type === "QUESTION" ? "questions" : "reviews"}?status=${status}&productId=${encodeURIComponent(feedback.productId)}`,
            occurredAt: feedback.createdAt
          }));
        }
      });
    }
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.WarehouseRead)) {
    sources.push({
      name: "New warehouses",
      load: async () => {
        const response = await api.request<WarehouseListResponse>("/admin/warehouses", {
          query: baseQuery,
          signal,
          timeoutMs: 10_000
        });
        return response.items.map((warehouse) => ({
          id: `warehouse:${warehouse.id}:created`,
          kind: "warehouse",
          title: `Warehouse added: ${warehouse.name}`,
          description: `Warehouse ${warehouse.code} was created.`,
          href: buildWarehouseDetailPath(warehouse.id),
          occurredAt: new Date(warehouse.createdAt).toISOString()
        }));
      }
    });
  }

  if (hasPermission(permissions, ADMIN_PERMISSION.UsersRead)) {
    sources.push({
      name: "Customer registrations",
      load: async () => {
        const response = await api.request<PaginatedResponse<AdminCustomer>>(
          "/admin/customers",
          {
            query: baseQuery,
            signal,
            timeoutMs: 10_000
          }
        );
        return response.items.map((customer) => ({
          id: `customer:${customer.id}:registered`,
          kind: "customer",
          title: `Customer registered: ${customer.name}`,
          description: "A customer account was created.",
          href: `/customers/${encodeURIComponent(customer.id)}`,
          occurredAt: customer.createdAt
        }));
      }
    });
  }

  if (
    sources.length === 0 &&
    hasPermission(permissions, ADMIN_PERMISSION.ReportsRead)
  ) {
    sources.push({
      name: "Operational reports",
      load: async () => {
        const report = await api.request<DashboardReport>("/admin/reports/dashboard", {
          query: { nearExpiryDays: 30 },
          signal,
          timeoutMs: 10_000
        });
        const summaries = [
          {
            key: "pendingOrders",
            count: report.cards.pendingOrders,
            title: "orders awaiting completion",
            href: "/reports/orders"
          },
          {
            key: "lowStock",
            count: report.cards.lowStockProducts,
            title: "low-stock products",
            href: "/reports/inventory"
          },
          {
            key: "nearExpiry",
            count: report.cards.nearExpiryBatches,
            title: "batches expiring within 30 days",
            href: "/reports/inventory"
          }
        ];
        return summaries
          .filter((summary) => summary.count > 0)
          .map((summary) => ({
            id: `report:${summary.key}:${summary.count}`,
            kind: "report",
            title: `${summary.count} ${summary.title}`,
            description: "Open the report to review the current summary.",
            href: summary.href,
            occurredAt: null
          }));
      }
    });
  }

  const results = await Promise.allSettled(sources.map((source) => source.load()));
  signal?.throwIfAborted();
  const items: AdminNotification[] = [];
  const sourceHighlights: AdminNotification[] = [];
  const failedSources: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const sorted = result.value.sort(
        (a, b) => notificationTime(b) - notificationTime(a) || a.id.localeCompare(b.id)
      );
      items.push(...sorted);
      if (sorted[0]) sourceHighlights.push(sorted[0]);
    } else failedSources.push(sources[index]?.name ?? "Notifications");
  });
  // Reserve one place per source so undated stock summaries are never crowded out.
  const highlightedIds = new Set(sourceHighlights.map((item) => item.id));
  const remaining = items
    .filter((item) => !highlightedIds.has(item.id))
    .sort(
      (a, b) => notificationTime(b) - notificationTime(a) || a.id.localeCompare(b.id)
    );
  const selected = [
    ...sourceHighlights,
    ...remaining.slice(
      0,
      Math.max(0, NOTIFICATION_FEED_LIMIT - sourceHighlights.length)
    )
  ];
  selected.sort(
    (a, b) => notificationTime(b) - notificationTime(a) || a.id.localeCompare(b.id)
  );
  return { items: selected, failedSources, sourceCount: sources.length };
}

function notificationTime(notification: AdminNotification) {
  return notification.occurredAt ? Date.parse(notification.occurredAt) || 0 : 0;
}

export function notificationReadStorageKey(adminId: string) {
  return `smp:admin-notification-reads:v1:${adminId}`;
}

export function parseNotificationReadIds(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))].slice(
          -NOTIFICATION_READ_LIMIT
        )
      : [];
  } catch {
    return [];
  }
}

export function mergeNotificationReadIds(
  existing: readonly string[],
  added: readonly string[]
) {
  return [...new Set([...existing, ...added])].slice(-NOTIFICATION_READ_LIMIT);
}
