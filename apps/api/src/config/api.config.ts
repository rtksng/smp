import { API_VERSION_PREFIX } from "@surgical/config";

const DEFAULT_WEB_ORIGIN = "http://localhost:3000";
const DEFAULT_ADMIN_ORIGIN = "http://localhost:3001";
const DEFAULT_LOOPBACK_WEB_ORIGIN = "http://127.0.0.1:3000";
const DEFAULT_LOOPBACK_ADMIN_ORIGIN = "http://127.0.0.1:3001";

function csv(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function demoCustomerMobileNumbers(value: string | undefined) {
  const mobileNumbers = [...new Set(csv(value, []))];

  if (mobileNumbers.some((mobileNumber) => !/^\+[1-9]\d{7,14}$/.test(mobileNumber))) {
    throw new Error(
      "OTP_DEMO_CUSTOMER_MOBILE_NUMBERS must contain E.164 mobile numbers."
    );
  }

  return mobileNumbers;
}

function parseTrustProxy(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "off"].includes(normalized)) {
    return false;
  }

  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  throw new Error("TRUST_PROXY must be true, false, or a non-negative integer.");
}

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function corsOriginsForEnvironment(environment: string) {
  if (!process.env.CORS_ORIGINS && environment === "production") {
    throw new Error("CORS_ORIGINS is required in production.");
  }

  const origins = csv(process.env.CORS_ORIGINS, [
    DEFAULT_WEB_ORIGIN,
    DEFAULT_ADMIN_ORIGIN,
    DEFAULT_LOOPBACK_WEB_ORIGIN,
    DEFAULT_LOOPBACK_ADMIN_ORIGIN
  ]);

  if (origins.some((origin) => origin === "*" || origin.includes("*"))) {
    throw new Error("CORS_ORIGINS cannot include wildcard origins.");
  }

  return origins;
}

export type ApiEnvironment = {
  apiPrefix: string;
  bcryptSaltRounds: number;
  corsOrigins: string[];
  databaseUrl: string;
  environment: string;
  errorMonitoringDsn?: string;
  errorMonitoringEnabled: boolean;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshSecret: string;
  jwtRefreshTtlSeconds: number;
  otpDemoCustomerMobileNumbers: string[];
  otpExposeInResponse: boolean;
  otpRateLimit: number;
  otpRateWindowSeconds: number;
  otpResendCooldownSeconds: number;
  otpTtlSeconds: number;
  port: number;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayRequestTimeoutMs: number;
  razorpayWebhookSecret: string;
  redisUrl: string;
  redisQueuePrefix: string;
  s3AccessKeyId?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3ForcePathStyle: boolean;
  s3Region?: string;
  s3SecretAccessKey?: string;
  storageDocumentMaxBytes: number;
  storageImageMaxBytes: number;
  storageLocalRoot: string;
  storageProvider: string;
  storagePublicBaseUrl: string;
  storagePublicPath: string;
  swaggerEnabled: boolean;
  throttleBlockMs: number;
  throttleLimit: number;
  throttleTtlMs: number;
  trustProxy: boolean | number;
};

