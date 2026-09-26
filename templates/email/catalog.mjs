import { details, items, note, paragraph as p, textItems } from "./layout.mjs";

// Fictional preview data only. Account-specific URLs and support contact are supplied at send time.
export const commonSample = {
  brand_name: "Surgical Medical Equipment",
  customer_name: "Aarav",
  site_url: "https://shop.example.com",
  support_email: "support@example.com",
  account_url: "https://shop.example.com/account",
  order_url: "https://shop.example.com/account/orders/demo-order",
  quotes_url: "https://shop.example.com/account/quotes",
  product_url: "https://shop.example.com/products/demo-product"
};

const order = {
  order_number: "SMP-2026-1042",
  order_date: "7 September 2026",
  total: "₹2,360.00",
  subtotal: "₹2,000.00",
  tax_total: "₹360.00",
  shipping_total: "₹0.00",
  discount_total: "₹0.00",
  delivery_address: "Aarav Sharma, Example Clinic, Sector 10, Chandigarh 160010",
  items: [
    {
      name: "Nitrile examination gloves · Medium · Box of 100",
      quantity: 2,
      unit_price: "₹600.00",
      line_total: "₹1,200.00"
    },
    {
      name: "Sterile gauze swabs · Pack of 100",
      quantity: 2,
      unit_price: "₹400.00",
      line_total: "₹800.00"
    }
  ]
};
const orderRows = [
  ["Order", "{{order_number}}"],
  ["Total", "{{total}}"]
];
const scenario = (name, data) => ({ name, data });

