import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminAuthController } from "../../src/modules/auth/admin/admin-auth.controller";
import { AUTH_THROTTLE_LIMITS } from "../../src/modules/auth/common/auth-throttle";
import { CustomerAuthController } from "../../src/modules/auth/customer/customer-auth.controller";
import { DeliveryPartnerAuthController } from "../../src/modules/auth/delivery-partner/delivery-partner-auth.controller";
import { HealthController } from "../../src/modules/health/health.controller";
import { PaymentsController } from "../../src/modules/payments/payments.controller";

const THROTTLER_LIMIT = "THROTTLER:LIMIT";
const THROTTLER_TTL = "THROTTLER:TTL";
const THROTTLER_SKIP = "THROTTLER:SKIP";

type Handler = (...args: never[]) => unknown;

function routeLimit(handler: Handler) {
  return {
    limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler),
    ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)
  };
}

test("credential routes use the stricter auth throttle limits", () => {
  const cases: Array<[Handler, (typeof AUTH_THROTTLE_LIMITS)[keyof typeof AUTH_THROTTLE_LIMITS]]> = [
    [CustomerAuthController.prototype.requestOtp, AUTH_THROTTLE_LIMITS.otpRequest],
    [CustomerAuthController.prototype.verifyOtp, AUTH_THROTTLE_LIMITS.otpVerify],
    [AdminAuthController.prototype.login, AUTH_THROTTLE_LIMITS.login],
    [DeliveryPartnerAuthController.prototype.requestOtp, AUTH_THROTTLE_LIMITS.otpRequest],
    [DeliveryPartnerAuthController.prototype.register, AUTH_THROTTLE_LIMITS.registration],
    [DeliveryPartnerAuthController.prototype.verifyOtp, AUTH_THROTTLE_LIMITS.otpVerify]
  ];

  for (const [handler, expected] of cases) {
    assert.deepEqual(routeLimit(handler), expected, handler.name);
  }
});

test("health checks and the Razorpay webhook skip rate limiting", () => {
  assert.equal(Reflect.getMetadata(`${THROTTLER_SKIP}default`, HealthController), true);
  assert.equal(
    Reflect.getMetadata(
      `${THROTTLER_SKIP}default`,
      PaymentsController.prototype.handleRazorpayWebhook
    ),
    true
  );
});
