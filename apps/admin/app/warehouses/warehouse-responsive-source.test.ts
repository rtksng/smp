import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const warehouseDir = __dirname;
const source = readFileSync(
  join(warehouseDir, "_components", "warehouse-management.tsx"),
  "utf8"
);
const responsiveStyles = readFileSync(
  join(warehouseDir, "warehouse-responsive.css"),
  "utf8"
);
const detailSource = readFileSync(
  join(warehouseDir, "_components", "warehouse-detail.tsx"),
  "utf8"
);

describe("Warehouse responsive layout", () => {
  it("scopes responsive rules to every warehouse view", () => {
    expect(source).toContain('import "../warehouse-responsive.css"');
    expect(source).toContain('className="warehouseModule"');
    expect(source).toContain('data-warehouse-view={view}');
    expect(source).toContain("warehouseOverviewPanel");
    expect(source).toContain("warehouseListPanel");
    expect(source).toContain("warehouseCreatePanel");
    expect(source).toContain("warehouseStaffPanel");
  });

  it("keeps compact actions, two-by-two KPIs, forms, staff, and table options accessible", () => {
    expect(source).toContain("warehouseOverviewHeaderActions");
    expect(source).toContain("warehouseCreateHeaderActions");
    expect(source).toContain("warehouseMetricGrid");
    expect(source).toContain("warehouseStaffAssignForm");
    expect(source).toContain("Swipe sideways to view every warehouse option.");
    expect(responsiveStyles).toContain("@media (max-width: 640px)");
    expect(responsiveStyles).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(responsiveStyles).toContain(".warehouseStaffAssignForm");
    expect(responsiveStyles).toContain(".warehouseTableHint");
  });

  it("lays the detail page out inside the warehouse module with a title visible on phones", () => {
    expect(detailSource).toContain('import "../warehouse-responsive.css"');
    expect(detailSource).toContain('className="warehouseModule"');
    expect(detailSource).toContain('data-warehouse-view="detail"');
    expect(detailSource).toContain("warehouseDetailHeader");
    expect(detailSource).toContain("warehouseDetailMetricGrid");
    expect(detailSource).toContain("Swipe sideways to view every product column.");
    expect(responsiveStyles).toContain(".warehouseDetailHeader .adminPageHeaderTitle");
    expect(responsiveStyles).toContain(".warehouseProductDataTable");
    expect(responsiveStyles).toContain(":is(.warehouseOverviewHeaderActions, .warehouseDetailHeaderActions)");
  });
});
