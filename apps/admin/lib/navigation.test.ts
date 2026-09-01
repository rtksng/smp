import { describe, expect, it } from "vitest";
import { adminNavigationItems, getVisibleNavigationItems } from "./navigation";
import { ADMIN_PERMISSION } from "./permissions";

describe("admin navigation", () => {
  it("organizes navigation items into sidebar categories", () => {
    expect(
      adminNavigationItems.map(({ category, label }) => ({ category, label }))
    ).toEqual([
      { category: "Workspace", label: "Dashboard" },
      { category: "Workspace", label: "Admin Guide" },
      { category: "Catalog", label: "Products" },
      { category: "Catalog", label: "Categories" },
      { category: "Catalog", label: "Brands" },
      { category: "Catalog", label: "Product Feedback" },
      { category: "Fulfilment", label: "Inventory" },
      { category: "Fulfilment", label: "Orders" },
      { category: "Fulfilment", label: "Returns & Refunds" },
      { category: "Fulfilment", label: "Customers" },
      { category: "Fulfilment", label: "Warehouses" },
      { category: "Fulfilment", label: "Delivery" },
      { category: "Growth", label: "Quote Requests" },
      { category: "Growth", label: "Coupons" },
      { category: "Growth", label: "Delivery Charges" },
      { category: "Growth", label: "Reports" },
      { category: "System", label: "Settings" }
    ]);
  });

  it("always includes dashboard and hides permission-gated sections without access", () => {
    expect(getVisibleNavigationItems([]).map((item) => item.label)).toEqual([
      "Dashboard",
      "Admin Guide"
    ]);
  });

  it("shows catalog sections to product readers", () => {
    const labels = getVisibleNavigationItems([ADMIN_PERMISSION.ProductsRead]).map(
      (item) => item.label
    );

    expect(labels).toContain("Products");
    expect(labels).toContain("Categories");
    expect(labels).toContain("Brands");
    expect(labels).toContain("Product Feedback");
    expect(labels).not.toContain("Inventory");
  });

  it("shows order sections to order readers", () => {
    const labels = getVisibleNavigationItems([ADMIN_PERMISSION.OrdersRead]).map(
      (item) => item.label
    );

    expect(labels).toContain("Orders");
    expect(labels).toContain("Returns & Refunds");
    expect(labels).not.toContain("Customers");
  });

  it("shows delivery, quote requests, coupons, and settings only with their own permissions", () => {
    const visibleItems = getVisibleNavigationItems([
      ADMIN_PERMISSION.DeliveryRead,
      ADMIN_PERMISSION.SettingsManage
    ]);
    const labels = visibleItems.map((item) => item.label);

    expect(labels).toEqual([
      "Dashboard",
      "Admin Guide",
      "Delivery",
      "Quote Requests",
      "Coupons",
      "Delivery Charges",
      "Settings"
    ]);
    expect(visibleItems.find((item) => item.label === "Settings")?.href).toBe(
      "/settings/admin-users"
    );
  });

  it("shows warehouse subnavigation under warehouses for warehouse readers", () => {
    const warehousesItem = getVisibleNavigationItems([
      ADMIN_PERMISSION.WarehouseRead,
      ADMIN_PERMISSION.WarehouseManage,
      ADMIN_PERMISSION.WarehouseStaffManage
    ]).find((item) => item.href === "/warehouses");

    expect(warehousesItem?.children?.map((item) => item.label)).toEqual([
      "Warehouse staff",
      "Warehouse list"
    ]);
  });

  it("shows inventory subnavigation under inventory for inventory readers", () => {
    const inventoryItem = getVisibleNavigationItems([
      ADMIN_PERMISSION.InventoryRead,
      ADMIN_PERMISSION.InventoryUpdate
    ]).find((item) => item.href === "/inventory");

    expect(inventoryItem?.children?.map((item) => item.label)).toEqual([
      "Overview",
      "Stock actions",
      "Movements"
    ]);
  });

  it("keeps warehouse child tabs permission-aware", () => {
    const warehousesItem = getVisibleNavigationItems([
      ADMIN_PERMISSION.WarehouseRead
    ]).find((item) => item.href === "/warehouses");

    expect(warehousesItem?.children?.map((item) => item.label)).toEqual([
      "Warehouse list"
    ]);
  });
});
