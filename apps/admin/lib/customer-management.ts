import type { QueryParams } from "./admin-api";

export type CustomerStatus = "ACTIVE" | "BLOCKED" | "INACTIVE";

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "BLOCKED"
];

export type CustomerFilters = {
  search: string;
  status: "" | CustomerStatus;
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
  status?: CustomerStatus | null;
  updatedAt: string;
};

export type AdminCustomerAddress = {
  city: string;
  country: string;
  fullName: string;
  id: string;
  isDefault: boolean;
  line1: string;
  line2: string | null;
  mobileNumber: string;
  pincode: string;
  state: string;
  type: string;
};

export type AdminCustomerOrderSummary = {
  createdAt: string;
  grandTotal: number;
  id: string;
  orderNumber: string;
  paymentStatus: string;
  placedAt: string | null;
  status: string;
};

export type AdminCustomerSupportNote = {
  adminName: string | null;
  adminUserId: string | null;
  createdAt: string;
  id: string;
  note: string;
};

export type AdminCustomerDetail = AdminCustomer & {
  addresses: AdminCustomerAddress[];
  orders: AdminCustomerOrderSummary[];
  supportNotes: AdminCustomerSupportNote[];
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
    search: "",
    status: ""
  };
}

export function buildCustomerQuery(
  filters: CustomerFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    limit,
    page,
    search: filters.search.trim() || undefined,
    status: filters.status || undefined
  };
}

export function customerStatusLabel(isActive: boolean) {
  return isActive ? "Active" : "Inactive";
}

export function buildCustomerStatusPayload(
  status: CustomerStatus,
  note: string
) {
  return {
    note: trimmedOrUndefined(note),
    status
  };
}

export function buildCustomerSupportNotePayload(note: string) {
  return {
    note: note.trim()
  };
}

export function formatCustomerStatus(status: CustomerStatus) {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function getCustomerStatusTone(status: CustomerStatus) {
  if (status === "ACTIVE") {
    return "ACTIVE";
  }

  return status;
}

export function resolveCustomerStatus(customer: {
  isActive: boolean;
  status?: CustomerStatus | null;
}): CustomerStatus {
  return customer.status ?? (customer.isActive ? "ACTIVE" : "INACTIVE");
}

export function formatCustomerDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function trimmedOrUndefined(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
