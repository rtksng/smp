import type { QueryParams } from "./admin-api";

export const QUOTE_REQUEST_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED"
] as const;
export const COUPON_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export const PRODUCT_FEEDBACK_TYPES = ["REVIEW", "QUESTION"] as const;
export const PRODUCT_FEEDBACK_STATUSES = [
  "PENDING_REVIEW",
  "PENDING",
  "ANSWERED",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN"
] as const;
export const PRODUCT_REVIEW_MODERATION_STATUSES = [
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "HIDDEN"
] as const;
export const PRODUCT_QUESTION_MODERATION_STATUSES = [
  "PENDING",
  "HIDDEN"
] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
export type CouponType = (typeof COUPON_TYPES)[number];
export type ProductFeedbackType = (typeof PRODUCT_FEEDBACK_TYPES)[number];
export type ProductFeedbackStatus = (typeof PRODUCT_FEEDBACK_STATUSES)[number];
export type ProductReviewModerationStatus =
  (typeof PRODUCT_REVIEW_MODERATION_STATUSES)[number];
export type ProductQuestionModerationStatus =
  (typeof PRODUCT_QUESTION_MODERATION_STATUSES)[number];

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
  convertedOrderId?: string | null;
  createdAt: string;
  convertedCartId: string | null;
  customerDecision: {
    decidedAt: string;
    note: string | null;
    status: "ACCEPTED" | "REJECTED";
  } | null;
  email: string;
  id: string;
  message: string;
  mobileNumber: string;
  name: string;
  organization: string | null;
  quotation: {
    items: Array<{
      lineSubtotal: number;
      lineTotal: number;
      name: string;
      productId: string | null;
      quantity: number;
      sku: string;
      taxAmount: number;
      taxRate: number;
      unitPrice: number;
      variantId: string | null;
    }>;
    notes: string | null;
    respondedAt: string;
    totals: {
      grandTotal: number;
      shippingTotal: number;
      subtotal: number;
      taxTotal: number;
    };
    validUntil: string | null;
  } | null;
  status: QuoteRequestStatus;
};

export type QuoteRequestFilters = {
  status: "" | QuoteRequestStatus;
};

export type QuoteResponseLineFormValues = {
  name: string;
  productId: string;
  quantity: string;
  sku: string;
  taxRate: string;
  unitPrice: string;
  variantId: string;
};

export type QuoteResponseDraft = {
  items: QuoteResponseLineFormValues[];
  notes: string;
  shippingTotal: string;
  validUntil: string;
};

export type QuoteResponsePayload = {
  items: Array<{
    name: string;
    productId?: string | null;
    quantity: number;
    sku: string;
    taxRate?: number;
    unitPrice: number;
    variantId?: string | null;
  }>;
  notes?: string;
  shippingTotal?: number;
  validUntil?: string;
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
  productName: string;
  question: string | null;
  rating: number | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  status: string;
  title: string | null;
  type: ProductFeedbackType;
};

export type ProductFeedbackFilters = {
  productId: string;
  productSearch: string;
  status: "" | ProductFeedbackStatus;
  type: "" | ProductFeedbackType;
};

export function createEmptyQuoteRequestFilters(): QuoteRequestFilters {
  return {
    status: ""
  };
}

export function createEmptyQuoteResponseLine(): QuoteResponseLineFormValues {
  return {
    name: "",
    productId: "",
    quantity: "1",
    sku: "",
    taxRate: "0",
    unitPrice: "",
    variantId: ""
  };
}

