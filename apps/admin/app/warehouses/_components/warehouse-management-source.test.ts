import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(__dirname, "warehouse-management.tsx"), "utf8");
const listViewSource = source.slice(
  source.indexOf('{view === "list" ? ('),
  source.indexOf('{view === "create" ? (')
);
const staffViewSource = source.slice(
  source.indexOf('{view === "staff" ? ('),
  source.indexOf("<ConfirmationDialog")
);
const filterPanelSource = source.slice(
  source.indexOf("{showWarehouseFilters ? ("),
  source.indexOf('{view === "analytics" ? (', source.indexOf("{showWarehouseFilters ? ("))
);

describe("warehouse create page source", () => {
  it("does not render the removed create intro strip or matching warehouse panel", () => {
    expect(source).not.toContain("New warehouse setup");
    expect(source).not.toContain("Create a warehouse while checking existing records");
    expect(source).not.toContain("Matching warehouses");
    expect(source).not.toContain("Filtered records");
  });
});

describe("warehouse staff page source", () => {
  it("does not duplicate the warehouse list or warehouse detail panels", () => {
    expect(staffViewSource).toContain("Warehouse staff");
    expect(staffViewSource).not.toContain("Warehouse list");
    expect(staffViewSource).not.toContain("Warehouse detail");
  });

  it("does not render the removed staff route summary card", () => {
    expect(source).not.toContain("Warehouse staff assignments");
    expect(source).not.toContain(
      "Filter warehouses, select one, and manage assigned warehouse staff."
    );
  });

  it("loads staff assignments only on the warehouse staff page", () => {
    expect(source).toContain('enabled: Boolean(view === "staff" && selectedWarehouseId && canManageStaff)');
  });
});

describe("warehouse filter source", () => {
  it("does not render a filter title block above the filter fields", () => {
    expect(source).toContain("getWarehouseFilterContent(view)");
    expect(filterPanelSource).not.toContain("panelHeader");
    expect(filterPanelSource).not.toContain("warehouseFilterContent.eyebrow");
    expect(filterPanelSource).not.toContain("warehouseFilterContent.title");
    expect(filterPanelSource).not.toContain("warehouseFilterContent.summary");
    expect(source).not.toContain("Find warehouses");
  });
});

describe("warehouse list edit flow source", () => {
  it("routes list edits through the edit page and returns to the list after saving", () => {
    expect(source).toContain("buildWarehouseEditPath(warehouse.id)");
    expect(source).toContain("const redirectAfterSavePath = wasEditing ? WAREHOUSE_LIST_PATH : returnToPath");
    expect(source).toContain("router.push(redirectAfterSavePath)");
    expect(source).toContain("initialEditWarehouseId");
  });

  it("does not render a warehouse detail card on the list page", () => {
    expect(listViewSource).toContain("Warehouse list");
    expect(listViewSource).not.toContain("Warehouse detail");
    expect(listViewSource).not.toContain("Use the edit button in the table");
    expect(listViewSource).not.toContain("WarehouseDetail warehouse={selectedWarehouse}");
  });

  it("does not render the removed list route summary card", () => {
    expect(source).not.toContain("Warehouse records");
    expect(source).not.toContain(
      "Review filtered warehouse records in a table and edit or deactivate them."
    );
  });

  it("links create actions to the create page with source-aware return behavior", () => {
    expect(source).toContain("buildWarehouseCreatePath(WAREHOUSE_ANALYTICS_PATH)");
    expect(source).toContain("buildWarehouseCreatePath(WAREHOUSE_LIST_PATH)");
    expect(source).toContain("const warehouseBackPath = returnToPath ?? WAREHOUSE_ANALYTICS_PATH");
    expect(source).toContain("returnToPath");
  });
});
