import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { loadApiEnvironment } from "../../src/config/api.config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function setRequiredApiEnv(overrides: NodeJS.ProcessEnv = {}) {
  process.env = {
    ...originalEnv,
    BCRYPT_SALT_ROUNDS: "12",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/surgical_platform",
    JWT_ACCESS_SECRET: "test-access-secret-with-enough-length",
    JWT_REFRESH_SECRET: "test-refresh-secret-with-enough-length",
    RAZORPAY_KEY_ID: "rzp_test_key",
    RAZORPAY_KEY_SECRET: "rzp_test_secret",
    RAZORPAY_WEBHOOK_SECRET: "rzp_test_webhook",
    REDIS_URL: "redis://localhost:6379",
    ...overrides
  };
}

function setProductionApiEnv(overrides: NodeJS.ProcessEnv = {}) {
  setRequiredApiEnv({
    CORS_ORIGINS: "https://shop.example.com, https://admin.example.com",
    DATABASE_URL: "postgresql://postgres:postgres@db.example.com:5432/surgical_platform",
    NODE_ENV: "production",
    REDIS_URL: "rediss://redis.example.com:6379",
    S3_ACCESS_KEY_ID: "prod-access-key",
    S3_BUCKET: "surgical-prod-uploads",
    S3_REGION: "ap-south-1",
    S3_SECRET_ACCESS_KEY: "prod-secret-key",
    STORAGE_PROVIDER: "s3",
    STORAGE_PUBLIC_BASE_URL: "https://cdn.example.com/uploads",
    ...overrides
  });
}

test("loadApiEnvironment requires explicit CORS origins in production", () => {
  setProductionApiEnv({
    CORS_ORIGINS: undefined,
    NODE_ENV: "production"
  });

  assert.throws(() => loadApiEnvironment(), /CORS_ORIGINS is required in production/);
});

test("loadApiEnvironment rejects wildcard CORS origins when credentials are enabled", () => {
  setProductionApiEnv({
    CORS_ORIGINS: "https://admin.example.com,*",
    NODE_ENV: "production"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /CORS_ORIGINS cannot include wildcard origins/
  );
});

test("loadApiEnvironment allows localhost and loopback frontend origins by default in development", () => {
  setRequiredApiEnv({
    CORS_ORIGINS: undefined,
    NODE_ENV: "development"
  });

  const environment = loadApiEnvironment();

  assert.deepEqual(environment.corsOrigins, [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ]);
  assert.equal(environment.otpExposeInResponse, true);
});

test("loadApiEnvironment hides OTP responses by default in production", () => {
  setProductionApiEnv({
    OTP_EXPOSE_IN_RESPONSE: undefined
  });

  const environment = loadApiEnvironment();

  assert.deepEqual(environment.otpDemoCustomerMobileNumbers, []);
  assert.deepEqual(environment.otpDemoDeliveryMobileNumbers, []);
  assert.equal(environment.otpExposeInResponse, false);
});

test("loadApiEnvironment parses a production demo customer mobile whitelist", () => {
  setProductionApiEnv({
    OTP_DEMO_CUSTOMER_MOBILE_NUMBERS:
      " +919000000000, +919876543210, +919000000000 "
  });

  const environment = loadApiEnvironment();

  assert.deepEqual(environment.otpDemoCustomerMobileNumbers, [
    "+919000000000",
    "+919876543210"
  ]);
  assert.equal(environment.otpExposeInResponse, false);
});

test("loadApiEnvironment parses a production demo delivery mobile whitelist", () => {
  setProductionApiEnv({
    OTP_DEMO_DELIVERY_MOBILE_NUMBERS:
      " +919000000000, +919876543210, +919000000000 "
  });

  const environment = loadApiEnvironment();

  assert.deepEqual(environment.otpDemoDeliveryMobileNumbers, [
    "+919000000000",
    "+919876543210"
  ]);
  assert.equal(environment.otpExposeInResponse, false);
});

test("loadApiEnvironment rejects malformed demo customer mobile numbers", () => {
  setProductionApiEnv({
    OTP_DEMO_CUSTOMER_MOBILE_NUMBERS: "+919000000000,9000000000"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /OTP_DEMO_CUSTOMER_MOBILE_NUMBERS must contain E.164 mobile numbers/
  );
});

test("loadApiEnvironment rejects malformed demo delivery mobile numbers", () => {
  setProductionApiEnv({
    OTP_DEMO_DELIVERY_MOBILE_NUMBERS: "+919000000000,9000000000"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /OTP_DEMO_DELIVERY_MOBILE_NUMBERS must contain E.164 mobile numbers/
  );
});

test("loadApiEnvironment rejects explicit OTP exposure in production", () => {
  setProductionApiEnv({
    OTP_EXPOSE_IN_RESPONSE: "true"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /OTP_EXPOSE_IN_RESPONSE cannot be enabled in production/
  );
});

test("loadApiEnvironment rejects unprotected Swagger in production", () => {
  setProductionApiEnv({
    SWAGGER_ENABLED: "true"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /SWAGGER_ENABLED cannot be true in production/
  );
});

test("loadApiEnvironment rejects local infrastructure endpoints in production", () => {
  setProductionApiEnv({
    CORS_ORIGINS: "https://shop.example.com,http://localhost:3001",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/surgical_platform",
    REDIS_URL: "redis://127.0.0.1:6379"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /Production values cannot point to localhost or loopback/
  );
});

test("loadApiEnvironment rejects local upload storage in production", () => {
  setProductionApiEnv({
    STORAGE_PROVIDER: "local"
  });

  assert.throws(
    () => loadApiEnvironment(),
    /STORAGE_PROVIDER=local cannot be used in production/
  );
});

test("loadApiEnvironment requires S3 settings for production uploads", () => {
  setProductionApiEnv({
    S3_BUCKET: "",
    S3_SECRET_ACCESS_KEY: ""
  });

  assert.throws(
    () => loadApiEnvironment(),
    /S3_BUCKET is required when STORAGE_PROVIDER=s3/
  );
});

test("loadApiEnvironment parses production security and monitoring settings", () => {
  setProductionApiEnv({
    ERROR_MONITORING_DSN: "https://monitoring.example.com/project",
    ERROR_MONITORING_ENABLED: "true",
    OTP_EXPOSE_IN_RESPONSE: "false",
    RATE_LIMIT_BLOCK_MS: "120000",
    RATE_LIMIT_TTL_MS: "30000",
    TRUST_PROXY: "1"
  });

  const environment = loadApiEnvironment();

  assert.deepEqual(environment.corsOrigins, [
    "https://shop.example.com",
    "https://admin.example.com"
  ]);
  assert.equal(
    environment.errorMonitoringDsn,
    "https://monitoring.example.com/project"
  );
  assert.equal(environment.errorMonitoringEnabled, true);
  assert.equal(environment.otpExposeInResponse, false);
  assert.equal(environment.s3Bucket, "surgical-prod-uploads");
  assert.equal(environment.storageProvider, "s3");
  assert.equal(environment.swaggerEnabled, false);
  assert.equal(environment.throttleBlockMs, 120000);
  assert.equal(environment.throttleTtlMs, 30000);
  assert.equal(environment.trustProxy, 1);
});
