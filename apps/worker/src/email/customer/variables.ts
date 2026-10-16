import type {
  CustomerEmailAddress,
  CustomerEmailEvent,
  CustomerEmailLineItem,
  CustomerEmailRecipient
} from "@surgical/types";
import type { CustomerEmailItemVariables, CustomerEmailVariables } from "./render";

export type CustomerEmailSiteSettings = {
  brandName: string;
  siteUrl: string;
  supportEmail: string;
};

type StatusCopy = { label: string; message: string; note?: string };

// OTP sign-up stores this first name until the customer edits their profile.
const PLACEHOLDER_FIRST_NAME = "Customer";

// Customer-facing wording for each committed business state. Copy never claims
// more than the recorded state: an approved return is not a refund, and a
// created order is not a confirmed payment.
const accountStatusCopy: Record<
  Extract<CustomerEmailEvent, { template: "account-status" }>["status"],
  StatusCopy
> = {
  ACTIVE: {
    label: "Active",
    message: "Your account is active. You can sign in and place orders."
  },
  INACTIVE: {
    label: "Inactive",
    message:
      "Your account has been deactivated. Contact our support team if you need help with this change."
  },
  BLOCKED: {
    label: "Blocked",
    message:
      "Access to your account has been restricted. Please contact our support team for assistance."
  }
};

const orderProgressCopy: Record<
  Extract<CustomerEmailEvent, { template: "order-progress" }>["status"],
  StatusCopy
> = {
  CONFIRMED: {
    label: "confirmed",
    message: "Your order is confirmed. We will update you when it is ready for delivery."
  },
  PACKED: {
    label: "packed",
    message: "Your items have been packed and are waiting for delivery."
  },
  ASSIGNED: {
    label: "assigned for delivery",
    message:
      "A delivery partner has been assigned to your order. You can follow its progress in your account."
  },
  OUT_FOR_DELIVERY: {
    label: "out for delivery",
    message:
      "Your order is on its way. Please keep your phone available so the delivery partner can reach you."
  },
  DELIVERED: {
    label: "delivered",
    message:
      "Your order has been marked as delivered. If you have not received it, please contact our support team."
  }
};

const cancellationRefundCopy: Record<
  Extract<CustomerEmailEvent, { template: "order-cancelled" }>["refund"],
  string
> = {
  NOT_DUE: "No payment was collected for this order. No refund is due.",
  REQUESTED:
    "A refund request has been recorded for your payment. We will send a separate update when its status changes.",
  UNDER_REVIEW:
    "Our team will review the payment for this order. We will send a separate update about any refund."
};

const paymentResultCopy: Record<
  Extract<CustomerEmailEvent, { template: "payment-result" }>["status"],
  StatusCopy
> = {
  PAID: {
    label: "received",
    message: "Your payment has been received for this order. Thank you."
  },
  FAILED: {
    label: "failed",
    message:
      "Your payment attempt was unsuccessful. Please check the order before trying again.",
    note: "If your account was debited, contact support with your payment reference so we can check the payment."
  }
};

const returnCopy: Record<
  Extract<CustomerEmailEvent, { template: "return-update" }>["status"],
  StatusCopy
> = {
  RECEIVED: {
    label: "received",
    message:
      "We received your return request. Our team will review it and send you an update."
  },
  APPROVED: {
    label: "approved",
    message:
      "Your return request has been approved. If a refund is due, we will send a separate update about its progress."
  },
  REJECTED: {
    label: "rejected",
    message:
      "Your return request has not been approved. Please contact support if you need more information."
  }
};

const refundCopy: Record<
  Extract<CustomerEmailEvent, { template: "refund-update" }>["status"],
  StatusCopy
> = {
  PENDING: {
    label: "requested",
    message: "Your refund request has been recorded. It has not been completed yet."
  },
  PROCESSING: {
    label: "processing",
    message:
      "Your refund is being processed. We will update you when the payment provider confirms the result."
  },
  COMPLETED: {
    label: "completed",
    message: "The payment provider has confirmed that your refund is complete.",
    note: "The time it takes to appear in your account depends on your bank or payment provider."
  },
  FAILED: {
    label: "failed",
    message:
      "The refund attempt was unsuccessful. Please contact support so we can help with the next step."
  },
  CANCELLED: {
    label: "cancelled",
    message:
      "This refund request has been cancelled. Please contact support if you need more information."
  }
};

const inr = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency"
});
const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kolkata",
  year: "numeric"
});

export function formatMoney(value: string) {
  const amount = Number(value);

  if (!/^-?\d+(\.\d+)?$/.test(value.trim()) || !Number.isFinite(amount)) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  return inr.format(amount);
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }

  return longDate.format(date);
}