export const templates = [
  {
    key: "welcome",
    name: "Welcome",
    category: "Account",
    trigger:
      "Once for a new customer after an email address becomes available; never on every OTP login.",
    source:
      "apps/api/src/modules/auth/customer/customer-auth.service.ts:43; apps/api/src/modules/customers/customer-profile.service.ts:284",
    subject: "Welcome to {{brand_name}}",
    preheader: "Your account is ready.",
    heading: "Welcome to {{brand_name}}",
    body: p(
      "Your customer account is ready. You can view your orders, manage delivery addresses, and request bulk quotations from your account."
    ),
    text: "Your customer account is ready. You can view your orders, manage delivery addresses, and request bulk quotations from your account.",
    actionLabel: "View your account",
    actionUrl: "{{account_url}}",
    required: ["account_url"],
    scenarios: [scenario("Account created", {})]
  },
  {
    key: "account-status",
    name: "Account status update",
    category: "Account",
    trigger: "After an admin changes customer status to ACTIVE, INACTIVE, or BLOCKED.",
    source: "apps/api/src/modules/customers/admin-customers.service.ts:161",
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
    optional: ["customer_note"],
    scenarios: [
      scenario("Active", {
        status_label: "Active",
        status_message: "Your account is active. You can sign in and place orders."
      }),
      scenario("Inactive", {
        status_label: "Inactive",
        status_message:
          "Your account has been deactivated. Contact our support team if you need help with this change."
      }),
      scenario("Blocked", {
        status_label: "Blocked",
        status_message:
          "Access to your account has been restricted. Please contact our support team for assistance."
      })
    ]
  },
  {
    key: "order-received",
    name: "Order received",
    category: "Orders",
    trigger:
      "After a new checkout or quotation order is committed; online payment may still be pending.",
    source:
      "apps/api/src/modules/orders/orders.service.ts:402; apps/api/src/modules/orders/orders.service.ts:527",
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
      p("<strong>Deliver to</strong><br>{{delivery_address}}"),
    text:
      "Thank you for placing an order.\n\nOrder: {{order_number}}\nPlaced on: {{order_date}}\nPayment: {{payment_label}}\n{{payment_message}}\n\n" +
      textItems +
      "\nSubtotal: {{subtotal}}\nDiscount: {{discount_total}}\nTax: {{tax_total}}\nDelivery: {{shipping_total}}\nTotal: {{total}}\n\nDeliver to: {{delivery_address}}",
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
      "total",
      "delivery_address"
    ],
    scenarios: [
      scenario("Cash on delivery", {
        ...order,
        payment_label: "Cash on delivery",
        payment_message: "₹2,360.00 is payable when your order is delivered."
      }),
      scenario("Online payment pending", {
        ...order,
        payment_label: "Online payment pending",
        payment_message:
          "Your order has been created. Payment has not been confirmed yet. Check your order for the latest payment status."
      }),
      scenario("Online payment received", {
        ...order,
        payment_label: "Paid online",
        payment_message: "Payment of ₹2,360.00 has been received."
      })
    ]
  },
  {
    key: "order-progress",
    name: "Order progress",
    category: "Orders",
    trigger: "After a committed customer-visible order or delivery status transition.",
    source:
      "apps/api/src/modules/orders/orders.service.ts:792; apps/api/src/modules/delivery/delivery.service.ts:1354",
    subject: "Order {{order_number}}: {{status_label}}",
    preheader: "{{status_message}}",
    heading: "Your order is {{status_label}}",
    body:
      p("{{status_message}}") +
      details([
        ["Order", "{{order_number}}"],
        ["Status", "{{status_label}}"]
      ]) +
      "{{#if delivery_update}}" +
      note("{{delivery_update}}") +
      "{{/if}}",
    text: "{{status_message}}\n\nOrder: {{order_number}}\nStatus: {{status_label}}\n{{#if delivery_update}}\n{{delivery_update}}\n{{/if}}",
    actionLabel: "Track your order",
    actionUrl: "{{order_url}}",
    required: ["order_url", "order_number", "status_label", "status_message"],
    optional: ["delivery_update"],
    scenarios: [
      scenario("Confirmed", {
        order_number: order.order_number,
        status_label: "confirmed",
        status_message:
          "Your order is confirmed. We will update you when it is ready for delivery."
      }),
      scenario("Packed", {
        order_number: order.order_number,
        status_label: "packed",
        status_message: "Your items have been packed and are waiting for delivery."
      }),
      scenario("Assigned", {
        order_number: order.order_number,
        status_label: "assigned for delivery",
        status_message:
          "A delivery partner has been assigned to your order. You can follow its progress in your account."
      }),
      scenario("Out for delivery", {
        order_number: order.order_number,
        status_label: "out for delivery",
        status_message:
          "Your order is on its way. Please keep your phone available so the delivery partner can reach you."
      }),
      scenario("Delivered", {
        order_number: order.order_number,
        status_label: "delivered",
        status_message:
          "Your order has been marked as delivered. If you have not received it, please contact our support team."
      })
    ]
  },
  {
    key: "order-cancelled",
    name: "Order cancelled",
    category: "Orders",
    trigger:
      "After customer or admin cancellation is committed. Report a refund only from its actual recorded status.",
    source:
      "apps/api/src/modules/orders/orders.service.ts:618; apps/api/src/modules/orders/orders.service.ts:949",
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
    optional: ["cancellation_reason"],
    scenarios: [
      scenario("Unpaid order", {
        order_number: order.order_number,
        total: order.total,
        cancellation_reason: "Ordered by mistake.",
        refund_message: "No payment was collected for this order. No refund is due."
      }),
      scenario("Paid order; refund pending", {
        order_number: order.order_number,
        total: order.total,
        refund_message:
          "A refund request has been recorded for your payment. We will send a separate update when its status changes."
      })
    ]
  },
  {
    key: "payment-result",
    name: "Payment result",
    category: "Payments",
    trigger:
      "After verified online payment or recorded COD collection changes payment status to PAID or FAILED.",
    source:
      "apps/api/src/modules/payments/payments.service.ts:174; apps/api/src/modules/payments/payments.service.ts:753; apps/api/src/modules/delivery/delivery.service.ts:1382",
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
    optional: ["payment_reference", "customer_note"],
    scenarios: [
      scenario("Received", {
        order_number: order.order_number,
        amount: order.total,
        status_label: "received",
        status_message: "Your payment has been received for this order. Thank you.",
        payment_reference: "DEMO-PAYMENT-1042"
      }),
      scenario("Failed", {
        order_number: order.order_number,
        amount: order.total,
        status_label: "failed",
        status_message:
          "Your payment attempt was unsuccessful. Please check the order before trying again.",
        customer_note:
          "If your account was debited, contact support with your payment reference so we can check the payment."
      })
    ]
  },
  {
    key: "invoice-ready",
    name: "Invoice ready",
    category: "Payments",
    trigger:
      "Only after an invoice record is available for an eligible order. Link to the authenticated order page, not the protected API endpoint.",
    source:
      "apps/api/src/modules/invoices/invoices.service.ts:167; apps/web/lib/api/orders.ts:canDownloadOrderInvoice",
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
    required: ["order_url", "order_number", "invoice_number", "invoice_date", "total"],
    scenarios: [
      scenario("Invoice available", {
        order_number: order.order_number,
        invoice_number: "INV-2026-1042",
        invoice_date: order.order_date,
        total: order.total
      })
    ]
  },
  {
    key: "return-update",
    name: "Return request update",
    category: "Returns",
    trigger:
      "After return submission or admin approval/rejection is committed. Return approval and refund completion are separate events.",
    source:
      "apps/api/src/modules/orders/orders.service.ts:671; apps/api/src/modules/orders/orders.service.ts:874; apps/api/src/modules/orders/orders.service.ts:890",
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
    optional: ["customer_note"],
    scenarios: [
      scenario("Received", {
        order_number: order.order_number,
        status_label: "received",
        status_message:
          "We received your return request. Our team will review it and send you an update."
      }),
      scenario("Approved", {
        order_number: order.order_number,
        status_label: "approved",
        status_message:
          "Your return request has been approved. Check your order for the latest return details.",
        customer_note:
          "If a refund is due, we will send a separate update about its progress."
      }),
      scenario("Rejected", {
        order_number: order.order_number,
        status_label: "rejected",
        status_message:
          "Your return request has not been approved. Please contact support if you need more information.",
        customer_note:
          "The submitted item does not meet the return conditions for this order."
      })
    ]
  },
  {
    key: "refund-update",
    name: "Refund update",
    category: "Returns",
    trigger:
      "After a recorded refund transition, including provider-confirmed completion or failure. Handle partial amounts explicitly.",
    source:
      "apps/api/src/modules/payments/payments.service.ts:881; apps/api/src/modules/payments/payments.service.ts:1110",
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
    optional: ["refund_reference", "customer_note"],
    scenarios: [
      scenario("Pending", {
        order_number: order.order_number,
        refund_amount: order.total,
        status_label: "requested",
        status_message:
          "Your refund request has been recorded. It has not been completed yet."
      }),
      scenario("Processing", {
        order_number: order.order_number,
        refund_amount: order.total,
        status_label: "processing",
        status_message:
          "Your refund is being processed. We will update you when the payment provider confirms the result."
      }),
      scenario("Completed", {
        order_number: order.order_number,
        refund_amount: order.total,
        status_label: "completed",
        status_message:
          "The payment provider has confirmed that your refund is complete.",
        refund_reference: "DEMO-REFUND-1042",
        customer_note:
          "The time it takes to appear in your account depends on your bank or payment provider."
      }),
      scenario("Partial refund completed", {
        order_number: order.order_number,
        refund_amount: "₹590.00",
        status_label: "completed",
        status_message:
          "The payment provider has confirmed a partial refund of ₹590.00 for this order.",
        refund_reference: "DEMO-PARTIAL-1042"
      }),
      scenario("Failed", {
        order_number: order.order_number,
        refund_amount: order.total,
        status_label: "failed",
        status_message:
          "The refund attempt was unsuccessful. Please contact support so we can help with the next step."
      }),
      scenario("Cancelled", {
        order_number: order.order_number,
        refund_amount: order.total,
        status_label: "cancelled",
        status_message:
          "This refund request has been cancelled. Please contact support if you need more information."
      })
    ]
  },
  {
    key: "quote-received",
    name: "Quote request received",
    category: "Quotations",
    trigger:
      "After a bulk quote request is saved. Use the request's supplied email, including for guest enquiries.",
    source: "apps/api/src/modules/quote-requests/quote-requests.service.ts:91",
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
    required: ["quotes_url", "quote_reference", "request_date", "request_summary"],
    scenarios: [
      scenario("Request received", {
        quote_reference: "DEMO-QUOTE-1042",
        request_date: order.order_date,
        request_summary:
          "Please quote for 20 boxes of medium nitrile gloves and 10 packs of sterile gauze swabs."
      })
    ]
  },
  {
    key: "quotation-available",
    name: "Quotation available",
    category: "Quotations",
    trigger:
      "After the initial or revised quotation is saved as QUOTED; require an unexpired quotation before offering acceptance.",
    source: "apps/api/src/modules/quote-requests/quote-requests.service.ts:185",
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
    optional: ["valid_until", "quotation_note"],
    scenarios: [
      scenario("New quotation", {
        ...order,
        quote_reference: "DEMO-QUOTE-1042",
        quotation_message:
          "We have prepared a quotation for your request. Please review the items and prices below.",
        valid_until: "14 September 2026"
      }),
      scenario("Revised quotation", {
        ...order,
        quote_reference: "DEMO-QUOTE-1042",
        quotation_message:
          "We have updated your quotation. Please review the latest details before accepting.",
        valid_until: "16 September 2026"
      })
    ]
  },
  {
    key: "question-answered",
    name: "Product question answered",
    category: "Support",
    trigger:
      "After the customer's product question is answered and the answer is saved.",
    source: "apps/api/src/modules/product-feedback/product-feedback.service.ts:176",
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
    required: ["product_url", "product_name", "question", "answer"],
    scenarios: [
      scenario("Answer available", {
        product_name: "Nitrile examination gloves",
        question: "How many gloves are included in one box?",
        answer:
          "This product is supplied in a box of 100 gloves. Please check the selected size before placing your order."
      })
    ]
  }
];

export function samplesFor(template) {
  return template.scenarios.map(({ name, data }) => ({
    name,
    variables: { ...commonSample, ...data }
  }));
}
