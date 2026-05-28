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

test("loadApiEnvironment requires explicit CORS origins in production", () => {
  setRequiredApiEnv({
    CORS_ORIGINS: undefined,
    NODE_ENV: "production"
  });

  assert.throws(() => loadApiEnvironment(), /CORS_ORIGINS is required in production/);
});

test("loadApiEnvironment rejects wildcard CORS origins when credentials are enabled", () => {
  setRequiredApiEnv({
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
});

test("loadApiEnvironment parses production security and monitoring settings", () => {
  setRequiredApiEnv({
    CORS_ORIGINS: "https://shop.example.com, https://admin.example.com",
    ERROR_MONITORING_DSN: "https://monitoring.example.com/project",
    ERROR_MONITORING_ENABLED: "true",
    NODE_ENV: "production",
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
  assert.equal(environment.throttleBlockMs, 120000);
  assert.equal(environment.throttleTtlMs, 30000);
  assert.equal(environment.trustProxy, 1);
});
