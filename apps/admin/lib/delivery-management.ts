import type { QueryParams } from "./admin-api";
import { formatCurrency, type OrderStatus } from "./order-management";

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

export const DELIVERY_PARTNER_PAYMENT_TYPES = ["SALARY", "COMMISSION"] as const;
export const DELIVERY_COMMISSION_TYPES = ["PERCENTAGE", "FIXED"] as const;
export const DELIVERY_LEDGER_ENTRY_TYPES = [
  "PAYOUT",
  "SALARY",
  "DELIVERY_EARNING"
] as const;

export const DELIVERY_PARTNER_SEARCH_MAX_LENGTH = 100;
export const DELIVERY_PARTNER_NAME_MAX_LENGTH = 120;
export const DELIVERY_PARTNER_VEHICLE_MAX_LENGTH = 40;
export const DELIVERY_LEDGER_DESCRIPTION_MAX_LENGTH = 300;
export const DELIVERY_LEDGER_REFERENCE_MAX_LENGTH = 120;

export type DeliveryPartnerStatus = (typeof DELIVERY_PARTNER_STATUSES)[number];
export type DeliveryAssignmentStatus =
  (typeof DELIVERY_ASSIGNMENT_STATUSES)[number];
export type DeliveryPartnerPaymentType =
  (typeof DELIVERY_PARTNER_PAYMENT_TYPES)[number];
export type DeliveryCommissionType = (typeof DELIVERY_COMMISSION_TYPES)[number];
export type DeliveryLedgerEntryType = (typeof DELIVERY_LEDGER_ENTRY_TYPES)[number];

export type DeliveryPartnerFilters = {
  search: string;
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

/** A null paymentType means pay was never configured, for example on self-registered applicants. */
export type DeliveryPartnerPayment = {
  commissionType: DeliveryCommissionType | null;
  commissionValue: number | null;
  monthlySalary: number | null;
  paymentType: DeliveryPartnerPaymentType | null;
};

export type DeliveryPartnerWarehouse = {
  address: string;
  /** When the partner was linked to this warehouse. */
  associatedAt: string;
  city: string;
  code: string;
  contactNumber: string;
  contactPerson: string;
  id: string;
  name: string;
  pincode: string;
  state: string;
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
  payment: DeliveryPartnerPayment;
  status: DeliveryPartnerStatus;
  updatedAt: string;
  vehicleNumber: string | null;
  wallet: DeliveryPartnerWallet;
  warehouses: DeliveryPartnerWarehouse[];
};

export type DeliveryLedgerEntry = {
  amount: number;
  createdAt: string;
  deliveryAssignmentId: string | null;
  description: string;
  id: string;
  reference: string | null;
  salaryPeriod: string | null;
  type: DeliveryLedgerEntryType;
};

export type DeliveryPartnerEarnings = {
  entries: DeliveryLedgerEntry[];
  payment: DeliveryPartnerPayment;
  payouts: DeliveryLedgerEntry[];
  totals: {
    commissionEarnings: number;
    completedDeliveries: number;
    paidOut: number;
    salaryEarnings: number;
  };
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
  /** Commission credited to the partner for this delivery, once it is delivered. */
  earning: number | null;
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

/** A confirmed or packed order waiting for a rider, from GET /admin/delivery/dispatch-queue. */
export type DispatchQueueOrder = {
  /** Earlier deliveries of this order that failed or were cancelled. */
  attempts: number;
  createdAt: string;
  customer: { businessName: string | null; fullName: string; mobileNumber: string };
  grandTotal: number;
  id: string;
  itemCount: number;
  orderNumber: string;
  payment: { codAmount: number; method: string | null; status: string };
  placedAt: string | null;
  shippingAddress: { city: string; pincode: string; state: string } | null;
  status: OrderStatus;
  warehouse: { code: string; id: string; name: string } | null;
  warehouseId: string | null;
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
    search: "",
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
    search: normalizeDeliveryPartnerSearch(filters.search) || undefined,
    status: filters.status || undefined
  };
}

/** The partner search matches name, mobile, or vehicle and accepts up to 100 characters. */
export function normalizeDeliveryPartnerSearch(value: string) {
  return value.trim().slice(0, DELIVERY_PARTNER_SEARCH_MAX_LENGTH);
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

export function formatDeliveryDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

/** Dispatch picks up from the chosen pickup warehouse, or the order's own warehouse when none is chosen. */
export function getEffectivePickupWarehouseId(
  pickupWarehouseId: string,
  order: { warehouseId: string | null } | null | undefined
) {
  return pickupWarehouseId || order?.warehouseId || null;
}

export function isPartnerAssignedToWarehouse(
  partner: Pick<AdminDeliveryPartner, "warehouses">,
  warehouseId: string
) {
  return partner.warehouses.some((warehouse) => warehouse.id === warehouseId);
}

/**
 * The API only dispatches partners linked to the pickup warehouse, so selectors offer just those.
 * When the warehouse is not known yet every partner stays available.
 */
export function filterPartnersForWarehouse<T extends Pick<AdminDeliveryPartner, "warehouses">>(
  partners: T[],
  warehouseId: string | null | undefined
): T[] {
  if (!warehouseId) {
    return partners;
  }

  return partners.filter((partner) => isPartnerAssignedToWarehouse(partner, warehouseId));
}

export function formatDeliveryWarehouseName(warehouse: { code: string; name: string }) {
  return `${warehouse.name} (${warehouse.code})`;
}

export function formatDeliveryPartnerWarehouses(
  warehouses: Array<{ code: string; name: string }>
) {
  return warehouses.length > 0
    ? warehouses.map(formatDeliveryWarehouseName).join(", ")
    : "No warehouses";
}

/** Business name first, since most buyers are clinics and pharmacies. */
export function getDispatchCustomerName(order: Pick<DispatchQueueOrder, "customer">) {
  return order.customer.businessName || order.customer.fullName || order.customer.mobileNumber;
}

/** What the rider must know about money before leaving: cash to collect, or nothing. */
export function describeDispatchPayment(order: Pick<DispatchQueueOrder, "grandTotal" | "payment">) {
  if (order.payment.codAmount > 0) {
    return `Collect ${formatDeliveryAmount(order.payment.codAmount)} cash`;
  }

  return order.payment.status === "PAID"
    ? `Prepaid ${formatDeliveryAmount(order.grandTotal)}`
    : `${formatDeliveryAmount(order.grandTotal)}, payment ${formatDeliveryLabel(order.payment.status).toLowerCase()}`;
}

/** Rupee amounts without trailing zero paise, for example ₹18,000 or ₹61.25. */
export function formatDeliveryAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    style: "currency"
  }).format(value);
}

