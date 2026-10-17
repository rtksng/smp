export { renderReportExport, REPORT_EXPORT_VIEWS } from "./report-export";
export type { ReportExportData, ReportExportFormat, ReportExportView } from "./report-export";

export type AuthAudience = "customer" | "admin" | "delivery_partner";

export type AdminRole =
  | "super_admin"
  | "operations_manager"
  | "warehouse_manager"
  | "warehouse_staff"
  | "support_agent";

export type ServiceStatus = "ok" | "degraded";

export interface HealthResponse {
  service: string;
  status: ServiceStatus;
  timestamp: string;
  versionPrefix: string;
}

export interface WarehouseScopedResource {
  warehouseId: string;
}

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface InventoryItem extends WarehouseScopedResource {
  id: string;
  sku: string;
  name: string;
  availableQuantity: number;
  reservedQuantity: number;
}

export const OTP_JOB_NAMES = {
  sendOtp: "send-otp"
} as const;

export type OtpJobName = (typeof OTP_JOB_NAMES)[keyof typeof OTP_JOB_NAMES];

export const ORDER_MAINTENANCE_JOB_NAMES = {
  expireUnpaidOrders: "expire-unpaid-orders",
  processRefund: "process-refund"
} as const;

export type OrderMaintenanceJobName =
  (typeof ORDER_MAINTENANCE_JOB_NAMES)[keyof typeof ORDER_MAINTENANCE_JOB_NAMES];

// Queued by the API or the worker, processed by the API, which holds the
// Razorpay keys.
export interface ProcessRefundJobData {
  refundId: string;
  requestedAt: string;
  version: 1;
}

export interface SendOtpJobData {
  mobileNumber: string;
  otp: string;
  purpose: Exclude<AuthAudience, "admin">;
  requestedAt: string;
  version: 1;
}

export const NOTIFICATION_JOB_NAMES = {
  sendDeliveryAssignment: "send-delivery-assignment",
  sendOrderConfirmation: "send-order-confirmation"
} as const;

export type NotificationJobName =
  (typeof NOTIFICATION_JOB_NAMES)[keyof typeof NOTIFICATION_JOB_NAMES];

export interface SendOrderConfirmationJobData {
  customerId: string;
  orderId: string;
  orderNumber: string;
  requestedAt: string;
  version: 1;
}

export const CUSTOMER_EMAIL_JOB_NAMES = {
  sendCustomerEmail: "send-customer-email"
} as const;

export type CustomerEmailJobName =
  (typeof CUSTOMER_EMAIL_JOB_NAMES)[keyof typeof CUSTOMER_EMAIL_JOB_NAMES];

export const CUSTOMER_EMAIL_TEMPLATE_KEYS = [
  "welcome",
  "account-status",
  "order-received",
  "order-progress",
  "order-cancelled",
  "payment-result",
  "invoice-ready",
  "return-update",
  "refund-update",
  "quote-received",
  "quotation-available",
  "question-answered"
] as const;

export type CustomerEmailTemplateKey = (typeof CUSTOMER_EMAIL_TEMPLATE_KEYS)[number];

/** Money values are decimal strings such as "2360.00"; dates are ISO strings. */
export interface CustomerEmailLineItem {
  lineTotal: string;
  name: string;
  quantity: number;
  unitPrice: string;
}

export interface CustomerEmailAddress {
  city: string;
  fullName: string;
  landmark: string | null;
  line1: string;
  line2: string | null;
  pincode: string;
  state: string;
}

