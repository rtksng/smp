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

export interface SendOtpJobData {
  mobileNumber: string;
  otp: string;
  purpose: Exclude<AuthAudience, "admin">;
  requestedAt: string;
  version: 1;
}

export const NOTIFICATION_JOB_NAMES = {
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