export function formatDeliveryPaymentType(
  paymentType: DeliveryPartnerPaymentType | null | undefined
) {
  if (paymentType === "SALARY") {
    return "Salary";
  }

  return paymentType === "COMMISSION" ? "Commission" : "Not set";
}

export function formatDeliveryPartnerPay(payment: DeliveryPartnerPayment | null | undefined) {
  if (payment?.paymentType === "SALARY") {
    return payment.monthlySalary === null
      ? "Salary (amount not set)"
      : `${formatDeliveryAmount(payment.monthlySalary)} / month salary`;
  }

  if (payment?.paymentType === "COMMISSION") {
    if (payment.commissionType === null || payment.commissionValue === null) {
      return "Commission (rate not set)";
    }

    return payment.commissionType === "PERCENTAGE"
      ? `${Number(payment.commissionValue.toFixed(2))}% of order value per delivery`
      : `${formatDeliveryAmount(payment.commissionValue)} per delivery`;
  }

  return "Pay not set";
}

export type DeliveryPartnerFormValues = {
  commissionType: "" | DeliveryCommissionType;
  commissionValue: string;
  email: string;
  fullName: string;
  mobileNumber: string;
  monthlySalary: string;
  paymentType: "" | DeliveryPartnerPaymentType;
  vehicleNumber: string;
  warehouseIds: string[];
};

export type DeliveryPartnerFieldErrors = Partial<
  Record<keyof DeliveryPartnerFormValues, string>
>;

/**
 * multiple: admins with every warehouse choose one or more warehouses when adding or editing.
 * single: warehouse staff add a partner to one of their own warehouses.
 * locked: warehouse staff cannot change an existing partner's warehouses.
 */
