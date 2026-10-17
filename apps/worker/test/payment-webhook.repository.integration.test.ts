import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import {
  INVOICE_JOB_NAMES,
  ORDER_MAINTENANCE_JOB_NAMES,
  type ProcessPaymentWebhookJobData
} from "@surgical/types";
import { Pool } from "pg";
import { PgPaymentWebhookRepository } from "../src/payments/payment-webhook.repository";

// Runs the webhook SQL against a real, migrated PostgreSQL database. CI
// provides one; locally set DATABASE_TEST_URL to a throwaway database.
const databaseUrl = process.env.DATABASE_TEST_URL;
const skip = databaseUrl ? false : "Set DATABASE_TEST_URL to a migrated test database.";
const WEBHOOK_SECRET = "integration-webhook-secret";

type RecordedJob = { data: unknown; name: string; options?: { jobId?: string } };

class RecordingQueue {
  readonly jobs: RecordedJob[] = [];

  async add(name: string, data: unknown, options?: { jobId?: string }) {
    this.jobs.push({ data, name, options });
  }
}

let pool: Pool;
const userIds: string[] = [];

async function seedOrder(orderStatus: "CANCELLED" | "CREATED") {
  const now = new Date();
  const userId = randomUUID();
  const orderId = randomUUID();
  const paymentId = randomUUID();
  const providerOrderId = `order_rzp_${randomUUID()}`;
  userIds.push(userId);

  await pool.query(
    `INSERT INTO "User" (id, "mobileNumber", "firstName", "updatedAt") VALUES ($1, $2, 'Race', $3)`,
    [userId, `+91${Math.floor(6_000_000_000 + Math.random() * 3_999_999_999)}`, now]
  );
  await pool.query(
    `INSERT INTO "Order" (id, "orderNumber", "userId", subtotal, "grandTotal", status, "paymentStatus", "updatedAt")
     VALUES ($1, $2, $3, 240.00, 283.20, $4, $5, $6)`,
    [
      orderId,
      `ORD-TEST-${randomUUID()}`,
      userId,
      orderStatus,
      orderStatus === "CANCELLED" ? "CANCELLED" : "PENDING",
      now
    ]
  );
  await pool.query(
    `INSERT INTO "Payment" (id, "orderId", method, amount, status, provider, "providerOrderId", "providerAmountPaise", "updatedAt")
     VALUES ($1, $2, 'ONLINE', 283.20, 'PENDING', 'razorpay', $3, 28320, $4)`,
    [paymentId, orderId, providerOrderId, now]
  );

  return { orderId, paymentId, providerOrderId };
}

