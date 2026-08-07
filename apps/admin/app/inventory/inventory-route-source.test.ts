import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const inventoryDir = __dirname;
const overviewPageSource = readFileSync(join(inventoryDir, "page.tsx"), "utf8");
const managementPath = join(inventoryDir, "inventory-management.tsx");
const actionsPagePath = join(inventoryDir, "actions/page.tsx");
const movementsPagePath = join(inventoryDir, "movements/page.tsx");
const managementSource = existsSync(managementPath)
  ? readFileSync(managementPath, "utf8")
  : "";
const actionsPageSource = existsSync(actionsPagePath)
  ? readFileSync(actionsPagePath, "utf8")
  : "";
const movementsPageSource = existsSync(movementsPagePath)
  ? readFileSync(movementsPagePath, "utf8")
  : "";

describe("inventory route split", () => {
  it("has dedicated route pages for overview, stock actions, and movements", () => {
    expect(overviewPageSource).toContain('view="overview"');
    expect(existsSync(actionsPagePath)).toBe(true);
    expect(existsSync(movementsPagePath)).toBe(true);
    expect(actionsPageSource).toContain('view="actions"');
    expect(movementsPageSource).toContain('view="movements"');
  });

  it("renders inventory sub-tabs from the shared inventory component", () => {
    expect(managementSource).toContain("InventorySubTabs");
    expect(managementSource).toContain("INVENTORY_TABS.map");
    expect(managementSource).toContain("href={tab.href}");
    expect(managementSource).toContain("activeView === tab.value");
  });

  it("loads stock-action product selectors from the admin products API", () => {
    expect(managementSource).toContain(
      'api.request<ProductListResponse>("/admin/products"'
    );
    expect(managementSource).not.toContain(
      'api.request<ProductListResponse>("/products"'
    );
  });

  it("keeps the heavy inventory sections scoped to their own pages", () => {
    expect(managementSource).toContain('view === "overview"');
    expect(managementSource).toContain('view === "actions"');
    expect(managementSource).toContain('view === "movements"');
    expect(managementSource).toContain("showWarningFilters={isOverviewView}");
    expect(managementSource).toContain("StockTable");
    expect(managementSource).toContain("MovementTable");
  });
});
