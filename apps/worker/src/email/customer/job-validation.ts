import {
  CUSTOMER_EMAIL_TEMPLATE_KEYS,
  type CustomerEmailAddress,
  type CustomerEmailEvent,
  type CustomerEmailLineItem,
  type SendCustomerEmailJobData
} from "@surgical/types";
import {
  requireIsoDateString,
  requireOneOf,
  requireOptionalString,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "../../queues/job-processing";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
// Resend accepts idempotency keys of up to 256 characters.
const DEDUPE_KEY_PATTERN = /^[A-Za-z0-9:_.-]{1,200}$/;
const EMAIL_PATTERN = /^[^\s<>"@,;]+@[^\s<>"@,;]+\.[^\s<>"@,;]+$/;

export function validateSendCustomerEmailJobData(value: unknown): SendCustomerEmailJobData {
  const data = requireRecordPayload(value, "customer email job");
  requireVersionOne(data);

  const dedupeKey = requireString(data, "dedupeKey");
  if (!DEDUPE_KEY_PATTERN.test(dedupeKey)) {
    throw new Error("dedupeKey must be 1-200 characters of letters, digits, : _ . -");
  }

  const recipient = requireRecordPayload(data.recipient, "recipient");
  const email = requireString(recipient, "email").trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new Error("recipient.email must be a single email address");
  }
  if (typeof recipient.name !== "string") {
    throw new Error("recipient.name must be a string");
  }

  return {
    dedupeKey,
    event: validateEvent(requireRecordPayload(data.event, "event")),
    recipient: {
      customerId: requireOptionalString(recipient, "customerId"),
      email,
      name: recipient.name
    },
    requestedAt: requireIsoDateString(data, "requestedAt"),
    version: 1
  };
}

function validateEvent(event: Record<string, unknown>): CustomerEmailEvent {
  const template = requireOneOf(event, "template", CUSTOMER_EMAIL_TEMPLATE_KEYS);

  switch (template) {
    case "welcome":
      return { template };
    case "account-status":
      return {
        status: requireOneOf(event, "status", ["ACTIVE", "INACTIVE", "BLOCKED"] as const),
        template
      };
    case "order-received":
      return {
        deliveryAddress:
          event.deliveryAddress === null || event.deliveryAddress === undefined
            ? null
            : validateAddress(requireRecordPayload(event.deliveryAddress, "deliveryAddress")),
        discountTotal: requireMoney(event, "discountTotal"),
        grandTotal: requireMoney(event, "grandTotal"),
        items: validateItems(event.items),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        payment: requireOneOf(event, "payment", ["COD", "ONLINE_PENDING", "ONLINE_PAID"] as const),
        placedAt: requireIsoDateString(event, "placedAt"),
        shippingTotal: requireMoney(event, "shippingTotal"),
        subtotal: requireMoney(event, "subtotal"),
        taxTotal: requireMoney(event, "taxTotal"),
        template
      };
    case "order-progress":
      return {
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        status: requireOneOf(event, "status", [
          "CONFIRMED",
          "PACKED",
          "ASSIGNED",
          "OUT_FOR_DELIVERY",
          "DELIVERED"
        ] as const),
        template
      };
    case "order-cancelled":
      return {
        cancellationReason: requireOptionalString(event, "cancellationReason"),
        grandTotal: requireMoney(event, "grandTotal"),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        refund: requireOneOf(event, "refund", ["NOT_DUE", "REQUESTED", "UNDER_REVIEW"] as const),
        template
      };
    case "payment-result":
      return {
        amount: requireMoney(event, "amount"),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        paymentReference: requireOptionalString(event, "paymentReference"),
        status: requireOneOf(event, "status", ["PAID", "FAILED"] as const),
        template
      };
    case "invoice-ready":
      return {
        grandTotal: requireMoney(event, "grandTotal"),
        invoiceNumber: requireString(event, "invoiceNumber"),
        issuedAt: requireIsoDateString(event, "issuedAt"),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        template
      };
    case "return-update":
      return {
        customerNote: requireOptionalString(event, "customerNote"),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        status: requireOneOf(event, "status", ["RECEIVED", "APPROVED", "REJECTED"] as const),
        template
      };
    case "refund-update":
      return {
        amount: requireMoney(event, "amount"),
        orderId: requireString(event, "orderId"),
        orderNumber: requireString(event, "orderNumber"),
        partial: requireBoolean(event, "partial"),
        refundReference: requireOptionalString(event, "refundReference"),
        status: requireOneOf(event, "status", [
          "PENDING",
          "PROCESSING",
          "COMPLETED",
          "FAILED",
          "CANCELLED"
        ] as const),
        template
      };
    case "quote-received":
      return {
        quoteReference: requireString(event, "quoteReference"),
        requestSummary: requireString(event, "requestSummary"),
        submittedAt: requireIsoDateString(event, "submittedAt"),
        template
      };
    case "quotation-available":
      return {
        grandTotal: requireMoney(event, "grandTotal"),
        items: validateItems(event.items),
        quotationNote: requireOptionalString(event, "quotationNote"),
        quoteReference: requireString(event, "quoteReference"),
        revised: requireBoolean(event, "revised"),
        shippingTotal: requireMoney(event, "shippingTotal"),
        subtotal: requireMoney(event, "subtotal"),
        taxTotal: requireMoney(event, "taxTotal"),
        template,
        validUntil:
          event.validUntil === null || event.validUntil === undefined
            ? null
            : requireIsoDateString(event, "validUntil")
      };
    case "question-answered":
      return {
        answer: requireString(event, "answer"),
        productName: requireString(event, "productName"),
        productSlug: requireString(event, "productSlug"),
        question: requireString(event, "question"),
        template
      };
  }
}

function validateItems(value: unknown): CustomerEmailLineItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("items must contain at least one product");
  }

  return value.map((entry) => {
    const item = requireRecordPayload(entry, "item");
    const quantity = item.quantity;

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error("items.quantity must be a positive integer");
    }

    return {
      lineTotal: requireMoney(item, "lineTotal"),
      name: requireString(item, "name"),
      quantity,
      unitPrice: requireMoney(item, "unitPrice")
    };
  });
}

function validateAddress(address: Record<string, unknown>): CustomerEmailAddress {
  return {
    city: requireString(address, "city"),
    fullName: requireString(address, "fullName"),
    landmark: requireOptionalString(address, "landmark"),
    line1: requireString(address, "line1"),
    line2: requireOptionalString(address, "line2"),
    pincode: requireString(address, "pincode"),
    state: requireString(address, "state")
  };
}

function requireMoney(data: Record<string, unknown>, field: string) {
  const value = requireString(data, field).trim();

  if (!MONEY_PATTERN.test(value)) {
    throw new Error(`${field} must be a non-negative decimal amount`);
  }

  return value;
}

function requireBoolean(data: Record<string, unknown>, field: string) {
  const value = data[field];

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}