export function loadApiEnvironment(): ApiEnvironment {
  const environment = process.env.NODE_ENV ?? "development";
  const apiEnvironment: ApiEnvironment = {
    apiPrefix: API_VERSION_PREFIX.replace(/^\//, ""),
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
    corsOrigins: corsOriginsForEnvironment(environment),
    databaseUrl: required("DATABASE_URL"),
    environment,
    errorMonitoringDsn: process.env.ERROR_MONITORING_DSN,
    errorMonitoringEnabled: parseBoolean(
      process.env.ERROR_MONITORING_ENABLED,
      environment === "production" && Boolean(process.env.ERROR_MONITORING_DSN)
    ),
    jwtAccessSecret: required("JWT_ACCESS_SECRET"),
    jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
    jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000),
    otpDemoCustomerMobileNumbers: demoCustomerMobileNumbers(
      process.env.OTP_DEMO_CUSTOMER_MOBILE_NUMBERS
    ),
    otpExposeInResponse: parseBoolean(
      process.env.OTP_EXPOSE_IN_RESPONSE,
      environment !== "production"
    ),
    otpRateLimit: Number(process.env.OTP_RATE_LIMIT ?? 5),
    otpRateWindowSeconds: Number(process.env.OTP_RATE_WINDOW_SECONDS ?? 3600),
    otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),
    otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
    port: Number(process.env.API_PORT ?? 4000),
    razorpayKeyId: required("RAZORPAY_KEY_ID"),
    razorpayKeySecret: required("RAZORPAY_KEY_SECRET"),
    razorpayRequestTimeoutMs: Number(
      process.env.RAZORPAY_REQUEST_TIMEOUT_MS ?? 10000
    ),
    razorpayWebhookSecret: required("RAZORPAY_WEBHOOK_SECRET"),
    redisUrl: required("REDIS_URL"),
    redisQueuePrefix: process.env.REDIS_QUEUE_PREFIX ?? "surgical-platform",
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3Bucket: process.env.S3_BUCKET,
    s3Endpoint: process.env.S3_ENDPOINT,
    s3ForcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, false),
    s3Region: process.env.S3_REGION,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    storageDocumentMaxBytes: Number(
      process.env.STORAGE_DOCUMENT_MAX_BYTES ?? 10 * 1024 * 1024
    ),
    storageImageMaxBytes: Number(
      process.env.STORAGE_IMAGE_MAX_BYTES ?? 5 * 1024 * 1024
    ),
    storageLocalRoot: process.env.STORAGE_LOCAL_ROOT ?? "storage/uploads",
    storageProvider: process.env.STORAGE_PROVIDER ?? "local",
    storagePublicBaseUrl:
      process.env.STORAGE_PUBLIC_BASE_URL ?? "http://localhost:4000/uploads",
    storagePublicPath: process.env.STORAGE_PUBLIC_PATH ?? "uploads",
    swaggerEnabled: parseBoolean(
      process.env.SWAGGER_ENABLED,
      environment !== "production"
    ),
    throttleBlockMs: Number(process.env.RATE_LIMIT_BLOCK_MS ?? 60000),
    throttleLimit: Number(process.env.RATE_LIMIT_MAX ?? 100),
    throttleTtlMs: Number(process.env.RATE_LIMIT_TTL_MS ?? 60000),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY)
  };

  validateProductionEnvironment(apiEnvironment);

  return apiEnvironment;
}

function validateProductionEnvironment(environment: ApiEnvironment) {
  if (environment.environment !== "production") {
    return;
  }

  if (environment.otpExposeInResponse) {
    throw new Error("OTP_EXPOSE_IN_RESPONSE cannot be enabled in production.");
  }

  if (environment.swaggerEnabled) {
    throw new Error("SWAGGER_ENABLED cannot be true in production.");
  }

  if (
    [environment.databaseUrl, environment.redisUrl, environment.storagePublicBaseUrl]
      .concat(environment.corsOrigins)
      .some(isLocalUrl)
  ) {
    throw new Error(
      "Production values cannot point to localhost or loopback addresses."
    );
  }

  if (environment.storageProvider === "local") {
    throw new Error("STORAGE_PROVIDER=local cannot be used in production.");
  }

  validateS3Environment(environment);
}

function validateS3Environment(environment: ApiEnvironment) {
  if (environment.storageProvider !== "s3") {
    throw new Error("STORAGE_PROVIDER must be set to s3 in production.");
  }

  if (!environment.s3Bucket) {
    throw new Error("S3_BUCKET is required when STORAGE_PROVIDER=s3.");
  }

  if (!environment.s3Region) {
    throw new Error("S3_REGION is required when STORAGE_PROVIDER=s3.");
  }

  if (!environment.s3AccessKeyId) {
    throw new Error("S3_ACCESS_KEY_ID is required when STORAGE_PROVIDER=s3.");
  }

  if (!environment.s3SecretAccessKey) {
    throw new Error("S3_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=s3.");
  }
}

function isLocalUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return /(^|[/:,])(?:localhost|127\.0\.0\.1)(?:[/:,]|$)/i.test(value);
  }
}
