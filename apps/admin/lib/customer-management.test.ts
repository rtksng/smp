import { describe, expect, it } from "vitest";
import {
  buildCustomerQuery,
  buildCustomerStatusPayload,
  buildCustomerSupportNotePayload,
  createEmptyCustomerFilters,
  customerStatusLabel,
  formatCustomerDate,
  formatCustomerStatus,
  getCustomerStatusTone,
  resolveCustomerStatus,
  type CustomerFilters
} from "./customer-management";

describe("customer management helpers", () => {
  it("builds backend query params for customer filters and pagination", () => {
    const filters: CustomerFilters = {
      ...createEmptyCustomerFilters(),
      isActive: "true",
      search: "asha"
    };

    expect(buildCustomerQuery(filters, 3, 25)).toEqual({
      isActive: true,
      limit: 25,
      page: 3,
      search: "asha"
    });
  });

  it("omits empty customer filters", () => {
    expect(buildCustomerQuery(createEmptyCustomerFilters())).toEqual({
      isActive: undefined,
      limit: 20,
      page: 1,
      search: undefined
    });
  });

  it("formats customer state for display", () => {
    expect(customerStatusLabel(true)).toBe("Active");
    expect(customerStatusLabel(false)).toBe("Inactive");
    expect(formatCustomerDate("2026-05-25T10:00:00.000Z")).toBe("25 May 2026");
  });

  it("builds customer status and support note mutation payloads", () => {
    expect(buildCustomerStatusPayload("BLOCKED", "  abuse risk  ")).toEqual({
      note: "abuse risk",
      status: "BLOCKED"
    });
    expect(buildCustomerStatusPayload("ACTIVE", " ")).toEqual({
      note: undefined,
      status: "ACTIVE"
    });
    expect(buildCustomerSupportNotePayload("  follow up tomorrow  ")).toEqual({
      note: "follow up tomorrow"
    });
  });

  it("formats detailed customer status values", () => {
    expect(formatCustomerStatus("ACTIVE")).toBe("Active");
    expect(formatCustomerStatus("INACTIVE")).toBe("Inactive");
    expect(formatCustomerStatus("BLOCKED")).toBe("Blocked");
    expect(getCustomerStatusTone("ACTIVE")).toBe("ACTIVE");
    expect(getCustomerStatusTone("INACTIVE")).toBe("INACTIVE");
    expect(getCustomerStatusTone("BLOCKED")).toBe("BLOCKED");
  });

  it("resolves customer status from legacy active records", () => {
    expect(resolveCustomerStatus({ isActive: true })).toBe("ACTIVE");
    expect(resolveCustomerStatus({ isActive: false })).toBe("INACTIVE");
    expect(resolveCustomerStatus({ isActive: true, status: "BLOCKED" })).toBe(
      "BLOCKED"
    );
  });
});