export function formatAddress(address: CustomerEmailAddress) {
  return [
    address.fullName,
    address.line1,
    address.line2,
    address.landmark,
    `${address.city}, ${address.state} ${address.pincode}`
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildCustomerEmailVariables(
  event: CustomerEmailEvent,
  recipient: CustomerEmailRecipient,
  settings: CustomerEmailSiteSettings
): CustomerEmailVariables {
  const site = settings.siteUrl.replace(/\/+$/, "");
  const orderUrl = (orderId: string) =>
    `${site}/account/orders/${encodeURIComponent(orderId)}`;
  const common = {
    brand_name: settings.brandName,
    customer_name: greetingName(recipient.name),
    site_url: site,
    support_email: settings.supportEmail
  };

  switch (event.template) {
    case "welcome":
      return { ...common, account_url: `${site}/account` };
    case "account-status": {
      const copy = accountStatusCopy[event.status];
      return { ...common, status_label: copy.label, status_message: copy.message };
    }
    case "order-received": {
      const total = formatMoney(event.grandTotal);
      const payment = {
        COD: {
          label: "Cash on delivery",
          message: `${total} is payable when your order is delivered.`
        },
        ONLINE_PENDING: {
          label: "Online payment pending",
          message:
            "Your order has been created. Payment has not been confirmed yet. Check your order for the latest payment status."
        },
        ONLINE_PAID: {
          label: "Paid online",
          message: `Payment of ${total} has been received.`
        }
      }[event.payment];
      return {
        ...common,
        delivery_address: event.deliveryAddress ? formatAddress(event.deliveryAddress) : null,
        discount_total: formatMoney(event.discountTotal),
        items: formatItems(event.items),
        order_date: formatDate(event.placedAt),
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        payment_label: payment.label,
        payment_message: payment.message,
        shipping_total: formatMoney(event.shippingTotal),
        subtotal: formatMoney(event.subtotal),
        tax_total: formatMoney(event.taxTotal),
        total
      };
    }
    case "order-progress": {
      const copy = orderProgressCopy[event.status];
      return {
        ...common,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        status_label: copy.label,
        status_message: copy.message
      };
    }
    case "order-cancelled":
      return {
        ...common,
        cancellation_reason: event.cancellationReason,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        refund_message: cancellationRefundCopy[event.refund],
        total: formatMoney(event.grandTotal)
      };
    case "payment-result": {
      const copy = paymentResultCopy[event.status];
      return {
        ...common,
        amount: formatMoney(event.amount),
        customer_note: copy.note ?? null,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        payment_reference: event.paymentReference,
        status_label: copy.label,
        status_message: copy.message
      };
    }
    case "invoice-ready":
      return {
        ...common,
        invoice_date: formatDate(event.issuedAt),
        invoice_number: event.invoiceNumber,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        total: formatMoney(event.grandTotal)
      };
    case "return-update": {
      const copy = returnCopy[event.status];
      return {
        ...common,
        customer_note: event.customerNote,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        status_label: copy.label,
        status_message: copy.message
      };
    }
    case "refund-update": {
      const copy = refundCopy[event.status];
      const amount = formatMoney(event.amount);
      return {
        ...common,
        customer_note: copy.note ?? null,
        order_number: event.orderNumber,
        order_url: orderUrl(event.orderId),
        refund_amount: amount,
        refund_reference: event.refundReference,
        status_label: copy.label,
        status_message:
          event.status === "COMPLETED" && event.partial
            ? `The payment provider has confirmed a partial refund of ${amount} for this order.`
            : copy.message
      };
    }
    case "quote-received":
      return {
        ...common,
        quote_reference: event.quoteReference,
        quotes_url: `${site}/account/quotes`,
        request_date: formatDate(event.submittedAt),
        request_summary: event.requestSummary
      };
    case "quotation-available":
      return {
        ...common,
        items: formatItems(event.items),
        quotation_message: event.revised
          ? "We have updated your quotation. Please review the latest details before accepting."
          : "We have prepared a quotation for your request. Please review the items and prices below.",
        quotation_note: event.quotationNote,
        quote_reference: event.quoteReference,
        quotes_url: `${site}/account/quotes`,
        shipping_total: formatMoney(event.shippingTotal),
        subtotal: formatMoney(event.subtotal),
        tax_total: formatMoney(event.taxTotal),
        total: formatMoney(event.grandTotal),
        valid_until: event.validUntil ? formatDate(event.validUntil) : null
      };
    case "question-answered":
      return {
        ...common,
        answer: event.answer,
        product_name: event.productName,
        product_url: `${site}/products/${encodeURIComponent(event.productSlug)}`,
        question: event.question
      };
  }
}

function greetingName(name: string) {
  const trimmed = name.trim();
  return !trimmed || trimmed === PLACEHOLDER_FIRST_NAME ? "there" : trimmed;
}

function formatItems(items: CustomerEmailLineItem[]): CustomerEmailItemVariables[] {
  return items.map((item) => ({
    line_total: formatMoney(item.lineTotal),
    name: item.name,
    quantity: item.quantity,
    unit_price: formatMoney(item.unitPrice)
  }));
}
