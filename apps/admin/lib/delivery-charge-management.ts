import type { QueryParams } from "./admin-api";

export type AdminDeliveryChargeRule = {
  charge: number;
  createdAt: string;
  freeDeliveryThreshold: number | null;
  id: string;
  isActive: boolean;
  maxOrderAmount: number | null;
  minOrderAmount: number | null;
  name: string;
  pincode: string | null;
  priority: number;
  updatedAt: string;
  warehouse: {
    code: string;
    id: string;
    name: string;
  } | null;
  warehouseId: string | null;
};

export type DeliveryChargeFilters = {
  isActive: "" | "false" | "true";
  pincode: string;
  search: string;
  warehouseId: string;
};

export type DeliveryChargeFormValues = {
  charge: string;
  freeDeliveryThreshold: string;
  isActive: boolean;
  maxOrderAmount: string;
  minOrderAmount: string;
  name: string;
  pincode: string;
  priority: string;
  warehouseId: string;
};

export type DeliveryChargePayload = {
  charge: number;
  freeDeliveryThreshold: number | null;
  isActive: boolean;
  maxOrderAmount: number | null;
  minOrderAmount: number | null;
  name: string;
  pincode: string | null;
  priority: number;
  warehouseId: string | null;
};

export type DeliveryChargeFieldErrors = Partial<
  Record<keyof DeliveryChargeFormValues, string>
>;

export type PaginatedDeliveryChargeResponse = {
  items: AdminDeliveryChargeRule[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export function createEmptyDeliveryChargeFilters(): DeliveryChargeFilters {
  return {
    isActive: "",
    pincode: "",
    search: "",
    warehouseId: ""
  };
}

export function createEmptyDeliveryChargeFormValues(): DeliveryChargeFormValues {
  return {
    charge: "",
    freeDeliveryThreshold: "",
    isActive: true,
    maxOrderAmount: "",
    minOrderAmount: "",
    name: "",
    pincode: "",
    priority: "0",
    warehouseId: ""
  };
}

export function buildDeliveryChargeQuery(
  filters: DeliveryChargeFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    isActive:
      filters.isActive === ""
        ? undefined
        : filters.isActive === "true",
    limit,
    page,
    pincode: trimmedOrUndefined(filters.pincode),
    search: trimmedOrUndefined(filters.search),
    warehouseId: filters.warehouseId || undefined
  };
}

export function validateDeliveryChargeFilters(
  filters: DeliveryChargeFilters
): string | null {
  const pincode = filters.pincode.trim();

  return pincode && !/^\d{6}$/.test(pincode)
    ? "Pincode must be exactly 6 digits."
    : null;
}

export function buildDeliveryChargePayload(
  values: DeliveryChargeFormValues
): DeliveryChargePayload {
  return {
    charge: toRequiredNumber(values.charge),
    freeDeliveryThreshold: toNullableNumber(values.freeDeliveryThreshold),
    isActive: values.isActive,
    maxOrderAmount: toNullableNumber(values.maxOrderAmount),
    minOrderAmount: toNullableNumber(values.minOrderAmount),
    name: values.name.trim(),
    pincode: trimmedOrNull(values.pincode),
    priority: toRequiredInteger(values.priority),
    warehouseId: trimmedOrNull(values.warehouseId)
  };
}

export function validateDeliveryChargeForm(
  values: DeliveryChargeFormValues
): DeliveryChargeFieldErrors {
  const errors: DeliveryChargeFieldErrors = {};
  const charge = toNumberOrNaN(values.charge);
  const priority = toNumberOrNaN(values.priority);
  const minOrderAmount = values.minOrderAmount.trim()
    ? toNumberOrNaN(values.minOrderAmount)
    : null;
  const maxOrderAmount = values.maxOrderAmount.trim()
    ? toNumberOrNaN(values.maxOrderAmount)
    : null;
  const freeDeliveryThreshold = values.freeDeliveryThreshold.trim()
    ? toNumberOrNaN(values.freeDeliveryThreshold)
    : null;
  const pincode = values.pincode.trim();

  const name = values.name.trim();

  if (!name) {
    errors.name = "Enter a rule name.";
  } else if (name.length > 160) {
    errors.name = "Rule name must be 160 characters or fewer.";
  }

  if (!values.charge.trim() || !Number.isFinite(charge) || charge < 0) {
    errors.charge = "Enter a delivery charge of 0 or above.";
  }

  if (pincode && !/^\d{6}$/.test(pincode)) {
    errors.pincode = "Pincode must be exactly 6 digits.";
  }

  if (
    minOrderAmount !== null &&
    (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)
  ) {
    errors.minOrderAmount = "Enter a minimum order amount of 0 or above.";
  }

  if (
    maxOrderAmount !== null &&
    (!Number.isFinite(maxOrderAmount) || maxOrderAmount < 0)
  ) {
    errors.maxOrderAmount = "Enter a maximum order amount of 0 or above.";
  }

  if (
    minOrderAmount !== null &&
    maxOrderAmount !== null &&
    minOrderAmount > maxOrderAmount
  ) {
    errors.maxOrderAmount =
      "Maximum order amount must be greater than minimum order amount.";
  }

  if (
    freeDeliveryThreshold !== null &&
    (!Number.isFinite(freeDeliveryThreshold) || freeDeliveryThreshold < 0)
  ) {
    errors.freeDeliveryThreshold =
      "Enter a free delivery threshold of 0 or above.";
  }

  if (!Number.isInteger(priority)) {
    errors.priority = "Priority must be a whole number.";
  }

  return errors;
}

export function deliveryChargeRuleToFormValues(
  rule: AdminDeliveryChargeRule
): DeliveryChargeFormValues {
  return {
    charge: String(rule.charge),
    freeDeliveryThreshold:
      rule.freeDeliveryThreshold === null
        ? ""
        : String(rule.freeDeliveryThreshold),
    isActive: rule.isActive,
    maxOrderAmount:
      rule.maxOrderAmount === null ? "" : String(rule.maxOrderAmount),
    minOrderAmount:
      rule.minOrderAmount === null ? "" : String(rule.minOrderAmount),
    name: rule.name,
    pincode: rule.pincode ?? "",
    priority: String(rule.priority),
    warehouseId: rule.warehouseId ?? ""
  };
}

export function formatDeliveryScope(rule: AdminDeliveryChargeRule) {
  const parts = [
    rule.pincode ? `PIN ${rule.pincode}` : "All pincodes",
    rule.warehouse ? rule.warehouse.code : "All warehouses"
  ];

  return parts.join(" / ");
}

export function formatDeliveryRange(rule: AdminDeliveryChargeRule) {
  if (rule.minOrderAmount === null && rule.maxOrderAmount === null) {
    return "All order values";
  }

  if (rule.minOrderAmount !== null && rule.maxOrderAmount !== null) {
    return `${formatCurrency(rule.minOrderAmount)} - ${formatCurrency(rule.maxOrderAmount)}`;
  }

  if (rule.minOrderAmount !== null) {
    return `From ${formatCurrency(rule.minOrderAmount)}`;
  }

  return `Up to ${formatCurrency(rule.maxOrderAmount)}`;
}

export function formatCurrency(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
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

function trimmedOrNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function toRequiredNumber(value: string) {
  return toNumberOrNaN(value);
}

function toRequiredInteger(value: string) {
  return Math.trunc(toNumberOrNaN(value || "0"));
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? toNumberOrNaN(trimmed) : null;
}

function toNumberOrNaN(value: string) {
  return Number(value.trim());
}