export type DeliveryPartnerWarehouseMode = "locked" | "multiple" | "single";

export type DeliveryPartnerFormOptions = {
  canManagePay: boolean;
  isEditing: boolean;
  warehouseMode: DeliveryPartnerWarehouseMode;
  /** Warehouses offered in single mode; a choice is required only when there are several. */
  warehouseOptionCount?: number;
};

export type DeliveryPartnerPayload = {
  commissionType?: DeliveryCommissionType;
  commissionValue?: number;
  email?: string | null;
  fullName: string;
  mobileNumber: string;
  monthlySalary?: number;
  paymentType?: DeliveryPartnerPaymentType;
  vehicleNumber?: string | null;
  warehouseIds?: string[];
};

const E164_MOBILE_PATTERN = /^\+[1-9]\d{7,14}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALARY_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_DELIVERY_MONEY = 9_999_999_999.99;

export function getDeliveryPartnerWarehouseMode(
  isSuperAdmin: boolean,
  isEditing: boolean
): DeliveryPartnerWarehouseMode {
  if (isSuperAdmin) {
    return "multiple";
  }

  return isEditing ? "locked" : "single";
}

export function createEmptyDeliveryPartnerForm(
  warehouseIds: string[] = []
): DeliveryPartnerFormValues {
  return {
    commissionType: "",
    commissionValue: "",
    email: "",
    fullName: "",
    mobileNumber: "",
    monthlySalary: "",
    paymentType: "",
    vehicleNumber: "",
    warehouseIds
  };
}

export function deliveryPartnerToFormValues(
  partner: AdminDeliveryPartner
): DeliveryPartnerFormValues {
  const { payment } = partner;

  return {
    commissionType: payment.commissionType ?? "",
    commissionValue: payment.commissionValue === null ? "" : String(payment.commissionValue),
    email: partner.email ?? "",
    fullName: partner.fullName,
    mobileNumber: partner.mobileNumber,
    monthlySalary: payment.monthlySalary === null ? "" : String(payment.monthlySalary),
    paymentType: payment.paymentType ?? "",
    vehicleNumber: partner.vehicleNumber ?? "",
    warehouseIds: partner.warehouses.map((warehouse) => warehouse.id)
  };
}

/** Accepts common spacing such as "+91 98765-43210" and returns the E.164 form the API expects. */
export function normalizeDeliveryMobileNumber(value: string) {
  return value.replace(/[\s()-]/g, "");
}

export function validateDeliveryPartnerForm(
  values: DeliveryPartnerFormValues,
  options: DeliveryPartnerFormOptions
): DeliveryPartnerFieldErrors {
  const errors: DeliveryPartnerFieldErrors = {};
  const fullName = values.fullName.trim();
  const mobileNumber = normalizeDeliveryMobileNumber(values.mobileNumber);
  const email = values.email.trim();

  if (!fullName) {
    errors.fullName = "Enter the partner's full name.";
  } else if (fullName.length > DELIVERY_PARTNER_NAME_MAX_LENGTH) {
    errors.fullName = `Use ${DELIVERY_PARTNER_NAME_MAX_LENGTH} characters or fewer for the name.`;
  }

  if (!mobileNumber) {
    errors.mobileNumber = "Enter the partner's mobile number.";
  } else if (!E164_MOBILE_PATTERN.test(mobileNumber)) {
    errors.mobileNumber =
      "Enter the mobile number with its country code, for example +919876543210.";
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address, or leave it blank.";
  }

  if (values.vehicleNumber.trim().length > DELIVERY_PARTNER_VEHICLE_MAX_LENGTH) {
    errors.vehicleNumber = `Use ${DELIVERY_PARTNER_VEHICLE_MAX_LENGTH} characters or fewer for the vehicle number.`;
  }

  if (options.warehouseMode === "multiple" && values.warehouseIds.length === 0) {
    errors.warehouseIds = "Select at least one warehouse.";
  }

  if (
    options.warehouseMode === "single" &&
    !options.isEditing &&
    (options.warehouseOptionCount ?? 0) > 1 &&
    values.warehouseIds.length !== 1
  ) {
    errors.warehouseIds = "Select the warehouse this partner works from.";
  }

  return options.canManagePay ? { ...errors, ...validateDeliveryPartnerPay(values) } : errors;
}