export type CustomerEmailEvent =
  | { template: "welcome" }
  | {
      template: "account-status";
      status: "ACTIVE" | "INACTIVE" | "BLOCKED";
    }
  | {
      template: "order-received";
      deliveryAddress: CustomerEmailAddress | null;
      discountTotal: string;
      grandTotal: string;
      items: CustomerEmailLineItem[];
      orderId: string;
      orderNumber: string;
      payment: "COD" | "ONLINE_PENDING" | "ONLINE_PAID";
      placedAt: string;
      shippingTotal: string;
      subtotal: string;
      taxTotal: string;
    }
  | {
      template: "order-progress";
      orderId: string;
      orderNumber: string;
      status: "CONFIRMED" | "PACKED" | "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED";
    }
  | {
      template: "order-cancelled";
      cancellationReason: string | null;
      grandTotal: string;
      orderId: string;
      orderNumber: string;
      refund: "NOT_DUE" | "REQUESTED" | "UNDER_REVIEW";
    }
  | {
      template: "payment-result";
      amount: string;
      orderId: string;
      orderNumber: string;
      paymentReference: string | null;
      status: "PAID" | "FAILED";
    }
  | {
      template: "invoice-ready";
      grandTotal: string;
      invoiceNumber: string;
      issuedAt: string;
      orderId: string;
      orderNumber: string;
    }
  | {
      template: "return-update";
      customerNote: string | null;
      orderId: string;
      orderNumber: string;
      status: "RECEIVED" | "APPROVED" | "REJECTED";
    }
  | {
      template: "refund-update";
      amount: string;
      orderId: string;
      orderNumber: string;
      partial: boolean;
      refundReference: string | null;
      status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
    }
  | {
      template: "quote-received";
      quoteReference: string;
      requestSummary: string;
      submittedAt: string;
    }
  | {
      template: "quotation-available";
      grandTotal: string;
      items: CustomerEmailLineItem[];
      quotationNote: string | null;
      quoteReference: string;
      revised: boolean;
      shippingTotal: string;
      subtotal: string;
      taxTotal: string;
      validUntil: string | null;
    }
  | {
      template: "question-answered";
      answer: string;
      productName: string;
      productSlug: string;
      question: string;
    };

export interface CustomerEmailRecipient {
  /** Null for guest quote requests. */
  customerId: string | null;
  email: string;
  name: string;
}

export interface SendCustomerEmailJobData {
  /** Stable per business event; repeated jobs with the same key send once. */
  dedupeKey: string;
  event: CustomerEmailEvent;
  recipient: CustomerEmailRecipient;
  requestedAt: string;
  version: 1;
}

export const INVOICE_JOB_NAMES = {
  generateInvoice: "generate-invoice",
  generateGstInvoice: "generate-gst-invoice"
} as const;

export type InvoiceJobName =
  (typeof INVOICE_JOB_NAMES)[keyof typeof INVOICE_JOB_NAMES];

export interface GenerateGstInvoiceJobData {
  orderId: string;
  requestedAt: string;
  version: 1;
}

export const PAYMENT_WEBHOOK_JOB_NAMES = {
  processRazorpayWebhook: "process-razorpay-webhook"
} as const;

export type PaymentWebhookJobName =
  (typeof PAYMENT_WEBHOOK_JOB_NAMES)[keyof typeof PAYMENT_WEBHOOK_JOB_NAMES];

export interface ProcessPaymentWebhookJobData {
  payload: unknown;
  provider: "razorpay";
  providerEventId: string | null;
  rawBodyBase64: string;
  receivedAt: string;
  signature: string;
  version: 1;
  webhookId: string;
}

export interface SendDeliveryAssignmentNotificationJobData {
  assignmentId: string | null;
  body: string;
  deliveryPartnerId: string;
  notificationId: string;
  requestedAt: string;
  title: string;
  version: 1;
}

export const LOW_STOCK_ALERT_JOB_NAMES = {
  sendLowStockAlert: "send-low-stock-alert"
} as const;

export type LowStockAlertJobName =
  (typeof LOW_STOCK_ALERT_JOB_NAMES)[keyof typeof LOW_STOCK_ALERT_JOB_NAMES];

export interface SendLowStockAlertJobData {
  availableQuantity: number;
  productId: string;
  reorderLevel: number;
  requestedAt: string;
  variantId: string | null;
  version: 1;
  warehouseId: string;
}

export const NEAR_EXPIRY_ALERT_JOB_NAMES = {
  sendNearExpiryAlert: "send-near-expiry-alert"
} as const;

export type NearExpiryAlertJobName =
  (typeof NEAR_EXPIRY_ALERT_JOB_NAMES)[keyof typeof NEAR_EXPIRY_ALERT_JOB_NAMES];

export interface SendNearExpiryAlertJobData {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  productId: string;
  quantity: number;
  requestedAt: string;
  variantId: string | null;
  version: 1;
  warehouseId: string;
}
