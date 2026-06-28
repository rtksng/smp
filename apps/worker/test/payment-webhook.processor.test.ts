import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PAYMENT_WEBHOOK_JOB_NAMES,
  type ProcessPaymentWebhookJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import {
  PaymentWebhookProcessor,
  PaymentWebhookRepository
} from "../src/queues/payment-webhook.processor";

class FakePaymentWebhookRepository extends PaymentWebhookRepository {
  readonly calls: ProcessPaymentWebhookJobData[] = [];

  async processRazorpayWebhook(data: ProcessPaymentWebhookJobData) {
    this.calls.push(data);

    return {
      duplicate: false,
      processed: true,
      received: true
    };
  }
}

test("PaymentWebhookProcessor delegates Razorpay webhook jobs to the repository", async () => {
  const repository = new FakePaymentWebhookRepository();
  const processor = new PaymentWebhookProcessor(repository);
  const data: ProcessPaymentWebhookJobData = {
    payload: {
      event: "payment.captured"
    },
    provider: "razorpay",
    providerEventId: "evt_1",
    rawBodyBase64: Buffer.from("{}").toString("base64"),
    receivedAt: new Date().toISOString(),
    signature: "signature",
    version: 1,
    webhookId: "webhook-1"
  };

  await processor.process({
    data,
    name: PAYMENT_WEBHOOK_JOB_NAMES.processRazorpayWebhook
  } as Job<ProcessPaymentWebhookJobData>);

  assert.deepEqual(repository.calls, [data]);
});
