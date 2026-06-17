import type { QueryParams } from "./admin-api";

export const QUOTE_REQUEST_STATUSES = ["NEW", "CONTACTED", "CLOSED"] as const;
export const COUPON_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export const PRODUCT_FEEDBACK_TYPES = ["REVIEW", "QUESTION"] as const;
export const PRODUCT_FEEDBACK_STATUSES = [
  "PENDING",
  "ANSWERED",
  "PUBLISHED"
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
export type CouponType = (typeof COUPON_TYPES)[number];
export type ProductFeedbackType = (typeof PRODUCT_FEEDBACK_TYPES)[number];
export type ProductFeedbackStatus = (typeof PRODUCT_FEEDBACK_STATUSES)[number];

export type PaginatedAdminResponse<T> = {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type AdminQuoteRequest = {
  createdAt: string;
  email: string;
  id: string;
  message: string;
  mobileNumber: string;
  name: string;
  organization: string | null;
  status: QuoteRequestStatus;
};

export type QuoteRequestFilters = {
  status: "" | QuoteRequestStatus;
};

export type AdminCoupon = {
  code: string;
  expiresAt: string | null;
  id: string;
  isActive: boolean;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  startsAt: string | null;
  type: CouponType;
  usageLimit: number | null;
  usedCount: number;
  value: number;
};

export type CouponFilters = {
  search: string;
};

export type CouponFormValues = {
  code: string;
  expiresAt: string;
  isActive: boolean;
  maxDiscount: string;
  minOrderAmount: string;
  startsAt: string;
  type: CouponType;
  usageLimit: string;
  value: string;
};

export type CouponPayload = {
  code: string;
  expiresAt: string | null;
  isActive: boolean;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  startsAt: string | null;
  type: CouponType;
  usageLimit: number | null;
  value: number;
};

export type CouponFieldErrors = Partial<Record<keyof CouponFormValues, string>>;

export type AdminProductFeedback = {
  answer: string | null;
  comment: string | null;
  createdAt: string;
  customerName: string;
  id: string;
  productId: string;
  question: string | null;
  rating: number | null;
  status: string;
  title: string | null;
  type: ProductFeedbackType;
};

export type ProductFeedbackFilters = {
  productId: string;
  status: "" | ProductFeedbackStatus;
  type: "" | ProductFeedbackType;
};

export function createEmptyQuoteRequestFilters(): QuoteRequestFilters {
  return {
    status: ""
  };
}

export function createEmptyCouponFilters(): CouponFilters {
  return {
    search: ""
  };
}

export function createEmptyCouponFormValues(): CouponFormValues {
  return {
    code: "",
    expiresAt: "",
    isActive: true,
    maxDiscount: "",
    minOrderAmount: "",
    startsAt: "",
    type: "PERCENTAGE",
    usageLimit: "",
    value: ""
  };
}

export function createEmptyProductFeedbackFilters(): ProductFeedbackFilters {
  return {
    productId: "",
    status: "",
    type: ""
  };
}

export function buildQuoteRequestQuery(
  filters: QuoteRequestFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    limit,
    page,
    status: filters.status || undefined
  };
}

export function buildCouponQuery(
  filters: CouponFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    limit,
    page,
    search: trimmedOrUndefined(filters.search)
  };
}

export function buildProductFeedbackQuery(
  filters: ProductFeedbackFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    limit,
    page,
    productId: trimmedOrUndefined(filters.productId),
    status: filters.status || undefined,
    type: filters.type || undefined
  };
}

export function buildCouponPayload(values: CouponFormValues): CouponPayload {
  return {
    code: values.code.trim().toUpperCase(),
    expiresAt: trimmedOrNull(values.expiresAt),
    isActive: values.isActive,
    maxDiscount: toNullableNumber(values.maxDiscount),
    minOrderAmount: toNullableNumber(values.minOrderAmount),
    startsAt: trimmedOrNull(values.startsAt),
    type: values.type,
    usageLimit: toNullableInteger(values.usageLimit),
    value: toRequiredNumber(values.value)
  };
}

export function validateCouponForm(values: CouponFormValues): CouponFieldErrors {
  const errors: CouponFieldErrors = {};
  const code = values.code.trim();
  const value = toNumberOrNaN(values.value);
  const minOrderAmount = values.minOrderAmount.trim()
    ? toNumberOrNaN(values.minOrderAmount)
    : null;
  const maxDiscount = values.maxDiscount.trim()
    ? toNumberOrNaN(values.maxDiscount)
    : null;
  const usageLimit = values.usageLimit.trim()
    ? toNumberOrNaN(values.usageLimit)
    : null;

  if (!code) {
    errors.code = "Enter a coupon code.";
  }

  if (!Number.isFinite(value) || value <= 0) {
    errors.value = "Enter a discount value above 0.";
  }

  if (minOrderAmount !== null && (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)) {
    errors.minOrderAmount = "Enter a valid minimum order amount.";
  }

  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) {
    errors.maxDiscount = "Enter a valid maximum discount.";
  }

  if (
    usageLimit !== null &&
    (!Number.isInteger(usageLimit) || usageLimit < 1)
  ) {
    errors.usageLimit = "Enter a whole number above 0.";
  }

  if (
    values.startsAt &&
    values.expiresAt &&
    new Date(values.startsAt).getTime() > new Date(values.expiresAt).getTime()
  ) {
    errors.expiresAt = "Expiry must be after the start date.";
  }

  return errors;
}

export function couponToFormValues(coupon: AdminCoupon): CouponFormValues {
  return {
    code: coupon.code,
    expiresAt: toDateInputValue(coupon.expiresAt),
    isActive: coupon.isActive,
    maxDiscount: coupon.maxDiscount === null ? "" : String(coupon.maxDiscount),
    minOrderAmount:
      coupon.minOrderAmount === null ? "" : String(coupon.minOrderAmount),
    startsAt: toDateInputValue(coupon.startsAt),
    type: coupon.type,
    usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
    value: String(coupon.value)
  };
}

export function formatSupportLabel(value: string) {
  const label = value
    .split("_")
    .map((part) => part.toLowerCase())
    .join(" ");

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatSupportDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function formatCouponDiscount(coupon: Pick<AdminCoupon, "type" | "value">) {
  if (coupon.type === "PERCENTAGE") {
    return `${coupon.value}%`;
  }

  return formatCurrency(coupon.value);
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

function toNullableNumber(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? toNumberOrNaN(trimmed) : null;
}

function toNullableInteger(value: string) {
  const number = toNullableNumber(value);

  return number === null ? null : Math.trunc(number);
}

function toNumberOrNaN(value: string) {
  return Number(value.trim());
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}