function validateDeliveryPartnerPay(values: DeliveryPartnerFormValues) {
  const errors: DeliveryPartnerFieldErrors = {};

  if (values.paymentType === "SALARY" && toDeliveryMoney(values.monthlySalary) === null) {
    errors.monthlySalary =
      "Enter a monthly salary greater than 0 with up to 2 decimal places.";
  }

  if (values.paymentType === "COMMISSION") {
    const commissionValue = toDeliveryMoney(values.commissionValue);

    if (!values.commissionType) {
      errors.commissionType = "Choose a percentage or fixed commission.";
    }

    if (values.commissionType === "PERCENTAGE") {
      if (commissionValue === null || commissionValue > 100) {
        errors.commissionValue =
          "Enter a percentage from 0.01 to 100 with up to 2 decimal places.";
      }
    } else if (commissionValue === null) {
      errors.commissionValue =
        "Enter an amount per delivery greater than 0 with up to 2 decimal places.";
    }
  }

  return errors;
}

/**
 * Builds a create or edit body that the API accepts. Pay keys are sent only by admins who may
 * manage pay, and warehouses only when the admin may set them, because the API rejects both
 * otherwise.
 */
export function buildDeliveryPartnerPayload(
  values: DeliveryPartnerFormValues,
  options: DeliveryPartnerFormOptions
): DeliveryPartnerPayload {
  const payload: DeliveryPartnerPayload = {
    fullName: values.fullName.trim(),
    mobileNumber: normalizeDeliveryMobileNumber(values.mobileNumber)
  };
  const email = values.email.trim().toLowerCase();
  const vehicleNumber = values.vehicleNumber.trim().toUpperCase();
  const warehouseIds = [...new Set(values.warehouseIds)];

  // Blank optional fields clear the saved value on edit and are left out on create.
  if (email || options.isEditing) {
    payload.email = email || null;
  }

  if (vehicleNumber || options.isEditing) {
    payload.vehicleNumber = vehicleNumber || null;
  }

  if (options.warehouseMode === "multiple") {
    payload.warehouseIds = warehouseIds;
  } else if (
    options.warehouseMode === "single" &&
    !options.isEditing &&
    warehouseIds.length > 0
  ) {
    payload.warehouseIds = warehouseIds.slice(0, 1);
  }

  if (options.canManagePay) {
    if (values.paymentType === "SALARY") {
      payload.paymentType = "SALARY";
      payload.monthlySalary = Number(values.monthlySalary.trim());
    } else if (values.paymentType === "COMMISSION" && values.commissionType) {
      payload.paymentType = "COMMISSION";
      payload.commissionType = values.commissionType;
      payload.commissionValue = Number(values.commissionValue.trim());
    }
  }

  return payload;
}

export type DeliveryLedgerFormValues = {
  amount: string;
  description: string;
  reference: string;
  salaryPeriod: string;
  type: DeliveryLedgerEntryType;
};

export type DeliveryLedgerFieldErrors = Partial<
  Record<keyof DeliveryLedgerFormValues, string>
>;

export type DeliveryLedgerPayload = {
  amount: number;
  description: string;
  reference?: string;
  salaryPeriod?: string;
  type: DeliveryLedgerEntryType;
};

/** The current month as the API's YYYY-MM salary period, in the admin's local time. */
export function getCurrentSalaryPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatSalaryPeriod(period: string) {
  if (!SALARY_PERIOD_PATTERN.test(period)) {
    return period;
  }

  const [year, month] = period.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(year!, month! - 1, 1)
  );
}

/** Salary can be credited only to salary-based partners. */
export function getDeliveryLedgerEntryTypes(
  payment: DeliveryPartnerPayment | null | undefined
): DeliveryLedgerEntryType[] {
  return payment?.paymentType === "SALARY"
    ? ["PAYOUT", "SALARY", "DELIVERY_EARNING"]
    : ["PAYOUT", "DELIVERY_EARNING"];
}

export function formatDeliveryLedgerFormType(type: DeliveryLedgerEntryType) {
  if (type === "PAYOUT") {
    return "Payout";
  }

  return type === "SALARY" ? "Salary credit" : "Earning adjustment";
}

