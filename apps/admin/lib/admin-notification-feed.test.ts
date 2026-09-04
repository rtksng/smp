import { describe, expect, it, vi } from "vitest";
import type { AdminApiRequestOptions } from "./admin-api";
import {
  loadAdminNotificationFeed,
  mergeNotificationReadIds,
  notificationReadStorageKey,
  parseNotificationReadIds,
  NOTIFICATION_READ_LIMIT
} from "./admin-notification-feed";

const pendingOrder = {
  id: "order-1",
  orderNumber: "SMP-1001",
  status: "CREATED",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:00:00.000Z",
  customer: { firstName: "Asha", lastName: null },
  refunds: []
};
const lowStock = { id: "stock-1", availableQuantity: 3, lowStockThreshold: 5 };
function page(items: unknown[], total = items.length) {
  return { items, pagination: { total } };
}
function makeApi(responses: Record<string, unknown>) {
  const request = vi.fn(async (path: string, _options?: AdminApiRequestOptions) => {
    if (path === "/admin/inventory/near-expiry" && !(path in responses))
      return page([]);
    const response = responses[path];
    if (response instanceof Error) throw response;
    if (!response) throw new Error(`Unexpected request: ${path}`);
    return response;
  });
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

describe("admin notification feed", () => {
  it("only calls sources allowed by the current role", async () => {
    const { api, request } = makeApi({
      "/admin/inventory/low-stock": page([lowStock], 12)
    });
    const result = await loadAdminNotificationFeed(api, ["inventory.read"]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith("/admin/inventory/low-stock", {
      query: { limit: 5, page: 1 },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(result).toMatchObject({ failedSources: [], sourceCount: 2 });
    expect(result.items[0]).toMatchObject({
      title: "12 low-stock records",
      href: "/inventory?lowStock=true",
      occurredAt: null
    });
    request.mockClear();
    expect(await loadAdminNotificationFeed(api, [])).toEqual({
      items: [],
      failedSources: [],
      sourceCount: 0
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("retains successful sources when another endpoint fails", async () => {
    const { api, request } = makeApi({
      "/admin/orders": page([pendingOrder]),
      "/admin/returns-refunds": new Error("Forbidden"),
      "/admin/quote-requests": page([
        {
          id: "quote-1",
          status: "NEW",
          name: "Clinic",
          organization: null,
          message: "Need supplies",
          createdAt: "2026-09-03T10:00:00.000Z"
        }
      ])
    });
    const result = await loadAdminNotificationFeed(api, [
      "orders.read",
      "settings.manage"
    ]);
    expect(result.failedSources).toEqual(["Return requests"]);
    expect(result.items.map((item) => item.kind)).toEqual(["quote", "order"]);
    expect(result.items.map((item) => item.href)).toEqual([
      "/quote-requests/quote-1",
      "/orders/order-1"
    ]);
    expect(request).toHaveBeenCalledWith("/admin/orders", {
      query: { limit: 5, page: 1, status: "CREATED" },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(request).toHaveBeenCalledWith("/admin/returns-refunds", {
      query: { limit: 5, page: 1, status: "PENDING" },
      signal: undefined,
      timeoutMs: 10_000
    });
  });

  it("uses the pending refund identity and removes orders no longer awaiting confirmation", async () => {
    const returnOrder = {
      ...pendingOrder,
      refunds: [
        { id: "done", status: "COMPLETED", createdAt: "2026-09-04T10:00:00.000Z" },
        {
          id: "pending",
          status: "PENDING",
          reason: "Damaged",
          createdAt: "2026-09-03T10:00:00.000Z"
        }
      ]
    };
    const responses = {
      "/admin/orders": page([pendingOrder]),
      "/admin/returns-refunds": page([returnOrder])
    };
    const { api } = makeApi(responses);
    const first = await loadAdminNotificationFeed(api, ["orders.read"]);
    expect(first.items[0]).toMatchObject({
      id: "return:pending:PENDING",
      description: "Damaged"
    });
    responses["/admin/orders"] = page([]);
    const second = await loadAdminNotificationFeed(api, ["orders.read"]);
    expect(first.items.find((item) => item.kind === "order")).toBeDefined();
    expect(second.items.find((item) => item.kind === "order")).toBeUndefined();
  });

  it("keeps stock read identity stable across ordering but changes it for quantities", async () => {
    const otherStock = { ...lowStock, id: "stock-2" };
    const responses = { "/admin/inventory/low-stock": page([lowStock, otherStock]) };
    const { api } = makeApi(responses);
    const first = await loadAdminNotificationFeed(api, ["inventory.read"]);
    expect(first.items).toHaveLength(1);
    responses["/admin/inventory/low-stock"] = page([otherStock, lowStock]);
    expect(
      (await loadAdminNotificationFeed(api, ["inventory.read"])).items[0]?.id
    ).toBe(first.items[0]?.id);
    responses["/admin/inventory/low-stock"] = page([
      otherStock,
      { ...lowStock, availableQuantity: 1 }
    ]);
    expect(
      (await loadAdminNotificationFeed(api, ["inventory.read"])).items[0]?.id
    ).not.toBe(first.items[0]?.id);
  });

  it("reports all failed sources without claiming that the queues are empty", async () => {
    const { api } = makeApi({ "/admin/inventory/low-stock": new Error("Unavailable") });
    expect(await loadAdminNotificationFeed(api, ["inventory.read"])).toEqual({
      failedSources: ["Low stock"],
      sourceCount: 2,
      items: []
    });
  });

  it("does not return cancellation as an unavailable feed", async () => {
    const { api } = makeApi({ "/admin/inventory/low-stock": page([]) });
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadAdminNotificationFeed(api, ["inventory.read"], controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("notification read status", () => {
  it("scopes storage by admin, ignores malformed data and bounds retained identities", () => {
    expect(notificationReadStorageKey("admin-1")).not.toBe(
      notificationReadStorageKey("admin-2")
    );
    expect(parseNotificationReadIds("not json")).toEqual([]);
    expect(parseNotificationReadIds('{"ids": []}')).toEqual([]);
    expect(parseNotificationReadIds('["a", 4, "a", null, "b"]')).toEqual(["a", "b"]);
    const old = Array.from({ length: NOTIFICATION_READ_LIMIT }, (_, index) =>
      String(index)
    );
    const next = mergeNotificationReadIds(old, ["new", "new"]);
    expect(next).toHaveLength(NOTIFICATION_READ_LIMIT);
    expect(next).not.toContain("0");
    expect(next.at(-1)).toBe("new");
  });
});
