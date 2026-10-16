import type {
  CustomerEmailEvent,
  CustomerEmailRecipient,
  CustomerEmailTemplateKey
} from "@surgical/types";
import type { CustomerEmailSiteSettings } from "./variables";

// Fictional preview data only. Real settings come from the worker environment.
export const sampleSettings: CustomerEmailSiteSettings = {
  brandName: "Surgical Medical Equipment",
  siteUrl: "https://shop.example.com",
  supportEmail: "support@example.com"
};

export const sampleRecipient: CustomerEmailRecipient = {
  customerId: "demo-customer",
  email: "aarav@example.com",
  name: "Aarav"
};

const order = {
  orderId: "demo-order",
  orderNumber: "SMP-2026-1042"
};
const quoteTotals = {
  grandTotal: "2360.00",
  shippingTotal: "0.00",
  subtotal: "2000.00",
  taxTotal: "360.00"
};
const orderTotals = { ...quoteTotals, discountTotal: "0.00" };
const items = [
  {
    lineTotal: "1200.00",
    name: "Nitrile examination gloves · Medium · Box of 100",
    quantity: 2,
    unitPrice: "600.00"
  },
  {
    lineTotal: "800.00",
    name: "Sterile gauze swabs · Pack of 100",
    quantity: 2,
    unitPrice: "400.00"
  }
];
const orderReceived = {
  ...order,
  ...orderTotals,
  deliveryAddress: {
    city: "Chandigarh",
    fullName: "Aarav Sharma",
    landmark: null,
    line1: "Example Clinic, Sector 10",
    line2: null,
    pincode: "160010",
    state: "Chandigarh"
  },
  items,
  placedAt: "2026-09-07T05:30:00.000Z",
  template: "order-received"
} as const;

export type CustomerEmailSample = { event: CustomerEmailEvent; name: string };

export const customerEmailSamples: Record<CustomerEmailTemplateKey, CustomerEmailSample[]> = {
  welcome: [{ name: "Account created", event: { template: "welcome" } }],
  "account-status": [
    { name: "Active", event: { status: "ACTIVE", template: "account-status" } },
    { name: "Inactive", event: { status: "INACTIVE", template: "account-status" } },
    { name: "Blocked", event: { status: "BLOCKED", template: "account-status" } }
  ],
  "order-received": [
    { name: "Cash on delivery", event: { ...orderReceived, payment: "COD" } },
    { name: "Online payment pending", event: { ...orderReceived, payment: "ONLINE_PENDING" } },
    { name: "Online payment received", event: { ...orderReceived, payment: "ONLINE_PAID" } }
  ],
  "order-progress": (
    [
      ["Confirmed", "CONFIRMED"],
      ["Packed", "PACKED"],
      ["Assigned", "ASSIGNED"],
      ["Out for delivery", "OUT_FOR_DELIVERY"],
      ["Delivered", "DELIVERED"]
    ] as const
  ).map(([name, status]) => ({
    name,
    event: { ...order, status, template: "order-progress" }
  })),
  "order-cancelled": [
    {
      name: "Unpaid order",
      event: {
        ...order,
        cancellationReason: "Ordered by mistake.",
        grandTotal: orderTotals.grandTotal,
        refund: "NOT_DUE",
        template: "order-cancelled"
      }
    },
    {
      name: "Paid order; refund requested",
      event: {
        ...order,
        cancellationReason: null,
        grandTotal: orderTotals.grandTotal,
        refund: "REQUESTED",
        template: "order-cancelled"
      }
    },
    {
      name: "Paid order; refund under review",
      event: {
        ...order,
        cancellationReason: null,
        grandTotal: orderTotals.grandTotal,
        refund: "UNDER_REVIEW",
        template: "order-cancelled"
      }
    }
  ],
  "payment-result": [
    {
      name: "Received",
      event: {
        ...order,
        amount: orderTotals.grandTotal,
        paymentReference: "DEMO-PAYMENT-1042",
        status: "PAID",
        template: "payment-result"
      }
    },
    {
      name: "Failed",
      event: {
        ...order,
        amount: orderTotals.grandTotal,
        paymentReference: null,
        status: "FAILED",
        template: "payment-result"
      }
    }
  ],
  "invoice-ready": [
    {
      name: "Invoice available",
      event: {
        ...order,
        grandTotal: orderTotals.grandTotal,
        invoiceNumber: "INV-2026-1042",
        issuedAt: "2026-09-07T05:30:00.000Z",
        template: "invoice-ready"
      }
    }
  ],
  "return-update": [
    {
      name: "Received",
      event: { ...order, customerNote: null, status: "RECEIVED", template: "return-update" }
    },
    {
      name: "Approved",
      event: { ...order, customerNote: null, status: "APPROVED", template: "return-update" }
    },
    {
      name: "Rejected",
      event: {
        ...order,
        customerNote: "The submitted item does not meet the return conditions for this order.",
        status: "REJECTED",
        template: "return-update"
      }
    }
  ],
  "refund-update": [
    ...(
      [
        ["Pending", "PENDING", null],
        ["Processing", "PROCESSING", null],
        ["Completed", "COMPLETED", "DEMO-REFUND-1042"],
        ["Failed", "FAILED", null],
        ["Cancelled", "CANCELLED", null]
      ] as const
    ).map(([name, status, refundReference]) => ({
      name,
      event: {
        ...order,
        amount: orderTotals.grandTotal,
        partial: false,
        refundReference,
        status,
        template: "refund-update" as const
      }
    })),
    {
      name: "Partial refund completed",
      event: {
        ...order,
        amount: "590.00",
        partial: true,
        refundReference: "DEMO-PARTIAL-1042",
        status: "COMPLETED",
        template: "refund-update"
      }
    }
  ],
  "quote-received": [
    {
      name: "Request received",
      event: {
        quoteReference: "DEMO-QUOTE-1042",
        requestSummary:
          "Please quote for 20 boxes of medium nitrile gloves and 10 packs of sterile gauze swabs.",
        submittedAt: "2026-09-07T05:30:00.000Z",
        template: "quote-received"
      }
    }
  ],
  "quotation-available": [
    {
      name: "New quotation",
      event: {
        ...quoteTotals,
        items,
        quotationNote: null,
        quoteReference: "DEMO-QUOTE-1042",
        revised: false,
        template: "quotation-available",
        validUntil: "2026-09-14T05:30:00.000Z"
      }
    },
    {
      name: "Revised quotation",
      event: {
        ...quoteTotals,
        items,
        quotationNote: "Prices include a bulk discount for 20 or more boxes.",
        quoteReference: "DEMO-QUOTE-1042",
        revised: true,
        template: "quotation-available",
        validUntil: "2026-09-16T05:30:00.000Z"
      }
    }
  ],
  "question-answered": [
    {
      name: "Answer available",
      event: {
        answer:
          "This product is supplied in a box of 100 gloves. Please check the selected size before placing your order.",
        productName: "Nitrile examination gloves",
        productSlug: "demo-product",
        question: "How many gloves are included in one box?",
        template: "question-answered"
      }
    }
  ]
};
