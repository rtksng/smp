import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INVOICE_JOB_NAMES,
  LOW_STOCK_ALERT_JOB_NAMES,
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  NOTIFICATION_JOB_NAMES,
  OTP_JOB_NAMES,
  PAYMENT_WEBHOOK_JOB_NAMES,
  type ProcessPaymentWebhookJobData,
  type SendLowStockAlertJobData,
  type SendNearExpiryAlertJobData,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import type { NotificationLogRepository } from "../src/notifications/notification-log.repository";
import { InvoicesProcessor } from "../src/queues/invoices.processor";
import { LowStockAlertProcessor } from "../src/queues/low-stock-alert.processor";
import { NearExpiryAlertProcessor } from "../src/queues/near-expiry-alert.processor";
import { NotificationsProcessor } from "../src/queues/notifications.processor";
import { OtpProcessor } from "../src/queues/otp.processor";
import { PaymentWebhookProcessor } from "../src/queues/payment-webhook.processor";
import {
  PaymentWebhookRepository,
  type PaymentWebhookProcessingResult
} from "../src/queues/payment-webhook.processor";
import type { StructuredLogger } from "../src/structured-logger.service";

class FakeLogger implements Pick<StructuredLogger, "error" | "log"> {
  readonly errors: unknown[] = [];
  readonly logs: unknown[] = [];

  error(message: unknown) {
    this.errors.push(message);
  }

  log(message: unknown) {
    this.logs.push(message);
  }
}

class FakeNotificationLogRepository implements NotificationLogRepository {
  readonly lowStockAlerts: SendLowStockAlertJobData[] = [];
  readonly nearExpiryAlerts: SendNearExpiryAlertJobData[] = [];
  readonly orderConfirmations: SendOrderConfirmationJobData[] = [];
  failNext = false;

  async createLowStockAlert(data: SendLowStockAlertJobData) {
    if (this.failNext) {
      throw new Error("database unavailable");
    }

    this.lowStockAlerts.push(data);
  }

  async createNearExpiryAlert(data: SendNearExpiryAlertJobData) {
    if (this.failNext) {
      throw new Error("database unavailable");
    }

    this.nearExpiryAlerts.push(data);
  }

  async createOrderConfirmation(data: SendOrderConfirmationJobData) {
    if (this.failNext) {
      throw new Error("database unavailable");
    }

    this.orderConfirmations.push(data);
  }
}

class FakePaymentWebhookRepository extends PaymentWebhookRepository {
  readonly calls: ProcessPaymentWebhookJobData[] = [];

  async processRazorpayWebhook(
    data: ProcessPaymentWebhookJobData
  ): Promise<PaymentWebhookProcessingResult> {
    this.calls.push(data);

    return {
      duplicate: false,
      processed: false,
      received: true
    };
  }
}

test("OtpProcessor rejects malformed payloads before logging", async () => {
  const logger = new FakeLogger();
  const processor = new OtpProcessor(logger as StructuredLogger);

  await assert.rejects(
    processor.process(
      makeJob(OTP_JOB_NAMES.sendOtp, {
        mobileNumber: "9876543210",
        purpose: "customer",
        requestedAt: "2026-06-18T10:30:00.000Z",
        version: 1
      })
    ),
    /otp must be a non-empty string/
  );

  assert.equal(logger.logs.length, 0);
  assert.equal(logger.errors.length, 1);
});

test("OtpProcessor logs sanitized job context without OTP or full mobile number", async () => {
  const logger = new FakeLogger();
  const processor = new OtpProcessor(logger as StructuredLogger);

  await processor.process(
    makeJob(OTP_JOB_NAMES.sendOtp, {
      mobileNumber: "9876543210",
      otp: "123456",
      purpose: "delivery_partner",
      requestedAt: "2026-06-18T10:30:00.000Z",
      version: 1
    })
  );

  assert.equal(logger.logs.length, 1);
  const serializedLog = JSON.stringify(logger.logs[0]);
  assert.match(serializedLog, /otp.sent/);
  assert.doesNotMatch(serializedLog, /123456/);
  assert.doesNotMatch(serializedLog, /9876543210/);
  assert.match(serializedLog, /\*\*\*\*\*\*3210/);
});