async function capturedWebhook(providerOrderId: string, providerPaymentId: string) {
  const payload = {
    entity: "event",
    event: "payment.captured",
    payload: {
      payment: {
        entity: { amount: 28320, id: providerPaymentId, order_id: providerOrderId }
      }
    }
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const webhookId = randomUUID();

  await pool.query(
    `INSERT INTO "PaymentWebhook" (id, provider, "eventType", payload, "updatedAt")
     VALUES ($1, 'razorpay', 'payment.captured', $2, $3)`,
    [webhookId, JSON.stringify(payload), new Date()]
  );

  return {
    payload,
    provider: "razorpay",
    providerEventId: null,
    rawBodyBase64: rawBody.toString("base64"),
    receivedAt: new Date().toISOString(),
    signature: createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex"),
    version: 1,
    webhookId
  } satisfies ProcessPaymentWebhookJobData;
}

function repository() {
  const queues = {
    customerEmail: new RecordingQueue(),
    invoice: new RecordingQueue(),
    orderMaintenance: new RecordingQueue()
  };
  const config = {
    get: (key: string) =>
      ({ DATABASE_URL: databaseUrl, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET })[key]
  } as unknown as ConfigService;
  const repo = new (PgPaymentWebhookRepository as unknown as new (
    ...args: unknown[]
  ) => PgPaymentWebhookRepository)(
    config,
    queues.invoice,
    queues.customerEmail,
    queues.orderMaintenance
  );

  return { queues, repo };
}

before(() => {
  if (databaseUrl) pool = new Pool({ connectionString: databaseUrl });
});

after(async () => {
  if (!databaseUrl) return;
  const orders = `SELECT id FROM "Order" WHERE "userId" = ANY($1)`;
  await pool.query(`DELETE FROM "PaymentWebhook" WHERE "paymentId" IN (SELECT id FROM "Payment" WHERE "orderId" IN (${orders}))`, [userIds]);
  await pool.query(`DELETE FROM "Refund" WHERE "orderId" IN (${orders})`, [userIds]);
  await pool.query(`DELETE FROM "Payment" WHERE "orderId" IN (${orders})`, [userIds]);
  await pool.query(`DELETE FROM "OrderStatusHistory" WHERE "orderId" IN (${orders})`, [userIds]);
  await pool.query(`DELETE FROM "Order" WHERE "userId" = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [userIds]);
  await pool.end();
});

test("a payment captured after its order was cancelled is recorded and refunded, never invoiced", { skip }, async () => {
  const { orderId, paymentId, providerOrderId } = await seedOrder("CANCELLED");
  const { queues, repo } = repository();
  const job = await capturedWebhook(providerOrderId, `pay_${randomUUID()}`);

  try {
    const result = await repo.processRazorpayWebhook(job);
    // Razorpay retries deliveries; a replay must not refund or invoice again.
    await repo.processRazorpayWebhook(job);

    const order = await pool.query(`SELECT status, "paymentStatus" FROM "Order" WHERE id = $1`, [orderId]);
    const payment = await pool.query(`SELECT status FROM "Payment" WHERE id = $1`, [paymentId]);
    const refunds = await pool.query(
      `SELECT id, status, amount::text AS amount FROM "Refund" WHERE "paymentId" = $1`,
      [paymentId]
    );

    assert.equal(result.processed, true);
    assert.deepEqual(order.rows[0], { paymentStatus: "PAID", status: "CANCELLED" });
    assert.equal(payment.rows[0]?.status, "PAID");
    assert.equal(refunds.rows.length, 1);
    assert.equal(refunds.rows[0]?.status, "PENDING");
    assert.equal(refunds.rows[0]?.amount, "283.20");
    assert.deepEqual(
      queues.orderMaintenance.jobs.map((entry) => [entry.name, entry.options?.jobId]),
      [[ORDER_MAINTENANCE_JOB_NAMES.processRefund, `refund-${refunds.rows[0]?.id}`]]
    );
    assert.equal(queues.invoice.jobs.length, 0);
    assert.equal(queues.customerEmail.jobs.length, 0);
  } finally {
    await repo.onModuleDestroy();
  }
});

test("a payment captured on an open order confirms it and queues its invoice", { skip }, async () => {
  const { orderId, paymentId, providerOrderId } = await seedOrder("CREATED");
  const { queues, repo } = repository();

  try {
    await repo.processRazorpayWebhook(await capturedWebhook(providerOrderId, `pay_${randomUUID()}`));

    const order = await pool.query(`SELECT status, "paymentStatus" FROM "Order" WHERE id = $1`, [orderId]);
    const refunds = await pool.query(`SELECT id FROM "Refund" WHERE "paymentId" = $1`, [paymentId]);

    assert.deepEqual(order.rows[0], { paymentStatus: "PAID", status: "CONFIRMED" });
    assert.equal(refunds.rows.length, 0);
    assert.deepEqual(
      queues.invoice.jobs.map((entry) => entry.name),
      [INVOICE_JOB_NAMES.generateInvoice]
    );
    assert.equal(queues.orderMaintenance.jobs.length, 0);
  } finally {
    await repo.onModuleDestroy();
  }
});
