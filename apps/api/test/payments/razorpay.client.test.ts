import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { RazorpayClient } from "../../src/modules/payments/razorpay.client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createClient() {
  return new RazorpayClient(
    new ConfigService({
      razorpayKeyId: "rzp_live_test_key",
      razorpayKeySecret: "live-secret",
      razorpayRequestTimeoutMs: 5000,
      razorpayWebhookSecret: "live-webhook-secret"
    })
  );
}

test("createOrder sends Razorpay requests with an abort signal", async () => {
  let requestSignal: AbortSignal | undefined;
  globalThis.fetch = (async (_url, init) => {
    requestSignal = init?.signal ?? undefined;

    return new Response(
      JSON.stringify({
        amount: 10000,
        currency: "INR",
        id: "order_razorpay_1",
        receipt: "ORD-1",
        status: "created"
      }),
      {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
  }) as typeof fetch;

  await createClient().createOrder({
    amount: 10000,
    currency: "INR",
    notes: {
      orderId: "order-1"
    },
    receipt: "ORD-1"
  });

  assert.ok(requestSignal instanceof AbortSignal);
});
