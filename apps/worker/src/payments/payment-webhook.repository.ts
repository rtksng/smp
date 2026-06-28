import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "@surgical/config";
import {
  INVOICE_JOB_NAMES,
  type GenerateGstInvoiceJobData,
  type InvoiceJobName,
  type ProcessPaymentWebhookJobData
} from "@surgical/types";
import type { JobsOptions, Queue } from "bullmq";
import { Pool, type PoolClient } from "pg";
import {
  PaymentWebhookRepository,
  type PaymentWebhookProcessingResult
} from "../queues/payment-webhook.processor";

const RAZORPAY_PROVIDER = "razorpay";
const PAYMENT_STATUS_PENDING = "PENDING";
const PAYMENT_STATUS_AUTHORIZED = "AUTHORIZED";
const PAYMENT_STATUS_PAID = "PAID";
const PAYMENT_STATUS_FAILED = "FAILED";
const PAYMENT_STATUS_REFUNDED = "REFUNDED";
const PAYMENT_STATUS_PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED";
const ORDER_STATUS_CREATED = "CREATED";
const ORDER_STATUS_CONFIRMED = "CONFIRMED";
const REFUND_STATUS_COMPLETED = "COMPLETED";
const REFUND_STATUS_FAILED = "FAILED";
const REFUND_STATUS_PROCESSING = "PROCESSING";
const WEBHOOK_STATUS_PROCESSING = "PROCESSING";
const WEBHOOK_STATUS_PROCESSED = "PROCESSED";
const WEBHOOK_STATUS_IGNORED = "IGNORED";
const WEBHOOK_STATUS_FAILED = "FAILED";
const FINAL_WEBHOOK_STATUSES = new Set([
  WEBHOOK_STATUS_PROCESSED,
  WEBHOOK_STATUS_IGNORED
]);

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    delay: 5000,
    type: "exponential"
  },
  removeOnComplete: 1000,
  removeOnFail: 5000
};

type RazorpayWebhookPayload = Record<string, unknown>;
type RazorpayPaymentEntity = {
  amount: number;
  id: string;
  orderId: string;
};
type RazorpayRefundEntity = {
  amount: number;
  id: string;
  paymentId: string;
  status: "failed" | "pending" | "processed";
};
type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type WebhookRow = {
  id: string;
  processingStatus: string;
};
type PaymentRow = {
  amount: string;
  id: string;
  orderId: string;
  providerPaymentId: string | null;
  status: string;
};
type OrderRow = {
  id: string;
  status: string;
  userId: string;
};
type RefundRow = {
  amount: string;
  id: string;
  paymentId: string | null;
  status: string;
};
type RepositoryResult = PaymentWebhookProcessingResult & {
  invoiceOrderId?: string;
};

@Injectable()
export class PgPaymentWebhookRepository
  extends PaymentWebhookRepository
  implements OnModuleDestroy
{
  private readonly pool: Pool;
  private readonly webhookSecret: string;

  constructor(
    configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.invoice)
    private readonly invoiceQueue: Queue<
      GenerateGstInvoiceJobData,
      void,
      InvoiceJobName
    >
  ) {
    super();
    const connectionString =
      configService.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for payment webhook workers.");
    }

    this.webhookSecret =
      configService.get<string>("RAZORPAY_WEBHOOK_SECRET") ??
      process.env.RAZORPAY_WEBHOOK_SECRET ??
      "";

    if (!this.webhookSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required for webhook workers.");
    }

    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async processRazorpayWebhook(data: ProcessPaymentWebhookJobData) {
    const rawBody = Buffer.from(data.rawBodyBase64, "base64");

    if (!verifyRazorpayWebhookSignature(rawBody, data.signature, this.webhookSecret)) {
      await markWebhookFailed(this.pool, data.webhookId, "Invalid webhook signature.");
      throw new Error("Razorpay webhook signature is invalid.");
    }

    const result = await processRecordedWebhook(this.pool, data.webhookId, data.payload);

    if (result.invoiceOrderId) {
      await this.invoiceQueue.add(
        INVOICE_JOB_NAMES.generateInvoice,
        {
          orderId: result.invoiceOrderId,
          requestedAt: new Date().toISOString(),
          version: 1
        },
        {
          ...DEFAULT_JOB_OPTIONS,
          jobId: `payment-webhook-invoice:${result.invoiceOrderId}`
        }
      );
    }

    return {
      duplicate: result.duplicate,
      processed: result.processed,
      received: result.received
    };
  }
}

