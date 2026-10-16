import type { CustomerEmailTemplateKey } from "@surgical/types";
import { details, items, note, paragraph as p, textItems } from "./layout";

export type CustomerEmailTemplate = {
  actionLabel: string;
  actionUrl: string;
  body: string;
  category: "Account" | "Orders" | "Payments" | "Quotations" | "Returns" | "Support";
  heading: string;
  key: CustomerEmailTemplateKey;
  name: string;
  optional?: readonly string[];
  preheader: string;
  required: readonly string[];
  subject: string;
  text: string;
  trigger: string;
};

const orderRows: Array<[string, string]> = [
  ["Order", "{{order_number}}"],
  ["Total", "{{total}}"]
];

export const customerEmailTemplates: readonly CustomerEmailTemplate[] = [
  {
    key: "welcome",
    name: "Welcome",
    category: "Account",
    trigger:
      "Once for a new customer after an email address becomes available; never on every OTP login.",
    subject: "Welcome to {{brand_name}}",
    preheader: "Your account is ready.",
    heading: "Welcome to {{brand_name}}",
    body: p(
      "Your customer account is ready. You can view your orders, manage delivery addresses, and request bulk quotations from your account."
    ),
    text: "Your customer account is ready. You can view your orders, manage delivery addresses, and request bulk quotations from your account.",
    actionLabel: "View your account",
    actionUrl: "{{account_url}}",
    required: ["account_url"]
  },
  {
    key: "account-status",
    name: "Account status update",
    category: "Account",
    trigger: "After an admin changes customer status to ACTIVE, INACTIVE, or BLOCKED.",
    subject: "Your account: {{status_label}}",
    preheader: "An update to your customer account.",
    heading: "Your account has been updated",
    body:
      p("{{status_message}}") +
      details([["Account status", "{{status_label}}"]]) +
      "{{#if customer_note}}" +
      note("{{customer_note}}") +
      "{{/if}}",
    text: "{{status_message}}\n\nAccount status: {{status_label}}\n{{#if customer_note}}\n{{customer_note}}\n{{/if}}",
    actionLabel: "Contact support",
    actionUrl: "mailto:{{support_email}}",
    required: ["status_label", "status_message"],
    optional: ["customer_note"]
  },
  {
    key: "order-received",
    name: "Order received",
    category: "Orders",
    trigger:
      "After a new checkout or quotation order is committed; online payment may still be pending.",
    subject: "We received order {{order_number}}",
    preheader: "Your order summary and payment details.",
    heading: "We received your order",
    body:
      p("Thank you for placing an order. Here are your order details.") +
      details([
        ["Order", "{{order_number}}"],
        ["Placed on", "{{order_date}}"],
        ["Payment", "{{payment_label}}"]
      ]) +
      note("{{payment_message}}") +
      items +
      details([
        ["Subtotal", "{{subtotal}}"],
        ["Discount", "{{discount_total}}"],
        ["Tax", "{{tax_total}}"],
        ["Delivery", "{{shipping_total}}"],
        ["Total", "<strong>{{total}}</strong>"]
      ]) +
      "{{#if delivery_address}}" +
      p("<strong>Deliver to</strong><br>{{delivery_address}}") +
      "{{/if}}",
    text:
      "Thank you for placing an order.\n\nOrder: {{order_number}}\nPlaced on: {{order_date}}\nPayment: {{payment_label}}\n{{payment_message}}\n\n" +
      textItems +
      "\nSubtotal: {{subtotal}}\nDiscount: {{discount_total}}\nTax: {{tax_total}}\nDelivery: {{shipping_total}}\nTotal: {{total}}\n{{#if delivery_address}}\nDeliver to: {{delivery_address}}\n{{/if}}",
    actionLabel: "View order",
    actionUrl: "{{order_url}}",
    required: [
      "order_url",
      "order_number",
      "order_date",
      "payment_label",
      "payment_message",
      "items",
      "subtotal",
      "discount_total",
      "tax_total",
      "shipping_total",
      "total"
    ],
    optional: ["delivery_address"]
  },
  {
    key: "order-progress",
    name: "Order progress",
    category: "Orders",
    trigger: "After a committed customer-visible order or delivery status transition.",
    subject: "Order {{order_number}}: {{status_label}}",
    preheader: "{{status_message}}",
    heading: "Your order is {{status_label}}",
    body:
      p("{{status_message}}") +
      details([
        ["Order", "{{order_number}}"],
        ["Status", "{{status_label}}"]
      ]),
    text: "{{status_message}}\n\nOrder: {{order_number}}\nStatus: {{status_label}}",
    actionLabel: "Track your order",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "status_label", "status_message"]
  },
  {
    key: "order-cancelled",
    name: "Order cancelled",
    category: "Orders",
    trigger:
      "After customer or admin cancellation is committed. Report a refund only from its actual recorded status.",
    subject: "Order {{order_number}} has been cancelled",
    preheader: "Your cancellation and payment details.",
    heading: "Your order has been cancelled",
    body:
      p("Order {{order_number}} has been cancelled.") +
      details(orderRows) +
      "{{#if cancellation_reason}}" +
      p("<strong>Reason</strong><br>{{cancellation_reason}}") +
      "{{/if}}" +
      note("{{refund_message}}"),
    text: "Order {{order_number}} has been cancelled.\n\nOrder total: {{total}}\n{{#if cancellation_reason}}Reason: {{cancellation_reason}}\n{{/if}}\n{{refund_message}}",
    actionLabel: "View order",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "total", "refund_message"],
    optional: ["cancellation_reason"]
  },
  {
    key: "payment-result",
    name: "Payment result",
    category: "Payments",
    trigger:
      "After verified online payment or recorded COD collection changes payment status to PAID or FAILED.",
    subject: "Payment {{status_label}} for order {{order_number}}",
    preheader: "{{status_message}}",
    heading: "Payment {{status_label}}",
    body:
      p("{{status_message}}") +
      details([
        ["Order", "{{order_number}}"],
        ["Amount", "{{amount}}"],
        ["Payment status", "{{status_label}}"]
      ]) +
      "{{#if payment_reference}}" +
      p("Payment reference: {{payment_reference}}") +
      "{{/if}}{{#if customer_note}}" +
      note("{{customer_note}}") +
      "{{/if}}",
    text: "{{status_message}}\n\nOrder: {{order_number}}\nAmount: {{amount}}\nPayment status: {{status_label}}\n{{#if payment_reference}}Payment reference: {{payment_reference}}\n{{/if}}{{#if customer_note}}\n{{customer_note}}\n{{/if}}",
    actionLabel: "View payment details",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "amount", "status_label", "status_message"],
    optional: ["payment_reference", "customer_note"]
  },
  {
    key: "invoice-ready",
    name: "Invoice ready",
    category: "Payments",
    trigger:
      "Only after an invoice record is available for an eligible order. Link to the authenticated order page, not the protected API endpoint.",
    subject: "Invoice {{invoice_number}} for order {{order_number}}",
    preheader: "Your invoice is available in your account.",
    heading: "Your invoice is ready",
    body:
      p(
        "Your invoice is available. Open your order and select Download invoice to save a copy."
      ) +
      details([
        ["Invoice", "{{invoice_number}}"],
        ["Order", "{{order_number}}"],
        ["Invoice date", "{{invoice_date}}"],
        ["Total", "{{total}}"]
      ]),
    text: "Your invoice is available. Open your order and select Download invoice to save a copy.\n\nInvoice: {{invoice_number}}\nOrder: {{order_number}}\nInvoice date: {{invoice_date}}\nTotal: {{total}}",
    actionLabel: "View invoice in your account",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "invoice_number", "invoice_date", "total"]
  },
  {
    key: "return-update",
    name: "Return request update",
    category: "Returns",
    trigger:
      "After return submission or admin approval/rejection is committed. Return approval and refund completion are separate events.",
    subject: "Return {{status_label}} for order {{order_number}}",
    preheader: "{{status_message}}",
    heading: "Return request {{status_label}}",
    body:
      p("{{status_message}}") +
      details([
        ["Order", "{{order_number}}"],
        ["Return status", "{{status_label}}"]
      ]) +
      "{{#if customer_note}}" +
      note("{{customer_note}}") +
      "{{/if}}",
    text: "{{status_message}}\n\nOrder: {{order_number}}\nReturn status: {{status_label}}\n{{#if customer_note}}\n{{customer_note}}\n{{/if}}",
    actionLabel: "View return details",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "status_label", "status_message"],
    optional: ["customer_note"]
  },
  {
    key: "refund-update",
    name: "Refund update",
    category: "Returns",
    trigger:
      "After a recorded refund transition, including provider-confirmed completion or failure. Handle partial amounts explicitly.",
    subject: "Refund {{status_label}} for order {{order_number}}",
    preheader: "{{status_message}}",
    heading: "Refund {{status_label}}",
    body:
      p("{{status_message}}") +
      details([
        ["Order", "{{order_number}}"],
        ["Refund amount", "{{refund_amount}}"],
        ["Refund status", "{{status_label}}"]
      ]) +
      "{{#if refund_reference}}" +
      p("Refund reference: {{refund_reference}}") +
      "{{/if}}{{#if customer_note}}" +
      note("{{customer_note}}") +
      "{{/if}}",
    text: "{{status_message}}\n\nOrder: {{order_number}}\nRefund amount: {{refund_amount}}\nRefund status: {{status_label}}\n{{#if refund_reference}}Refund reference: {{refund_reference}}\n{{/if}}{{#if customer_note}}\n{{customer_note}}\n{{/if}}",
    actionLabel: "View refund details",
    actionUrl: "{{order_url}}",
    required: [
      "order_url",
      "order_number",
      "refund_amount",
      "status_label",
      "status_message"
    ],
    optional: ["refund_reference", "customer_note"]
  },
  {
    key: "quote-received",
    name: "Quote request received",
    category: "Quotations",
    trigger:
      "After a bulk quote request is saved. Use the request's supplied email, including for guest enquiries.",
    subject: "We received quote request {{quote_reference}}",
    preheader: "Your bulk quote request is with our team.",
    heading: "We received your quote request",
    body:
      p(
        "Thank you for sharing your requirements. Our team will review your request and prepare a quotation."
      ) +
      details([
        ["Request reference", "{{quote_reference}}"],
        ["Submitted on", "{{request_date}}"]
      ]) +
      p("<strong>Your requirements</strong><br>{{request_summary}}") +
      note(
        "Sign in with the mobile number associated with your request to view updates in your account."
      ),
    text: "Thank you for sharing your requirements. Our team will review your request and prepare a quotation.\n\nRequest reference: {{quote_reference}}\nSubmitted on: {{request_date}}\n\nYour requirements\n{{request_summary}}\n\nSign in with the mobile number associated with your request to view updates in your account.",
    actionLabel: "View your quote requests",
    actionUrl: "{{quotes_url}}",
    required: ["quotes_url", "quote_reference", "request_date", "request_summary"]
  },
  {
    key: "quotation-available",
    name: "Quotation available",
    category: "Quotations",
    trigger:
      "After the initial or revised quotation is saved as QUOTED; require an unexpired quotation before offering acceptance.",
    subject: "Your quotation is ready: {{quote_reference}}",
    preheader: "Review the quotation details in your account.",
    heading: "Your quotation is ready",
    body:
      p("{{quotation_message}}") +
      details([["Request reference", "{{quote_reference}}"]]) +
      items +
      details([
        ["Subtotal", "{{subtotal}}"],
        ["Tax", "{{tax_total}}"],
        ["Delivery", "{{shipping_total}}"],
        ["Quotation total", "<strong>{{total}}</strong>"]
      ]) +
      "{{#if valid_until}}" +
      p("Valid until: {{valid_until}}") +
      "{{/if}}{{#if quotation_note}}" +
      note("{{quotation_note}}") +
      "{{/if}}" +
      p(
        "Sign in to review and accept or reject the quotation. Accepting a quotation does not complete payment."
      ),
    text:
      "{{quotation_message}}\n\nRequest reference: {{quote_reference}}\n\n" +
      textItems +
      "\nSubtotal: {{subtotal}}\nTax: {{tax_total}}\nDelivery: {{shipping_total}}\nQuotation total: {{total}}\n{{#if valid_until}}Valid until: {{valid_until}}\n{{/if}}{{#if quotation_note}}\n{{quotation_note}}\n{{/if}}\nSign in to review and accept or reject the quotation. Accepting a quotation does not complete payment.",
    actionLabel: "Review quotation",
    actionUrl: "{{quotes_url}}",
    required: [
      "quotes_url",
      "quote_reference",
      "quotation_message",
      "items",
      "subtotal",
      "tax_total",
      "shipping_total",
      "total"
    ],
    optional: ["valid_until", "quotation_note"]
  },
  {
    key: "question-answered",
    name: "Product question answered",
    category: "Support",
    trigger: "After the customer's product question is answered and the answer is saved.",
    subject: "Your question about {{product_name}} has been answered",
    preheader: "An answer to your product question.",
    heading: "Your question has been answered",
    body:
      p("We have answered your question about {{product_name}}.") +
      p("<strong>Your question</strong><br>{{question}}") +
      note("<strong>Our answer</strong><br>{{answer}}"),
    text: "We have answered your question about {{product_name}}.\n\nYour question\n{{question}}\n\nOur answer\n{{answer}}",
    actionLabel: "View product",
    actionUrl: "{{product_url}}",
    required: ["product_url", "product_name", "question", "answer"]
  }
];

export function getCustomerEmailTemplate(key: CustomerEmailTemplateKey) {
  const template = customerEmailTemplates.find((entry) => entry.key === key);

  if (!template) {
    throw new Error(`Unknown customer email template: ${key}`);
  }

  return template;
}
