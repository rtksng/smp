import { describe, expect, it, vi } from "vitest";
import type { AdminApiRequestOptions } from "./admin-api";
import {
  loadAdminNotificationFeed,
  type AdminNotificationKind
} from "./admin-notification-feed";
import { ADMIN_PERMISSION } from "./permissions";

const timestamp = "2026-09-04T09:00:00.000Z";
const roleCases: Array<{
  name: string;
  permissions: string[];
  kinds: AdminNotificationKind[];
}> = [
  {
    name: "SuperAdmin",
    permissions: Object.values(ADMIN_PERMISSION),
    kinds: [
      "order",
      "return",
      "quote",
      "inventory",
      "delivery",
      "feedback",
      "warehouse",
      "customer"
    ]
  },
  {
    name: "InventoryManager",
    permissions: [
      "products.create",
      "products.read",
      "products.update",
      "inventory.read",
      "inventory.update",
      "warehouse.read",
      "reports.read"
    ],
    kinds: ["feedback", "inventory", "warehouse"]
  },
  {
    name: "WarehouseManager",
    permissions: [
      "inventory.read",
      "inventory.update",
      "warehouse.read",
      "warehouse.manage",
      "warehouse.staff.manage",
      "delivery.read",
      "reports.read"
    ],
    kinds: ["inventory", "warehouse", "delivery"]
  },
  {
    name: "OrderManager",
    permissions: [
      "orders.read",
      "orders.update",
      "orders.cancel",
      "users.read",
      "users.update",
      "delivery.read",
      "reports.read"
    ],
    kinds: ["order", "return", "customer", "delivery"]
  },
  {
    name: "DeliveryManager",
    permissions: [
      "orders.read",
      "warehouse.read",
      "delivery.read",
      "delivery.assign",
      "reports.read"
    ],
    kinds: ["order", "return", "warehouse", "delivery"]
  },
  {
    name: "Support",
    permissions: [
      "products.read",
      "orders.read",
      "users.read",
      "users.update",
      "delivery.read"
    ],
    kinds: ["feedback", "order", "return", "customer", "delivery"]
  },
  {
    name: "Custom delivery reader",
    permissions: ["delivery.read"],
    kinds: ["delivery"]
  },
  {
    name: "Custom product reader",
    permissions: ["products.read"],
    kinds: ["feedback"]
  },
  {
    name: "Custom warehouse reader",
    permissions: ["warehouse.read"],
    kinds: ["warehouse"]
  },
  { name: "Custom customer reader", permissions: ["users.read"], kinds: ["customer"] },
  { name: "Custom report reader", permissions: ["reports.read"], kinds: ["report"] },
  {
    name: "Custom write-only role",
    permissions: [
      "products.update",
      "orders.update",
      "inventory.update",
      "delivery.assign"
    ],
    kinds: []
  }
];

