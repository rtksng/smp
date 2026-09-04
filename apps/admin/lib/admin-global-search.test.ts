import { describe, expect, it, vi } from "vitest";
import { getAdminSearchPages, searchAdmin } from "./admin-global-search";
import { ADMIN_PERMISSION as P } from "./permissions";

const empty = { items: [], pagination: { hasNextPage: false, total: 0 } };

describe("admin global search", () => {
  it("only includes pages and calls APIs allowed by the admin permissions", async () => {
    const request = vi.fn().mockResolvedValue(empty);
    const data = await searchAdmin({ request }, "customer", [P.UsersRead]);

    expect(request.mock.calls.map(([path]) => path)).toEqual(["/admin/customers"]);
    expect(data.results.some((item) => item.href === "/customers")).toBe(true);
    expect(getAdminSearchPages("settings", [P.UsersRead])).toEqual([]);
    expect(getAdminSearchPages("warehouse", [])).toEqual([]);
    expect(getAdminSearchPages("dashboard", [P.UsersRead])).toEqual([]);
    expect(getAdminSearchPages("create product", [P.ProductsCreate])).toEqual([]);
    expect(getAdminSearchPages("roles", [P.SettingsManage])).toEqual([
      expect.objectContaining({ href: "/settings/roles", group: "Pages" })
    ]);
  });

  it("finds actual product records and nested categories and links their existing detail routes", async () => {
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/admin/products")
        return {
          ...empty,
          items: [{ id: "product/1", name: "Forceps", sku: "FC-01", status: "ACTIVE" }]
        };
      if (path === "/admin/categories")
        return [
          {
            id: "parent",
            name: "Surgical",
            slug: "surgical",
            children: [
              {
                id: "child",
                name: "Forceps",
                slug: "forceps",
                children: []
              }
            ]
          }
        ];
      if (path === "/admin/brands") return [];
      return empty;
    });
    const { results, unavailable } = await searchAdmin({ request }, "Forceps", [
      P.ProductsRead
    ]);

    expect(request).toHaveBeenCalledWith("/admin/products", {
      query: { page: 1, limit: 5, search: "Forceps" },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(request).toHaveBeenCalledWith("/admin/product-feedback", {
      query: { page: 1, limit: 5, productSearch: "Forceps" },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Forceps",
          href: "/products/product%2F1/edit",
          group: "Products"
        }),
        expect.objectContaining({
          title: "Forceps",
          href: "/categories/child/edit",
          group: "Categories"
        })
      ])
    );
    expect(unavailable).toEqual([]);
  });

  it("uses supported order and mobile parameters and deduplicates overlapping results", async () => {
    const request = vi.fn().mockResolvedValue({
      ...empty,
      items: [
        {
          id: "order-1",
          orderNumber: "ORD-12345",
          status: "CREATED",
          customer: { firstName: "Anita" }
        }
      ]
    });
    const { results } = await searchAdmin({ request }, "12345", [P.OrdersRead]);

    expect(request).toHaveBeenCalledWith("/admin/orders", {
      query: { page: 1, limit: 5, orderNumber: "12345" },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(request).toHaveBeenCalledWith("/admin/orders", {
      query: { page: 1, limit: 5, customerMobile: "12345" },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(results.filter((item) => item.group === "Orders")).toHaveLength(1);
    expect(results.find((item) => item.group === "Returns & refunds")?.href).toBe(
      "/orders/order-1"
    );
  });

  it("keeps working sources and explains a bounded local scan without claiming older records were searched", async () => {
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/admin/delivery-partners")
        return {
          items: [
            {
              id: "partner-1",
              fullName: "Anita Singh",
              mobileNumber: "+919900000000",
              status: "ACTIVE"
            }
          ],
          pagination: { hasNextPage: true, total: 150 }
        };
      throw new Error("offline");
    });
    const { results, unavailable, limitations } = await searchAdmin(
      { request },
      "Anita",
      [P.DeliveryRead]
    );

    expect(request).toHaveBeenCalledWith("/admin/delivery-partners", {
      query: { page: 1, limit: 100 },
      signal: undefined,
      timeoutMs: 10_000
    });
    expect(results).toEqual([
      expect.objectContaining({ href: "/delivery/partners/partner-1" })
    ]);
    expect(limitations).toEqual([
      "Delivery partners: only the latest 100 records were searched; open the section to browse older records."
    ]);
    expect(unavailable).toEqual(["Delivery assignments: temporarily unavailable."]);
  });

  it("cancels stale searches even when the API wraps an abort as another error", async () => {
    const controller = new AbortController();
    const request = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("network error");
    });

    await expect(
      searchAdmin({ request }, "Anita", [P.UsersRead], controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(request.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    request.mockClear();
    await expect(
      searchAdmin({ request }, "Anita", [P.UsersRead], controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
  });

  it("caps each data group and opens supported warehouse and inventory filters", async () => {
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses")
        return {
          ...empty,
          items: Array.from({ length: 8 }, (_, index) => ({
            id: `warehouse-${index}`,
            name: "Delhi",
            code: "DEL",
            city: "Delhi",
            state: "Delhi"
          }))
        };
      return {
        ...empty,
        items: [
          {
            id: "stock-1",
            productId: "product-1",
            warehouseId: "warehouse-1",
            availableQuantity: 2,
            reservedQuantity: 1,
            lowStockThreshold: 5
          }
        ]
      };
    });
    const { results } = await searchAdmin({ request }, "Delhi", [
      P.WarehouseRead,
      P.InventoryRead
    ]);

    expect(results.filter((item) => item.group === "Warehouses")).toHaveLength(5);
    expect(results.find((item) => item.group === "Warehouses")?.href).toBe(
      "/warehouses/list?warehouseId=warehouse-0"
    );
    expect(results.find((item) => item.group === "Inventory")?.href).toBe(
      "/inventory?productId=product-1&warehouseId=warehouse-1"
    );
  });

  it("does not query APIs for short input and caps backend search length", async () => {
    const request = vi.fn().mockResolvedValue(empty);
    await searchAdmin({ request }, " a ", [P.UsersRead]);
    expect(request).not.toHaveBeenCalled();
    await searchAdmin({ request }, "a".repeat(200), [P.UsersRead]);
    expect(request.mock.calls[0]?.[1]?.query.search).toHaveLength(100);
  });
});