export function formatDeliveryLedgerEntryType(
  entry: Pick<DeliveryLedgerEntry, "deliveryAssignmentId" | "type">
) {
  if (entry.type === "PAYOUT") {
    return "Payout";
  }

  if (entry.type === "SALARY") {
    return "Salary credit";
  }

  return entry.deliveryAssignmentId ? "Delivery commission" : "Delivery earning";
}

/** Payouts leave the wallet; salary and earnings are credited to it. */
export function formatDeliveryLedgerAmount(entry: Pick<DeliveryLedgerEntry, "amount" | "type">) {
  return `${entry.type === "PAYOUT" ? "-" : "+"}${formatCurrency(entry.amount)}`;
}

export function getDefaultDeliveryLedgerDescription(
  type: DeliveryLedgerEntryType,
  salaryPeriod = ""
) {
  if (type === "PAYOUT") {
    return "Wallet payout";
  }

  if (type === "SALARY") {
    return `Salary for ${formatSalaryPeriod(salaryPeriod || getCurrentSalaryPeriod())}`;
  }

  return "Delivery earning adjustment";
}

export function createDeliveryLedgerForm(
  type: DeliveryLedgerEntryType,
  payment: DeliveryPartnerPayment | null | undefined,
  date = new Date()
): DeliveryLedgerFormValues {
  const salaryPeriod = type === "SALARY" ? getCurrentSalaryPeriod(date) : "";
  const monthlySalary = payment?.monthlySalary ?? null;

  return {
    amount: type === "SALARY" && monthlySalary !== null ? String(monthlySalary) : "",
    description: getDefaultDeliveryLedgerDescription(type, salaryPeriod),
    reference: "",
    salaryPeriod,
    type
  };
}

export function validateDeliveryLedgerForm(
  values: DeliveryLedgerFormValues,
  context: { balance: number; payment: DeliveryPartnerPayment | null | undefined }
): DeliveryLedgerFieldErrors {
  const errors: DeliveryLedgerFieldErrors = {};
  const amount = toDeliveryMoney(values.amount);
  const description = values.description.trim();

  if (amount === null) {
    errors.amount = "Enter an amount greater than 0 with up to 2 decimal places.";
  } else if (values.type === "PAYOUT" && amount > context.balance) {
    errors.amount = `A payout cannot exceed the wallet balance of ${formatCurrency(context.balance)}.`;
  }

  if (values.type === "SALARY") {
    if (context.payment?.paymentType !== "SALARY") {
      errors.type = "Salary can be credited only to salary-based partners.";
    }

    if (!SALARY_PERIOD_PATTERN.test(values.salaryPeriod)) {
      errors.salaryPeriod = "Choose the salary month to credit.";
    }
  }

  if (!description) {
    errors.description = "Enter a description for this entry.";
  } else if (description.length > DELIVERY_LEDGER_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Use ${DELIVERY_LEDGER_DESCRIPTION_MAX_LENGTH} characters or fewer for the description.`;
  }

  if (values.reference.trim().length > DELIVERY_LEDGER_REFERENCE_MAX_LENGTH) {
    errors.reference = `Use ${DELIVERY_LEDGER_REFERENCE_MAX_LENGTH} characters or fewer for the reference.`;
  }

  return errors;
}

export function buildDeliveryLedgerPayload(
  values: DeliveryLedgerFormValues
): DeliveryLedgerPayload {
  const payload: DeliveryLedgerPayload = {
    amount: Number(values.amount.trim()),
    description: values.description.trim(),
    type: values.type
  };
  const reference = values.reference.trim();

  if (reference) {
    payload.reference = reference;
  }

  if (values.type === "SALARY") {
    payload.salaryPeriod = values.salaryPeriod;
  }

  return payload;
}

/** A positive rupee amount with at most two decimals, or null when the text is not one. */
function toDeliveryMoney(value: string) {
  const trimmed = value.trim();
  const amount = Number(trimmed);

  if (
    !trimmed ||
    !Number.isFinite(amount) ||
    amount < 0.01 ||
    amount > MAX_DELIVERY_MONEY ||
    Number(amount.toFixed(2)) !== amount
  ) {
    return null;
  }

  return amount;
}

function trimmedOrUndefined(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
