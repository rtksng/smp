import { describe, expect, it } from "vitest";
import {
  WAREHOUSE_ANALYTICS_PATH,
  WAREHOUSE_CREATE_PATH,
  WAREHOUSE_LIST_PATH,
  buildWarehouseCreatePath,
  buildWarehouseEditPath,
  buildWarehousePayload,
  buildWarehouseQuery,
  createEmptyWarehouseFilters,
  createWarehouseFiltersFromSearchParams,
  getWarehouseEditId,
  getWarehouseAnalytics,
  getWarehouseFilterContent,
  getWarehouseReturnToPath,
  getWarehouseStatusAction,
  shouldShowWarehouseFilters,
  warehouseFormSchema,
  warehouseToFormValues,
  type AdminWarehouse
} from "./warehouse-management";

const warehouse: AdminWarehouse = {
  address: "Plot 1, Surgical Park",
  city: "Mumbai",
  code: "MUM-01",
  contactNumber: "9876543210",
  contactPerson: "Ravi Sharma",
  createdAt: "2026-05-25T10:00:00.000Z",
  id: "warehouse-1",
  latitude: 19.076,
  longitude: 72.8777,
  name: "Mumbai Central Warehouse",
  pincode: "400001",
  state: "Maharashtra",
  status: "ACTIVE",
  updatedAt: "2026-05-25T10:00:00.000Z"
};

describe("warehouse management helpers", () => {
  it("preserves the selected report warehouse in list requests until reset", () => {
    const filters = createWarehouseFiltersFromSearchParams(new URLSearchParams({
      search: "Central",
      state: "Maharashtra",
      status: "ACTIVE",
      warehouseId: "warehouse-1"
    }));

    expect(buildWarehouseQuery(filters)).toMatchObject({
      search: "Central",
      state: "Maharashtra",
      status: "ACTIVE",
      warehouseId: "warehouse-1"
    });
    expect(buildWarehouseQuery({ ...filters, search: "Mumbai" }).warehouseId).toBe("warehouse-1");
    expect(buildWarehouseQuery(createEmptyWarehouseFilters()).warehouseId).toBeUndefined();
  });

  it("normalizes form values into the backend warehouse payload", () => {
    const values = warehouseToFormValues({
      ...warehouse,
      code: "MUM-01",
      latitude: null,
      longitude: null
    });

    expect(buildWarehousePayload(values)).toEqual({
      address: "Plot 1, Surgical Park",
      city: "Mumbai",
      code: "MUM-01",
      contactNumber: "9876543210",
      contactPerson: "Ravi Sharma",
      latitude: null,
      longitude: null,
      name: "Mumbai Central Warehouse",
      pincode: "400001",
      state: "Maharashtra"
    });
  });

  it("validates backend-compatible warehouse fields before submit", () => {
    const invalid = warehouseFormSchema.safeParse({
      ...warehouseToFormValues(warehouse),
      code: "bad code",
      latitude: "120",
      pincode: "4000"
    });

    expect(invalid.success).toBe(false);
    expect(invalid.error?.flatten().fieldErrors).toMatchObject({
      code: expect.any(Array),
      latitude: expect.any(Array),
      pincode: expect.any(Array)
    });
  });

  it("maps status changes to activate and deactivate API actions", () => {
    expect(getWarehouseStatusAction("ACTIVE", "INACTIVE")).toBe("deactivate");
    expect(getWarehouseStatusAction("INACTIVE", "ACTIVE")).toBe("activate");
    expect(getWarehouseStatusAction("ACTIVE", "ACTIVE")).toBeNull();
  });

  it("summarizes warehouse analytics from the current filtered rows", () => {
    expect(
      getWarehouseAnalytics([
        warehouse,
        {
          ...warehouse,
          id: "warehouse-2",
          state: "Karnataka",
          status: "INACTIVE"
        },
        {
          ...warehouse,
          id: "warehouse-3",
          state: "Maharashtra"
        }
      ])
    ).toEqual({
      active: 2,
      inactive: 1,
      states: 2,
      visible: 3
    });
  });

  it("builds the list-to-edit warehouse route and normalizes edit search params", () => {
    expect(WAREHOUSE_CREATE_PATH).toBe("/warehouses/create");
    expect(WAREHOUSE_ANALYTICS_PATH).toBe("/warehouses");
    expect(WAREHOUSE_LIST_PATH).toBe("/warehouses/list");
    expect(buildWarehouseCreatePath()).toBe("/warehouses/create");
    expect(buildWarehouseCreatePath(WAREHOUSE_ANALYTICS_PATH)).toBe(
      "/warehouses/create?returnTo=%2Fwarehouses"
    );
    expect(buildWarehouseCreatePath(WAREHOUSE_LIST_PATH)).toBe(
      "/warehouses/create?returnTo=%2Fwarehouses%2Flist"
    );
    expect(buildWarehouseEditPath("warehouse/1")).toBe(
      "/warehouses/create?edit=warehouse%2F1"
    );
    expect(getWarehouseEditId(" warehouse-1 ")).toBe("warehouse-1");
    expect(getWarehouseEditId(["warehouse-2", "warehouse-3"])).toBe("warehouse-2");
    expect(getWarehouseEditId("")).toBeNull();
    expect(getWarehouseReturnToPath(WAREHOUSE_ANALYTICS_PATH)).toBe(
      WAREHOUSE_ANALYTICS_PATH
    );
    expect(getWarehouseReturnToPath(WAREHOUSE_LIST_PATH)).toBe(WAREHOUSE_LIST_PATH);
    expect(getWarehouseReturnToPath(["/warehouses/list", "/settings"])).toBe(
      WAREHOUSE_LIST_PATH
    );
    expect(getWarehouseReturnToPath("/settings")).toBeNull();
  });

  it("hides filters on the create route", () => {
    expect(shouldShowWarehouseFilters("create")).toBe(false);
    expect(shouldShowWarehouseFilters("list")).toBe(true);
  });

  it("uses page-specific warehouse filter content", () => {
    expect(getWarehouseFilterContent("analytics")).toEqual({
      searchPlaceholder: "Name, code, city",
      submitLabel: "Apply analytics filters"
    });
    expect(getWarehouseFilterContent("list")).toEqual({
      searchPlaceholder: "Warehouse name, code, city",
      submitLabel: "Apply table filters"
    });
    expect(getWarehouseFilterContent("staff")).toEqual({
      searchPlaceholder: "Warehouse for staff assignment",
      submitLabel: "Apply staff filters"
    });
  });
});
