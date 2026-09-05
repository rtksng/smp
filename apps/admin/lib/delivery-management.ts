import type { QueryParams } from "./admin-api";

export const DELIVERY_PARTNER_STATUSES = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED"
] as const;

export const DELIVERY_ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
] as const;

export type DeliveryPartnerStatus = (typeof DELIVERY_PARTNER_STATUSES)[number];
export type DeliveryAssignmentStatus =
  (typeof DELIVERY_ASSIGNMENT_STATUSES)[number];

export type DeliveryPartnerFilters = {
  status: "" | DeliveryPartnerStatus;
};

export type DeliveryAssignmentFilters = {
  deliveryPartnerId: string;
  status: "" | DeliveryAssignmentStatus;
  warehouseId: string;
};

export type DeliveryPartnerDocument = {
  createdAt: string;
  fileKey: string;
  fileUrl: string;
  id: string;
  title: string;
  type: string;
  verifiedAt: string | null;
};

export type DeliveryPartnerWallet = {
  balance: number;
  currency: "INR";
  totalEarnings: number;
};

export type AdminDeliveryPartner = {
  createdAt: string;
  documents: DeliveryPartnerDocument[];
  email: string | null;
  fullName: string;
  id: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  mobileNumber: string;
  status: DeliveryPartnerStatus;
  updatedAt: string;
  vehicleNumber: string | null;
  wallet: DeliveryPartnerWallet;
};

export type DeliveryPickupWarehouse = {
  address: string;
  city: string;
  code: string;
  id: string;
  name: string;
  pincode: string;
  state: string;
};

export type DeliveryAssignmentHistory = {
  createdAt: string;
  id: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  status: DeliveryAssignmentStatus;
};

export type AdminDeliveryAssignment = {
  assignedAt: string;
  createdAt: string;
  deliveredAt: string | null;
  deliveryPartner: AdminDeliveryPartner | null;
  deliveryPartnerId: string;
  failureReason: string | null;
  id: string;
  orderId: string;
  orderNumber: string;
  pickedUpAt: string | null;
  pickupWarehouse: DeliveryPickupWarehouse | null;
  pickupWarehouseId: string | null;
  proofOfDeliveryKey: string | null;
  proofOfDeliveryUrl: string | null;
  status: DeliveryAssignmentStatus;
  statusHistory: DeliveryAssignmentHistory[];
  updatedAt: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination?: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type DeliveryStatusPayload = {
  note?: string;
  status: DeliveryAssignmentStatus;
};

/** Load every page for dispatch selectors, which must not inherit table pagination. */
export async function loadDeliveryOptions<T>(
  loadPage: (page: number) => Promise<PaginatedResponse<T>>
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await loadPage(page);
    items.push(...result.items);
    if (!result.pagination?.hasNextPage) return items;
  }
}

const NEXT_DELIVERY_STATUSES: Record<
  DeliveryAssignmentStatus,
  DeliveryAssignmentStatus[]
> = {
  ACCEPTED: ["PICKED_UP", "CANCELLED"],
  ASSIGNED: ["ACCEPTED", "CANCELLED"],
  CANCELLED: [],
  DELIVERED: [],
  FAILED: [],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  PICKED_UP: ["OUT_FOR_DELIVERY", "FAILED"]
};

export function createEmptyDeliveryPartnerFilters(): DeliveryPartnerFilters {
  return {
    status: ""
  };
}

export function createEmptyDeliveryAssignmentFilters(): DeliveryAssignmentFilters {
  return {
    deliveryPartnerId: "",
    status: "",
    warehouseId: ""
  };
}

export function buildDeliveryPartnerQuery(
  filters: DeliveryPartnerFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    limit,
    page,
    status: filters.status || undefined
  };
}

export function buildDeliveryAssignmentQuery(
  filters: DeliveryAssignmentFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    deliveryPartnerId: filters.deliveryPartnerId || undefined,
    limit,
    page,
    status: filters.status || undefined,
    warehouseId: filters.warehouseId || undefined
  };
}

export function getNextDeliveryStatuses(status: DeliveryAssignmentStatus) {
  return NEXT_DELIVERY_STATUSES[status];
}

export function buildDeliveryStatusPayload(
  status: DeliveryAssignmentStatus,
  note: string
): DeliveryStatusPayload {
  return {
    note: trimmedOrUndefined(note),
    status
  };
}

export function formatDeliveryLabel(value: string) {
  const label = value
    .split("_")
    .map((part) => part.toLowerCase())
    .join(" ");

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDeliveryDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function trimmedOrUndefined(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
