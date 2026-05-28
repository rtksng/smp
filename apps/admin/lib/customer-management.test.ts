import { describe, expect, it } from "vitest";
import {
  buildCustomerQuery,
  createEmptyCustomerFilters,
  customerStatusLabel,
  formatCustomerDate,
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
});
