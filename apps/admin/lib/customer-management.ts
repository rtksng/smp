import type { QueryParams } from "./admin-api";

export type BooleanFilter = "" | "false" | "true";

export type CustomerFilters = {
  isActive: BooleanFilter;
  search: string;
};

export type AdminCustomer = {
  addressCount: number;
  businessName: string | null;
  createdAt: string;
  email: string | null;
  gstNumber: string | null;
  id: string;
  isActive: boolean;
  mobileNumber: string;
  name: string;
  orderCount: number;
  updatedAt: string;
};

export type PaginatedCustomerResponse = {
  items: AdminCustomer[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export function createEmptyCustomerFilters(): CustomerFilters {
  return {
    isActive: "",
    search: ""
  };
}

export function buildCustomerQuery(
  filters: CustomerFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    isActive: toOptionalBoolean(filters.isActive),
    limit,
    page,
    search: filters.search.trim() || undefined
  };
}

export function customerStatusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}

export function formatCustomerDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function toOptionalBoolean(value: BooleanFilter) {
  if (value === "") {
    return undefined;
  }

  return value === "true";
}
