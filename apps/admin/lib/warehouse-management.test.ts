import { describe, expect, it } from "vitest";
import {
  buildWarehousePayload,
  getWarehouseStatusAction,
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
});
