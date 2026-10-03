import { describe, expect, it } from "vitest";
import { AdminApiClientError } from "./admin-api";
import {
  WAREHOUSES_PATH,
  WAREHOUSE_CREATE_PATH,
  buildWarehouseCreatePath,
  buildWarehouseDetailPath,
  buildWarehouseEditPath,
  buildWarehousePartnerQuery,
  buildWarehousePayload,
  buildWarehouseQuery,
  buildWarehouseQuickLinks,
  buildWarehouseStaffPath,
  buildWarehouseStockQuery,
  createEmptyWarehouseFilters,
  createWarehouseFiltersFromRouteParams,
  createWarehouseFiltersFromSearchParams,
  formatWarehouseCoordinates,
  formatWarehouseStaffCandidate,
  getWarehouseDetailError,
  getWarehouseEditId,
  normalizeWarehouseProductSearch,
  getWarehouseAnalytics,
  getWarehouseFilterContent,
  getWarehouseReturnToPath,
  getWarehouseStatusAction,
  loadWarehouseResults,
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
  it("accepts existing one-character codes and rejects fake phone numbers and excessive coordinate precision", () => {
    const values = { ...warehouseToFormValues(warehouse), code: "1" };
    expect(warehouseFormSchema.safeParse(values).success).toBe(true);
    for (const contactNumber of ["++++++++", "(---)---", "12 34 56"]) {
      expect(warehouseFormSchema.safeParse({ ...values, contactNumber }).success).toBe(false);
    }
    for (const latitude of ["1e-8", "0x10", "1.12345678", "Infinity"]) {
      expect(warehouseFormSchema.safeParse({ ...values, latitude }).success).toBe(false);
    }
    expect(buildWarehousePayload({ ...values, status: "INACTIVE" }).status).toBe("INACTIVE");
  });

  it("loads every warehouse page so KPIs and the paged table share one result", async () => {
    const pages: number[] = [];
    const fetchPage = async (query: Record<string, unknown>) => {
      const page = Number(query.page);
      pages.push(page);
      return {
        items: [{ ...warehouse, id: `warehouse-${page}`, status: page === 1 ? "ACTIVE" as const : "INACTIVE" as const }],
        pagination: { page, limit: 100, total: 201, totalPages: 3, hasNextPage: page < 3, hasPreviousPage: page > 1 }
      };
    };
    const results = await loadWarehouseResults(fetchPage, createEmptyWarehouseFilters());
    expect(pages).toEqual([1, 2, 3]);
    expect(results.items.map((item) => item.id)).toEqual(["warehouse-1", "warehouse-2", "warehouse-3"]);
    expect(getWarehouseAnalytics(results.items)).toEqual({ visible: 3, active: 1, inactive: 2 });
  });
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
      state: "Maharashtra",
      status: "ACTIVE"
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
      visible: 3
    });
  });

  it("builds the list-to-edit warehouse route and normalizes edit search params", () => {
    expect(WAREHOUSE_CREATE_PATH).toBe("/warehouses/create");
    expect(WAREHOUSES_PATH).toBe("/warehouses");
    expect(buildWarehouseCreatePath()).toBe("/warehouses/create");
    expect(buildWarehouseCreatePath(WAREHOUSES_PATH)).toBe(
      "/warehouses/create?returnTo=%2Fwarehouses"
    );
    expect(buildWarehouseEditPath("warehouse/1")).toBe(
      "/warehouses/create?edit=warehouse%2F1"
    );
    expect(getWarehouseEditId(" warehouse-1 ")).toBe("warehouse-1");
    expect(getWarehouseEditId(["warehouse-2", "warehouse-3"])).toBe("warehouse-2");
    expect(getWarehouseEditId("")).toBeNull();
    expect(getWarehouseReturnToPath(WAREHOUSES_PATH)).toBe(WAREHOUSES_PATH);
    expect(getWarehouseReturnToPath([" /warehouses ", "/settings"])).toBe(WAREHOUSES_PATH);
    expect(getWarehouseReturnToPath("/warehouses/list")).toBeNull();
    expect(getWarehouseReturnToPath("/settings")).toBeNull();
  });

  it("hides filters on the create route", () => {
    expect(shouldShowWarehouseFilters("create")).toBe(false);
    expect(shouldShowWarehouseFilters("list")).toBe(true);
  });

  it("uses page-specific warehouse filter content", () => {
    expect(getWarehouseFilterContent("list")).toEqual({
      searchPlaceholder: "Warehouse name, code, city",
      submitLabel: "Apply warehouse filters"
    });
    expect(getWarehouseFilterContent("staff")).toEqual({
      searchPlaceholder: "Warehouse for staff assignment",
      submitLabel: "Apply staff filters"
    });
  });

  it("labels staff candidates with their name, email, and role", () => {
    const candidate = {
      adminUserId: "admin-2",
      email: "asha@example.com",
      firstName: "Asha",
      lastName: null,
      role: { code: "WAREHOUSE_MANAGER", id: "role-1", name: "Warehouse manager" }
    };

    expect(formatWarehouseStaffCandidate(candidate)).toBe(
      "Asha (asha@example.com) - Warehouse manager"
    );
    expect(formatWarehouseStaffCandidate({ ...candidate, lastName: "Rao" })).toBe(
      "Asha Rao (asha@example.com) - Warehouse manager"
    );
  });

  it("builds warehouse detail, edit-and-return, and staff links and only returns to safe pages", () => {
    const id = "7d9f8f33-d348-4a89-94e8-907be76a91c6";

    expect(buildWarehouseDetailPath(id)).toBe(`/warehouses/${id}`);
    expect(buildWarehouseDetailPath("warehouse/1")).toBe("/warehouses/warehouse%2F1");
    expect(buildWarehouseEditPath(id, buildWarehouseDetailPath(id))).toBe(
      `/warehouses/create?edit=${id}&returnTo=%2Fwarehouses%2F${id}`
    );
    expect(buildWarehouseStaffPath(id)).toBe(`/warehouses/staff?warehouseId=${id}`);
    expect(getWarehouseReturnToPath(`/warehouses/${id}`)).toBe(`/warehouses/${id}`);
    for (const unsafe of [
      "/warehouses/list",
      "/warehouses/create",
      "/warehouses/not-a-uuid",
      `/warehouses/${id}/extra`,
      `//evil.example/warehouses/${id}`,
      `https://evil.example/warehouses/${id}`
    ]) {
      expect(getWarehouseReturnToPath(unsafe)).toBeNull();
    }
  });

  it("offers only the shortcuts an admin can open, each filtered to the warehouse", () => {
    const allow = (...permissions: string[]) => (permission: string) => permissions.includes(permission);

    expect(buildWarehouseQuickLinks("warehouse-1", () => true)).toEqual([
      { href: "/inventory?warehouseId=warehouse-1", label: "Stock overview" },
      { href: "/inventory?lowStock=true&warehouseId=warehouse-1", label: "Low stock" },
      {
        href: "/inventory?nearExpiry=true&nearExpiryDays=30&warehouseId=warehouse-1",
        label: "Near expiry"
      },
      { href: "/inventory/movements?warehouseId=warehouse-1", label: "Stock movements" },
      { href: "/orders?warehouseId=warehouse-1", label: "Orders" },
      { href: "/delivery/assignments?warehouseId=warehouse-1", label: "Deliveries" },
      { href: "/warehouses/staff?warehouseId=warehouse-1", label: "Manage staff" }
    ]);
    expect(
      buildWarehouseQuickLinks("warehouse-1", allow("warehouse.read", "inventory.read")).map(
        (link) => link.label
      )
    ).toEqual(["Stock overview", "Low stock", "Near expiry", "Stock movements"]);
    expect(
      buildWarehouseQuickLinks("warehouse-1", allow("warehouse.read", "delivery.read", "orders.read")).map(
        (link) => link.label
      )
    ).toEqual(["Orders", "Deliveries"]);
    expect(buildWarehouseQuickLinks("warehouse-1", allow("warehouse.read"))).toEqual([]);
  });

  it("builds product and delivery partner queries for one warehouse", () => {
    expect(buildWarehouseStockQuery("warehouse-1", 2, "  forceps  ")).toEqual({
      limit: 20,
      page: 2,
      search: "forceps",
      warehouseId: "warehouse-1"
    });
    expect(buildWarehouseStockQuery("warehouse-1", 1, "   ").search).toBeUndefined();
    expect(normalizeWarehouseProductSearch(` ${"a".repeat(200)} `)).toHaveLength(160);
    expect(buildWarehousePartnerQuery("warehouse-1", 3)).toEqual({
      limit: 10,
      page: 3,
      warehouseId: "warehouse-1"
    });
  });

  it("explains why a warehouse cannot be shown", () => {
    expect(
      getWarehouseDetailError(new AdminApiClientError("Admin is not assigned to this warehouse.", 403))
    ).toEqual({
      message: "You are not assigned to this warehouse. Ask a super admin to add you to its staff.",
      title: "Warehouse unavailable"
    });
    expect(getWarehouseDetailError(new AdminApiClientError("Warehouse was not found.", 404)).title).toBe(
      "Warehouse not found"
    );
    expect(
      getWarehouseDetailError(new AdminApiClientError("Validation failed (uuid is expected)", 400)).title
    ).toBe("Warehouse not found");
    expect(getWarehouseDetailError(new Error("Network down"))).toEqual({
      message: "Network down",
      title: "Warehouse unavailable"
    });
  });

  it("formats coordinates and reads warehouse filters from route params", () => {
    expect(formatWarehouseCoordinates(19.076, 72.8777)).toBe("19.076, 72.8777");
    expect(formatWarehouseCoordinates(null, 72.8777)).toBe("Not set");
    expect(
      createWarehouseFiltersFromRouteParams({ status: "ACTIVE", warehouseId: [" warehouse-7 ", "warehouse-8"] })
    ).toEqual({ search: "", state: "", status: "ACTIVE", warehouseId: "warehouse-7" });
  });
});