export function createEmptyQuoteResponseDraft(): QuoteResponseDraft {
  return {
    items: [createEmptyQuoteResponseLine()],
    notes: "",
    shippingTotal: "0",
    validUntil: ""
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
    productSearch: "",
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

export function validateQuoteResponseDraft(values: QuoteResponseDraft) {
  const errors: string[] = [];

  if (values.items.length === 0 || values.items.length > 100) {
    errors.push("Add between 1 and 100 quoted items.");
  }

  values.items.forEach((item, index) => {
    const lineLabel = `Line ${index + 1}`;
    const quantity = toNumberOrNaN(item.quantity);
    const unitPrice = toNumberOrNaN(item.unitPrice);
    const taxRate = item.taxRate.trim() ? toNumberOrNaN(item.taxRate) : 0;

    if (!item.sku.trim() || item.sku.trim().length > 120) {
      errors.push(`${lineLabel}: enter a SKU.`);
    }

    if (!item.name.trim() || item.name.trim().length > 240) {
      errors.push(`${lineLabel}: enter an item name.`);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) {
      errors.push(`${lineLabel}: quantity must be a whole number above 0.`);
    }

    if (!validQuoteAmount(unitPrice)) {
      errors.push(`${lineLabel}: enter a valid unit price with at most 2 decimal places.`);
    }

    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.push(`${lineLabel}: tax rate must be between 0 and 100.`);
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (item.productId.trim() && !uuid.test(item.productId.trim())) errors.push(`${lineLabel}: enter a valid product ID.`);
    if (item.variantId.trim() && (!item.productId.trim() || !uuid.test(item.variantId.trim()))) errors.push(`${lineLabel}: a valid variant ID requires a product ID.`);
  });

  const shippingTotal = values.shippingTotal.trim()
    ? toNumberOrNaN(values.shippingTotal)
    : 0;

  if (!validQuoteAmount(shippingTotal)) {
    errors.push("Enter valid shipping with at most 2 decimal places.");
  }
  if (values.notes.trim().length > 1000) errors.push("Quotation notes must be 1000 characters or fewer.");
  if (values.validUntil) {
    const deadline = new Date(`${values.validUntil}T23:59:59.999Z`).getTime();
    if (!Number.isFinite(deadline) || deadline < Date.now()) errors.push("Choose today or a future date for quotation validity.");
  }
  if (calculateQuoteResponseDraftTotals(values).grandTotal > 9_999_999_999.99) errors.push("The quotation total exceeds the supported amount.");

  return errors;
}

export function calculateQuoteResponseDraftTotals(values: QuoteResponseDraft) {
  const lineTotals = values.items.map((item) => {
    const quantity = finiteNumber(item.quantity);
    const unitPrice = finiteNumber(item.unitPrice);
    const taxRate = finiteNumber(item.taxRate);
    const subtotal = roundMoney(quantity * unitPrice);
    const taxAmount = roundMoney(subtotal * (taxRate / 100));

    return {
      subtotal,
      taxAmount,
      total: roundMoney(subtotal + taxAmount)
    };
  });
  const subtotal = roundMoney(
    lineTotals.reduce((sum, line) => sum + line.subtotal, 0)
  );
  const taxTotal = roundMoney(
    lineTotals.reduce((sum, line) => sum + line.taxAmount, 0)
  );
  const shippingTotal = roundMoney(finiteNumber(values.shippingTotal));

  return {
    grandTotal: roundMoney(subtotal + taxTotal + shippingTotal),
    shippingTotal,
    subtotal,
    taxTotal
  };
}

export function buildQuoteResponsePayload(
  values: QuoteResponseDraft
): QuoteResponsePayload {
  return {
    items: values.items.map((item) => ({
      name: item.name.trim(),
      productId: trimmedOrNull(item.productId),
      quantity: Math.trunc(toNumberOrNaN(item.quantity)),
      sku: item.sku.trim(),
      taxRate: item.taxRate.trim() ? toNumberOrNaN(item.taxRate) : 0,
      unitPrice: toNumberOrNaN(item.unitPrice),
      variantId: trimmedOrNull(item.variantId)
    })),
    notes: trimmedOrUndefined(values.notes),
    shippingTotal: values.shippingTotal.trim()
      ? toNumberOrNaN(values.shippingTotal)
      : 0,
    validUntil: trimmedOrUndefined(values.validUntil)
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
    productSearch: trimmedOrUndefined(filters.productSearch),
    status: filters.status || undefined,
    type: filters.type || undefined
  };
}

function validQuoteAmount(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 9_999_999_999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.001;
}

export function getQuoteRequestStatusOptions(quote: AdminQuoteRequest): QuoteRequestStatus[] {
  const next: QuoteRequestStatus[] = quote.status === "CLOSED"
    ? (quote.convertedCartId || quote.convertedOrderId ? [] : ["CONTACTED"])
    : quote.status === "NEW" ? ["CONTACTED", "CLOSED"]
    : quote.status === "CONTACTED" && !quote.quotation ? ["NEW", "CLOSED"]
    : ["CLOSED"];
  return Array.from(new Set([quote.status, ...next]));
}

export function buildProductFeedbackModerationPayload(
  status: ProductFeedbackStatus,
  moderationNote: string
) {
  return {
    moderationNote: trimmedOrUndefined(moderationNote),
    status
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
  } else if (code.length > 64) {
    errors.code = "Use 64 characters or fewer for the coupon code.";
  }

  if (!isCouponMoney(value) || value < 0.01) {
    errors.value = "Enter a discount from 0.01 to 9,999,999,999.99 with up to 2 decimal places.";
  }

  if (minOrderAmount !== null && !isCouponMoney(minOrderAmount)) {
    errors.minOrderAmount = "Enter a minimum order amount from 0 to 9,999,999,999.99 with up to 2 decimal places.";
  }

  if (maxDiscount !== null && !isCouponMoney(maxDiscount)) {
    errors.maxDiscount = "Enter a maximum discount from 0 to 9,999,999,999.99 with up to 2 decimal places.";
  }

  if (
    usageLimit !== null &&
    (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 2_147_483_647)
  ) {
    errors.usageLimit = "Enter a whole number from 1 to 2,147,483,647.";
  }

  if (values.startsAt && !Number.isFinite(Date.parse(values.startsAt))) {
    errors.startsAt = "Enter a valid start date.";
  }
  if (values.expiresAt && !Number.isFinite(Date.parse(values.expiresAt))) {
    errors.expiresAt = "Enter a valid expiry date.";
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

function isCouponMoney(value: number) {
  return Number.isFinite(value) && value >= 0 && value < 10_000_000_000 && Number(value.toFixed(2)) === value;
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

export function getProductFeedbackStatusTone(status: string) {
  if (status === "PENDING_REVIEW") {
    return "PENDING";
  }

  return status;
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

function finiteNumber(value: string) {
  const number = toNumberOrNaN(value);

  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