test("InvoicesProcessor rejects malformed payloads and logs the failed job", async () => {
  const logger = new FakeLogger();
  const processor = new InvoicesProcessor(logger as StructuredLogger);

  await assert.rejects(
    processor.process(
      makeJob(INVOICE_JOB_NAMES.generateInvoice, {
        requestedAt: "2026-06-18T10:30:00.000Z",
        version: 1
      })
    ),
    /orderId must be a non-empty string/
  );

  assert.equal(logger.errors.length, 1);
  assert.match(JSON.stringify(logger.errors[0]), /job.failed/);
});

test("PaymentWebhookProcessor rejects invalid Razorpay webhook jobs", async () => {
  const logger = new FakeLogger();
  const processor = new PaymentWebhookProcessor(
    new FakePaymentWebhookRepository(),
    logger as StructuredLogger
  );

  await assert.rejects(
    processor.process(
      makeJob(PAYMENT_WEBHOOK_JOB_NAMES.processRazorpayWebhook, {
        payload: {},
        provider: "razorpay",
        providerEventId: "evt_1",
        rawBodyBase64: "not base64",
        receivedAt: "2026-06-18T10:30:00.000Z",
        signature: "sig",
        version: 1
      })
    ),
    /rawBodyBase64 must be valid base64/
  );

  assert.equal(logger.errors.length, 1);
  assert.match(JSON.stringify(logger.errors[0]), /job.failed/);
});

test("Notification processors reject malformed payloads before repository writes", async () => {
  const repository = new FakeNotificationLogRepository();
  const logger = new FakeLogger();
  const processor = new NotificationsProcessor(
    repository,
    logger as StructuredLogger
  );

  await assert.rejects(
    processor.process(
      makeJob(NOTIFICATION_JOB_NAMES.sendOrderConfirmation, {
        customerId: "customer-1",
        orderNumber: "SMP-1001",
        requestedAt: "2026-06-18T10:30:00.000Z",
        version: 1
      })
    ),
    /orderId must be a non-empty string/
  );

  assert.deepEqual(repository.orderConfirmations, []);
  assert.equal(logger.errors.length, 1);
});

test("Notification processors log database failures and rethrow for BullMQ retry", async () => {
  const repository = new FakeNotificationLogRepository();
  repository.failNext = true;
  const logger = new FakeLogger();
  const processor = new LowStockAlertProcessor(
    repository,
    logger as StructuredLogger
  );

  await assert.rejects(
    processor.process(
      makeJob(LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert, {
        availableQuantity: 3,
        productId: "product-1",
        reorderLevel: 5,
        requestedAt: "2026-06-18T10:30:00.000Z",
        variantId: null,
        version: 1,
        warehouseId: "warehouse-1"
      })
    ),
    /database unavailable/
  );

  assert.equal(logger.errors.length, 1);
  assert.match(JSON.stringify(logger.errors[0]), /job.failed/);
});

test("Inventory alert processors reject invalid numeric fields", async () => {
  const repository = new FakeNotificationLogRepository();
  const logger = new FakeLogger();
  const lowStock = new LowStockAlertProcessor(
    repository,
    logger as StructuredLogger
  );
  const nearExpiry = new NearExpiryAlertProcessor(
    repository,
    logger as StructuredLogger
  );

  await assert.rejects(
    lowStock.process(
      makeJob(LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert, {
        availableQuantity: -1,
        productId: "product-1",
        reorderLevel: 5,
        requestedAt: "2026-06-18T10:30:00.000Z",
        variantId: null,
        version: 1,
        warehouseId: "warehouse-1"
      })
    ),
    /availableQuantity must be a non-negative finite number/
  );

  await assert.rejects(
    nearExpiry.process(
      makeJob(NEAR_EXPIRY_ALERT_JOB_NAMES.sendNearExpiryAlert, {
        batchId: "batch-1",
        batchNumber: "B-1001",
        expiryDate: "not-a-date",
        productId: "product-1",
        quantity: 8,
        requestedAt: "2026-06-18T10:30:00.000Z",
        variantId: "variant-1",
        version: 1,
        warehouseId: "warehouse-1"
      })
    ),
    /expiryDate must be an ISO date string/
  );

  assert.deepEqual(repository.lowStockAlerts, []);
  assert.deepEqual(repository.nearExpiryAlerts, []);
});

function makeJob<T>(name: string, data: unknown): Job<T> {
  return {
    attemptsMade: 1,
    data,
    id: "job-1",
    name
  } as Job<T>;
}
