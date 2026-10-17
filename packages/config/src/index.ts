export const APP_NAMES = {
  customerWeb: "Surgical Medical Equipment",
  admin: "Surgical Platform Admin",
  api: "Surgical Platform API",
  worker: "Surgical Platform Worker"
} as const;

export const API_VERSION_PREFIX = "/api/v1" as const;

// Headers the web and admin API proxies use to pass the real client IP to the
// API. The API trusts the client IP only when the proxy key matches
// API_PROXY_SHARED_SECRET.
export const TRUSTED_PROXY_HEADERS = {
  clientIp: "x-smp-client-ip",
  proxyKey: "x-smp-proxy-key"
} as const;

export const FEATURE_SCOPE = {
  deliveryPartnerWebApp: false,
  customerMobileApp: false,
  deliveryMobileApp: false
} as const;

export const QUEUE_NAMES = {
  customerEmail: "customer-email",
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
