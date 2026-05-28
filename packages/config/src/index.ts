export const APP_NAMES = {
  customerWeb: "Surgical Medical Equipment",
  admin: "Surgical Platform Admin",
  api: "Surgical Platform API",
  worker: "Surgical Platform Worker"
} as const;

export const API_VERSION_PREFIX = "/api/v1" as const;

export const FEATURE_SCOPE = {
  deliveryPartnerWebApp: false,
  customerMobileApp: false,
  deliveryMobileApp: false
} as const;

export const QUEUE_NAMES = {
  invoice: "invoice",
  lowStockAlert: "low-stock-alert",
  nearExpiryAlert: "near-expiry-alert",
  notifications: "notifications",
  otp: "otp",
  paymentWebhook: "payment-webhook"
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const REDIS_USAGE_AREAS = [
  "cache",
  "queues",
  "otp",
  "sessions",
  "rate-limiting"
] as const;

export const ADMIN_PERMISSION_GROUPS = [
  "catalog",
  "orders",
  "inventory",
  "warehouses",
  "delivery",
  "users"
] as const;
