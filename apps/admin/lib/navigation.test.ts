import { describe, expect, it } from "vitest";
import { getVisibleNavigationItems } from "./navigation";
import { ADMIN_PERMISSION } from "./permissions";

describe("admin navigation", () => {
  it("always includes dashboard and hides permission-gated sections without access", () => {
    expect(getVisibleNavigationItems([]).map((item) => item.label)).toEqual([
      "Dashboard"
    ]);
  });

  it("shows catalog sections to product readers", () => {
    const labels = getVisibleNavigationItems([ADMIN_PERMISSION.ProductsRead]).map(
      (item) => item.label
    );

    expect(labels).toContain("Products");
    expect(labels).toContain("Categories");
    expect(labels).toContain("Brands");
    expect(labels).not.toContain("Inventory");
  });

  it("shows delivery and settings only with their own permissions", () => {
    const labels = getVisibleNavigationItems([
      ADMIN_PERMISSION.DeliveryRead,
      ADMIN_PERMISSION.SettingsManage
    ]).map((item) => item.label);

    expect(labels).toEqual(["Dashboard", "Delivery", "Settings"]);
  });
});