function makeRoleApi(count = 1) {
  const request = vi.fn(
    async (path: string, options?: AdminApiRequestOptions): Promise<unknown> => {
      const items = Array.from({ length: count }, (_, index) => {
        const base = {
          id: `item-${index}`,
          createdAt: timestamp,
          updatedAt: timestamp
        };
        switch (path) {
          case "/admin/orders":
            return {
              ...base,
              orderNumber: `SMP-${index}`,
              status: "CREATED",
              customer: { firstName: "Asha", lastName: null },
              refunds: []
            };
          case "/admin/returns-refunds":
            return {
              ...base,
              orderNumber: `SMP-${index}`,
              refunds: [
                { ...base, id: `refund-${index}`, status: "PENDING", reason: "Damaged" }
              ]
            };
          case "/admin/quote-requests":
            return { ...base, status: "NEW", name: "Clinic", message: "Please quote" };
          case "/admin/inventory/low-stock":
            return { ...base, availableQuantity: 1, lowStockThreshold: 3 };
          case "/admin/inventory/near-expiry":
            return { ...base, quantity: 2, expiryDate: "2026-09-10T00:00:00Z" };
          case "/admin/delivery/assignments":
            return {
              ...base,
              status: "FAILED",
              orderNumber: `SMP-${index}`,
              failureReason: "Customer unavailable"
            };
          case "/admin/delivery-partners":
            return { ...base, status: "PENDING_VERIFICATION", fullName: "Partner" };
          case "/admin/product-feedback":
            return {
              ...base,
              productId: "product-1",
              productName: "Forceps",
              customerName: "Asha",
              type: options?.query?.type,
              status: options?.query?.status,
              question: "Available?",
              comment: "Good"
            };
          case "/admin/warehouses":
            return { ...base, name: "Warehouse", code: "WH-1", status: "ACTIVE" };
          case "/admin/customers":
            return { ...base, name: "Customer", isActive: true };
          default:
            return base;
        }
      });
      if (path === "/admin/reports/dashboard")
        return {
          cards: { pendingOrders: 3, lowStockProducts: 2, nearExpiryBatches: 1 }
        };
      return { items, pagination: { total: count } };
    }
  );
  return {
    request,
    api: {
      request: request as <T>(
        path: string,
        options?: AdminApiRequestOptions
      ) => Promise<T>
    }
  };
}

function permissionForPath(href: string) {
  if (href.startsWith("/orders/")) return "orders.read";
  if (href.startsWith("/quote-requests/")) return "settings.manage";
  if (href.startsWith("/inventory")) return "inventory.read";
  if (href.startsWith("/delivery/")) return "delivery.read";
  if (href.startsWith("/product-feedback/")) return "products.read";
  if (href === "/warehouses" || href.startsWith("/warehouses?") || href.startsWith("/warehouses/")) return "warehouse.read";
  if (href.startsWith("/customers/")) return "users.read";
  if (href.startsWith("/reports/")) return "reports.read";
  throw new Error(`Unknown notification destination ${href}`);
}

describe("notification permission coverage", () => {
  it.each(roleCases)(
    "loads only useful permitted alerts for $name",
    async ({ permissions, kinds }) => {
      const { api, request } = makeRoleApi();
      const feed = await loadAdminNotificationFeed(api, permissions);
      expect(feed.failedSources).toEqual([]);
      expect([...new Set(feed.items.map((item) => item.kind))].sort()).toEqual(
        [...kinds].sort()
      );
      for (const item of feed.items)
        expect(permissions).toContain(permissionForPath(item.href));
      const endpointPermissions: Record<string, string> = {
        "/admin/orders": "orders.read",
        "/admin/returns-refunds": "orders.read",
        "/admin/quote-requests": "settings.manage",
        "/admin/inventory/low-stock": "inventory.read",
        "/admin/inventory/near-expiry": "inventory.read",
        "/admin/delivery/assignments": "delivery.read",
        "/admin/delivery-partners": "delivery.read",
        "/admin/product-feedback": "products.read",
        "/admin/warehouses": "warehouse.read",
        "/admin/customers": "users.read",
        "/admin/reports/dashboard": "reports.read"
      };
      for (const [path] of request.mock.calls)
        expect(permissions).toContain(endpointPermissions[path]);
    }
  );

  it("keeps both inventory summaries and every source represented in a busy super-admin feed", async () => {
    const { api } = makeRoleApi(5);
    const feed = await loadAdminNotificationFeed(api, Object.values(ADMIN_PERMISSION));
    expect(feed.items).toHaveLength(20);
    expect(feed.items.some((item) => item.id.startsWith("inventory:"))).toBe(true);
    expect(feed.items.some((item) => item.id.startsWith("expiry:"))).toBe(true);
    for (const prefix of [
      "order:",
      "return:",
      "quote:",
      "delivery:",
      "partner:",
      "feedback:QUESTION:",
      "feedback:REVIEW:",
      "warehouse:",
      "customer:"
    ]) {
      expect(feed.items.some((item) => item.id.startsWith(prefix))).toBe(true);
    }
  });
});
