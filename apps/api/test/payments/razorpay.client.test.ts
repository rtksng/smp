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

test("fetchOrderPayments lists the payment statuses for a Razorpay order", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (url, init) => {
    requestUrl = String(url);
    requestInit = init;

    return new Response(
      JSON.stringify({
        count: 2,
        entity: "collection",
        items: [
          { amount: 10000, id: "pay_failed_1", order_id: "order_rzp_1", status: "failed" },
          { amount: 10000, id: "pay_captured_1", order_id: "order_rzp_1", status: "captured" }
        ]
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  }) as typeof fetch;

  const payments = await createClient().fetchOrderPayments("order_rzp_1");

  assert.equal(requestUrl, "https://api.razorpay.com/v1/orders/order_rzp_1/payments");
  assert.equal(requestInit?.method, "GET");
  assert.ok(requestInit?.signal instanceof AbortSignal);
  assert.match(
    String((requestInit?.headers as Record<string, string>).Authorization),
    /^Basic /
  );
  assert.deepEqual(payments, [
    { id: "pay_failed_1", status: "failed" },
    { id: "pay_captured_1", status: "captured" }
  ]);
});

test("fetchOrderPayments rejects error and malformed responses", async () => {
  for (const [status, body] of [
    [404, { error: { code: "BAD_REQUEST_ERROR" } }],
    [200, { entity: "collection" }],
    [200, { items: [{ id: "pay_1" }] }]
  ] as const) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status
      })) as typeof fetch;

    await assert.rejects(() => createClient().fetchOrderPayments("order_rzp_1"));
  }
});

test("fetchPaymentRefunds lists earlier refunds with their notes", async () => {
  let requestUrl = "";
  globalThis.fetch = (async (url) => {
    requestUrl = String(url);

    return new Response(
      JSON.stringify({
        count: 1,
        entity: "collection",
        items: [
          {
            amount: 28320,
            id: "rfnd_1",
            notes: { orderNumber: 42, refundId: "refund-1" },
            payment_id: "pay_1",
            status: "processed"
          }
        ]
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  }) as typeof fetch;

  const refunds = await createClient().fetchPaymentRefunds("pay_1");

  assert.equal(requestUrl, "https://api.razorpay.com/v1/payments/pay_1/refunds");
  assert.deepEqual(refunds, [
    {
      amount: 28320,
      id: "rfnd_1",
      notes: { refundId: "refund-1" },
      payment_id: "pay_1",
      status: "processed"
    }
  ]);
});