async function processRecordedWebhook(
  pool: Pick<Pool, "connect">,
  webhookId: string,
  payload: unknown
): Promise<RepositoryResult> {
  const parsedPayload = normalizeWebhookPayload(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const webhook = await findWebhookForUpdate(client, webhookId);

    if (!webhook) {
      throw new Error(`Payment webhook ${webhookId} was not found.`);
    }

    if (FINAL_WEBHOOK_STATUSES.has(webhook.processingStatus)) {
      const invoiceOrderId =
        webhook.processingStatus === WEBHOOK_STATUS_PROCESSED
          ? await findCapturedPaymentInvoiceOrderId(client, parsedPayload)
          : undefined;

      await client.query("COMMIT");

      return {
        duplicate: true,
        invoiceOrderId,
        processed: false,
        received: true
      };
    }

    await client.query(
      `UPDATE "PaymentWebhook"
       SET "processingStatus" = $1,
           "processingAttempts" = "processingAttempts" + 1,
           "lastProcessingError" = NULL,
           "updatedAt" = $2
       WHERE id = $3`,
      [WEBHOOK_STATUS_PROCESSING, new Date(), webhookId]
    );

    const result = await applySupportedWebhookEvent(client, webhookId, parsedPayload);
    await markWebhookCompleted(client, webhookId, result);
    await client.query("COMMIT");

    return {
      duplicate: false,
      invoiceOrderId: result.invoiceOrderId,
      processed: result.processed,
      received: true
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await markWebhookFailed(client, webhookId, errorToMessage(error)).catch(
      () => undefined
    );
    throw error;
  } finally {
    client.release();
  }
}

async function applySupportedWebhookEvent(
  client: PoolClient,
  webhookId: string,
  payload: RazorpayWebhookPayload
) {
  const paymentEntity = extractRazorpayPaymentEntity(payload);
  const refundEntity = extractRazorpayRefundEntity(payload);
  const payment = paymentEntity
    ? await findPaymentByProviderOrderId(client, paymentEntity.orderId)
    : refundEntity
      ? await findPaymentByProviderPaymentId(client, refundEntity.paymentId)
      : null;

  if (payment) {
    await client.query(
      `UPDATE "PaymentWebhook"
       SET "paymentId" = $1,
           "updatedAt" = $2
       WHERE id = $3`,
      [payment.id, new Date(), webhookId]
    );
  }

  if (refundEntity) {
    return {
      paymentId: payment?.id ?? null,
      processed: payment
        ? await processRefundWebhookEvent(client, payload, payment, refundEntity)
        : false
    };
  }

  if (!payment || !paymentEntity) {
    return {
      paymentId: payment?.id ?? null,
      processed: false
    };
  }

  const processed = await processPaymentWebhookEvent(
    client,
    payload,
    payment,
    paymentEntity
  );

  return {
    invoiceOrderId:
      processed && readString(payload.event) === "payment.captured"
        ? payment.orderId
        : undefined,
    paymentId: payment.id,
    processed
  };
}

async function processPaymentWebhookEvent(
  client: PoolClient,
  payload: RazorpayWebhookPayload,
  payment: PaymentRow,
  paymentEntity: RazorpayPaymentEntity
) {
  const event = readString(payload.event);
  const order = await findOrderForUpdate(client, payment.orderId);

  if (!order) {
    throw new Error(`Order ${payment.orderId} was not found.`);
  }

  if (paymentEntity.amount !== decimalToPaise(payment.amount)) {
    throw new Error("Webhook payment amount does not match.");
  }

  if (event === "payment.captured") {
    if (payment.status === PAYMENT_STATUS_PAID) {
      return false;
    }

    await assertProviderPaymentIdIsUnused(client, paymentEntity.id, payment.id);
    const now = new Date();

    await client.query(
      `UPDATE "Payment"
       SET "paidAt" = $1,
           "provider" = $2,
           "providerAmountPaise" = $3,
           "providerPaymentId" = $4,
           "status" = $5,
           "transactionRef" = $4,
           "updatedAt" = $1
       WHERE id = $6`,
      [
        now,
        RAZORPAY_PROVIDER,
        paymentEntity.amount,
        paymentEntity.id,
        PAYMENT_STATUS_PAID,
        payment.id
      ]
    );

    const nextOrderStatus =
      order.status === ORDER_STATUS_CREATED ? ORDER_STATUS_CONFIRMED : order.status;

    await client.query(
      `UPDATE "Order"
       SET "paymentStatus" = $1,
           "status" = $2,
           "updatedAt" = $3
       WHERE id = $4`,
      [PAYMENT_STATUS_PAID, nextOrderStatus, now, order.id]
    );

    if (nextOrderStatus !== order.status) {
      await client.query(
        `INSERT INTO "OrderStatusHistory"
         ("id", "orderId", "status", "note", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          order.id,
          nextOrderStatus,
          "Payment captured through Razorpay webhook.",
          now,
          now
        ]
      );
    }

    await client.query(
      `DELETE FROM "CartItem"
       WHERE "cartId" IN (
         SELECT id FROM "Cart" WHERE "userId" = $1 AND "deletedAt" IS NULL
       )`,
      [order.userId]
    );

    return true;
  }

  if (event === "payment.authorized" && payment.status === PAYMENT_STATUS_PENDING) {
    const now = new Date();

    await client.query(
      `UPDATE "Payment"
       SET "provider" = $1,
           "providerAmountPaise" = $2,
           "providerPaymentId" = $3,
           "status" = $4,
           "transactionRef" = $3,
           "updatedAt" = $5
       WHERE id = $6`,
      [
        RAZORPAY_PROVIDER,
        paymentEntity.amount,
        paymentEntity.id,
        PAYMENT_STATUS_AUTHORIZED,
        now,
        payment.id
      ]
    );
    await client.query(
      `UPDATE "Order"
       SET "paymentStatus" = $1,
           "updatedAt" = $2
       WHERE id = $3`,
      [PAYMENT_STATUS_AUTHORIZED, now, payment.orderId]
    );

    return true;
  }

  if (event === "payment.failed" && payment.status === PAYMENT_STATUS_PENDING) {
    const now = new Date();

    await client.query(
      `UPDATE "Payment"
       SET "provider" = $1,
           "providerAmountPaise" = $2,
           "providerPaymentId" = $3,
           "status" = $4,
           "transactionRef" = $3,
           "updatedAt" = $5
       WHERE id = $6`,
      [
        RAZORPAY_PROVIDER,
        paymentEntity.amount,
        paymentEntity.id,
        PAYMENT_STATUS_FAILED,
        now,
        payment.id
      ]
    );
    await client.query(
      `UPDATE "Order"
       SET "paymentStatus" = $1,
           "updatedAt" = $2
       WHERE id = $3`,
      [PAYMENT_STATUS_FAILED, now, payment.orderId]
    );

    return true;
  }

  return false;
}

async function processRefundWebhookEvent(
  client: PoolClient,
  payload: RazorpayWebhookPayload,
  payment: PaymentRow,
  refundEntity: RazorpayRefundEntity
) {
  const event = readString(payload.event);

  if (event !== "refund.processed" && event !== "refund.failed") {
    return false;
  }

  if (payment.providerPaymentId !== refundEntity.paymentId) {
    throw new Error("Webhook refund payment id does not match.");
  }

  const refund = await findRefundByProviderRefundId(client, refundEntity.id);

  if (!refund) {
    return false;
  }

  if (refund.paymentId !== payment.id) {
    throw new Error("Webhook refund does not match this payment.");
  }

  if (refundEntity.amount !== decimalToPaise(refund.amount)) {
    throw new Error("Webhook refund amount does not match.");
  }

  const status = mapRazorpayRefundStatus(refundEntity.status);

  if (refund.status === status) {
    return false;
  }

  const now = new Date();

  await client.query(
    `UPDATE "Refund"
     SET "processedAt" = $1,
         "status" = $2,
         "updatedAt" = $3
     WHERE id = $4`,
    [status === REFUND_STATUS_COMPLETED ? now : null, status, now, refund.id]
  );

  if (status === REFUND_STATUS_COMPLETED) {
    await updatePaymentRefundStatus(client, payment);
  }

  return true;
}

async function updatePaymentRefundStatus(client: PoolClient, payment: PaymentRow) {
  const completedRefunds = await client.query<{ amount: string }>(
    `SELECT amount::text AS amount
     FROM "Refund"
     WHERE "paymentId" = $1 AND "status" = $2`,
    [payment.id, REFUND_STATUS_COMPLETED]
  );
  const completedAmount = completedRefunds.rows.reduce(
    (sum, refund) => sum + decimalToNumber(refund.amount),
    0
  );
  const paidAmount = decimalToNumber(payment.amount);
  const nextStatus =
    completedAmount >= paidAmount
      ? PAYMENT_STATUS_REFUNDED
      : PAYMENT_STATUS_PARTIALLY_REFUNDED;
  const now = new Date();

  await client.query(
    `UPDATE "Payment"
     SET "status" = $1,
         "updatedAt" = $2
     WHERE id = $3`,
    [nextStatus, now, payment.id]
  );
  await client.query(
    `UPDATE "Order"
     SET "paymentStatus" = $1,
         "updatedAt" = $2
     WHERE id = $3`,
    [nextStatus, now, payment.orderId]
  );
}

async function findWebhookForUpdate(client: PoolClient, webhookId: string) {
  const result = await client.query<WebhookRow>(
    `SELECT id, "processingStatus"
     FROM "PaymentWebhook"
     WHERE id = $1
     FOR UPDATE`,
    [webhookId]
  );

  return result.rows[0] ?? null;
}

async function findPaymentByProviderOrderId(
  client: PoolClient,
  providerOrderId: string
) {
  const result = await client.query<PaymentRow>(
    `SELECT id,
            "orderId",
            amount::text AS amount,
            status,
            "providerPaymentId"
     FROM "Payment"
     WHERE "providerOrderId" = $1
     FOR UPDATE`,
    [providerOrderId]
  );

  return result.rows[0] ?? null;
}

async function findCapturedPaymentInvoiceOrderId(
  client: PoolClient,
  payload: RazorpayWebhookPayload
) {
  if (readString(payload.event) !== "payment.captured") {
    return undefined;
  }

  const paymentEntity = extractRazorpayPaymentEntity(payload);

  if (!paymentEntity) {
    return undefined;
  }

  const payment = await findPaymentByProviderOrderId(client, paymentEntity.orderId);

  return payment?.orderId;
}

async function findPaymentByProviderPaymentId(
  client: PoolClient,
  providerPaymentId: string
) {
  const result = await client.query<PaymentRow>(
    `SELECT id,
            "orderId",
            amount::text AS amount,
            status,
            "providerPaymentId"
     FROM "Payment"
     WHERE "providerPaymentId" = $1
     FOR UPDATE`,
    [providerPaymentId]
  );

  return result.rows[0] ?? null;
}

async function findOrderForUpdate(client: PoolClient, orderId: string) {
  const result = await client.query<OrderRow>(
    `SELECT id, status, "userId"
     FROM "Order"
     WHERE id = $1
     FOR UPDATE`,
    [orderId]
  );

  return result.rows[0] ?? null;
}

async function findRefundByProviderRefundId(
  client: PoolClient,
  providerRefundId: string
) {
  const result = await client.query<RefundRow>(
    `SELECT id,
            "paymentId",
            amount::text AS amount,
            status
     FROM "Refund"
     WHERE "providerRefundId" = $1
     FOR UPDATE`,
    [providerRefundId]
  );

  return result.rows[0] ?? null;
}

async function assertProviderPaymentIdIsUnused(
  client: PoolClient,
  providerPaymentId: string,
  currentPaymentId: string
) {
  const existingPayment = await client.query<{ id: string }>(
    `SELECT id
     FROM "Payment"
     WHERE "providerPaymentId" = $1 AND id <> $2
     LIMIT 1`,
    [providerPaymentId, currentPaymentId]
  );

  if (existingPayment.rows[0]) {
    throw new Error("Razorpay payment id is already recorded.");
  }
}

async function markWebhookCompleted(
  client: PoolClient,
  webhookId: string,
  result: { paymentId?: string | null; processed: boolean }
) {
  await client.query(
    `UPDATE "PaymentWebhook"
     SET "paymentId" = COALESCE($1, "paymentId"),
         "processingStatus" = $2,
         "processedAt" = $3,
         "lastProcessingError" = NULL,
         "updatedAt" = $4
     WHERE id = $5`,
    [
      result.paymentId ?? null,
      result.processed ? WEBHOOK_STATUS_PROCESSED : WEBHOOK_STATUS_IGNORED,
      result.processed ? new Date() : null,
      new Date(),
      webhookId
    ]
  );
}

async function markWebhookFailed(
  client: Pick<PoolClient, "query">,
  webhookId: string,
  message: string
) {
  await client.query(
    `UPDATE "PaymentWebhook"
     SET "processingStatus" = $1,
         "lastProcessingError" = $2,
         "updatedAt" = $3
     WHERE id = $4`,
    [WEBHOOK_STATUS_FAILED, message.slice(0, 5000), new Date(), webhookId]
  );
}

function extractRazorpayPaymentEntity(
  payload: RazorpayWebhookPayload
): RazorpayPaymentEntity | null {
  const eventPayload = readRecord(payload.payload);
  const paymentWrapper = readRecord(eventPayload?.payment);
  const entity = readRecord(paymentWrapper?.entity);
  const id = readString(entity?.id);
  const orderId = readString(entity?.order_id);
  const amount = entity?.amount;

  if (!id || !orderId || typeof amount !== "number") {
    return null;
  }

  return {
    amount,
    id,
    orderId
  };
}

function extractRazorpayRefundEntity(
  payload: RazorpayWebhookPayload
): RazorpayRefundEntity | null {
  const eventPayload = readRecord(payload.payload);
  const refundWrapper = readRecord(eventPayload?.refund);
  const entity = readRecord(refundWrapper?.entity);
  const id = readString(entity?.id);
  const paymentId = readString(entity?.payment_id);
  const amount = entity?.amount;
  const status = readRazorpayRefundStatus(entity?.status);

  if (!id || !paymentId || typeof amount !== "number" || !status) {
    return null;
  }

  return {
    amount,
    id,
    paymentId,
    status
  };
}

function normalizeWebhookPayload(payload: unknown): RazorpayWebhookPayload {
  if (!isRecord(payload)) {
    throw new Error("Razorpay webhook payload is invalid.");
  }

  return payload;
}

function decimalToNumber(value: DecimalValue) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
}

function decimalToPaise(value: DecimalValue) {
  return Math.round(decimalToNumber(value) * 100);
}

function mapRazorpayRefundStatus(status: "failed" | "pending" | "processed") {
  if (status === "processed") {
    return REFUND_STATUS_COMPLETED;
  }

  if (status === "failed") {
    return REFUND_STATUS_FAILED;
  }

  return REFUND_STATUS_PROCESSING;
}

function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readRazorpayRefundStatus(value: unknown) {
  return value === "failed" || value === "pending" || value === "processed"
    ? value
    : null;
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
