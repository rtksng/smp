import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import type { RazorpayClient } from "../../src/modules/payments/razorpay.client";
import type { ApiQueueService } from "../../src/queues/api-queue.service";

const now = new Date("2026-05-25T10:00:00.000Z");
const keySecret = "test-razorpay-key-secret";
const webhookSecret = "test-webhook-secret";

type FakePayment = {
  amount: string;
  id: string;
  method: "COD" | "ONLINE";
  orderId: string;
  paidAt: Date | null;
  provider: string | null;
  providerAmountPaise: number | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: string;
  transactionRef: string | null;
};

type FakeOrder = {
  deletedAt: Date | null;
  grandTotal: string;
  id: string;
  orderNumber: string;
  paymentStatus: string;
  payments: FakePayment[];
  status: string;
  userId: string;
};

function createPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string
) {
  return createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

function createWebhookSignature(rawBody: Buffer) {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

function createPaymentsPrismaMock(input?: {
  existingWebhookEventId?: string;
  order?: Partial<FakeOrder>;
  payment?: Partial<FakePayment>;
}) {
  const payment: FakePayment = {
    amount: "283.20",
    id: "payment-1",
    method: "ONLINE",
    orderId: "order-1",
    paidAt: null,
    provider: null,
    providerAmountPaise: null,
    providerOrderId: null,
    providerPaymentId: null,
    status: "PENDING",
    transactionRef: null,
    ...input?.payment
  };
  const order: FakeOrder = {
    deletedAt: null,
    grandTotal: "283.20",
    id: "order-1",
    orderNumber: "ORD-20260525-000001",
    paymentStatus: "PENDING",
    payments: [payment],
    status: "CREATED",
    userId: "customer-1",
    ...input?.order
  };
  const calls: Record<string, unknown[]> = {
    orderFindFirst: [],
    orderStatusHistoryCreate: [],
    orderUpdate: [],
    paymentFindFirst: [],
    paymentUpdate: [],
    paymentWebhookCreate: [],
    paymentWebhookFindFirst: [],
    refundCreate: []
  };
  const existingWebhookIds = new Set<string>();

  if (input?.existingWebhookEventId) {
    existingWebhookIds.add(input.existingWebhookEventId);
  }

  const prisma = {
    calls,
    records: {
      order,
      payment
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma),
    order: {
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        const where = (args as { where: { id?: string; userId?: string } }).where;

        if (where.id !== order.id || where.userId !== order.userId) {
          return null;
        }

        return order;
      },
      update: async (args: { data: Partial<FakeOrder>; where: { id: string } }) => {
        calls.orderUpdate.push(args);
        Object.assign(order, args.data);
        return order;
      }
    },
    orderStatusHistory: {
      create: async (args: unknown) => {
        calls.orderStatusHistoryCreate.push(args);
        return {
          createdAt: now,
          id: `history-${calls.orderStatusHistoryCreate.length}`,
          updatedAt: now
        };
      }
    },
    payment: {
      findFirst: async (args: unknown) => {
        calls.paymentFindFirst.push(args);
        const where = (args as {
          where: {
            id?: string;
            providerOrderId?: string;
            providerPaymentId?: string;
          };
        }).where;

        if (where.providerOrderId && where.providerOrderId !== payment.providerOrderId) {
          return null;
        }

        if (
          where.providerPaymentId &&
          where.providerPaymentId !== payment.providerPaymentId
        ) {
          return null;
        }

        if (where.id && where.id !== payment.id) {
          return null;
        }

        return {
          ...payment,
          order
        };
      },
      update: async (args: { data: Partial<FakePayment>; where: { id: string } }) => {
        calls.paymentUpdate.push(args);
        Object.assign(payment, args.data);
        return payment;
      }
    },
    paymentWebhook: {
      create: async (args: {
        data: {
          eventType: string;
          providerEventId?: string | null;
          rawPayload: string;
        };
      }) => {
        calls.paymentWebhookCreate.push(args);
        if (args.data.providerEventId) {
          existingWebhookIds.add(args.data.providerEventId);
        }

        return {
          createdAt: now,
          id: `webhook-${calls.paymentWebhookCreate.length}`,
          processedAt: null,
          updatedAt: now,
          ...args.data
        };
      },
      findFirst: async (args: { where: { providerEventId?: string | null } }) => {
        calls.paymentWebhookFindFirst.push(args);

        if (
          args.where.providerEventId &&
          existingWebhookIds.has(args.where.providerEventId)
        ) {
          return {
            id: "webhook-existing",
            processedAt: now,
            providerEventId: args.where.providerEventId
          };
        }

        return null;
      },
      update: async (args: unknown) => args
    },
    refund: {
      create: async (args: unknown) => {
        calls.refundCreate.push(args);
        return {
          id: "refund-1"
        };
      }
    }
  };

  return prisma;
}

function createRazorpayClientMock() {
  const calls: Record<string, unknown[]> = {
    createOrder: []
  };
  const client = {
    calls,
    createOrder: async (input: unknown) => {
      calls.createOrder.push(input);

      return {
        amount: 28320,
        currency: "INR",
        id: "order_razorpay_1",
        receipt: "ORD-20260525-000001",
        status: "created"
      };
    },
    verifyPaymentSignature: (
      razorpayOrderId: string,
      razorpayPaymentId: string,
      signature: string
    ) =>
      signature === createPaymentSignature(razorpayOrderId, razorpayPaymentId),
    verifyWebhookSignature: (rawBody: Buffer, signature: string) =>
      signature === createWebhookSignature(rawBody)
  };

  return client;
}

class FakePaymentQueue {
  readonly invoiceJobs: unknown[] = [];
  readonly paymentWebhookJobs: unknown[] = [];

  async enqueueInvoice(data: unknown) {
    this.invoiceJobs.push(data);
  }

  async enqueuePaymentWebhook(data: unknown) {
    this.paymentWebhookJobs.push(data);
  }

  async generateForConfirmedOrder() {
    return {
      id: "invoice-sync-fallback"
    };
  }
}

test("createRazorpayOrder rejects orders that do not belong to the authenticated customer", async () => {
  const prisma = createPaymentsPrismaMock();
  const razorpayClient = createRazorpayClientMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.createRazorpayOrder("customer-2", {
        orderId: "order-1"
      }),
    NotFoundException
  );
  assert.equal(razorpayClient.calls.createOrder.length, 0);
});

test("createRazorpayOrder rejects cancelled orders and does not create a gateway order", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      status: "CANCELLED"
    }
  });
  const razorpayClient = createRazorpayClientMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.createRazorpayOrder("customer-1", {
        orderId: "order-1"
      }),
    BadRequestException
  );
  assert.equal(razorpayClient.calls.createOrder.length, 0);
});

test("verifyRazorpayPayment verifies the signature and confirms a created order", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerOrderId: "order_razorpay_1"
    }
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );

  const result = await service.verifyRazorpayPayment("customer-1", {
    orderId: "order-1",
    razorpay_order_id: "order_razorpay_1",
    razorpay_payment_id: "pay_razorpay_1",
    razorpay_signature: createPaymentSignature(
      "order_razorpay_1",
      "pay_razorpay_1"
    )
  });

  assert.equal(result.paymentStatus, "PAID");
  assert.equal(prisma.records.payment.status, "PAID");
  assert.equal(prisma.records.payment.providerPaymentId, "pay_razorpay_1");
  assert.equal(prisma.records.order.paymentStatus, "PAID");
  assert.equal(prisma.records.order.status, "CONFIRMED");
});

test("verifyRazorpayPayment enqueues invoice generation after payment confirmation", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerOrderId: "order_razorpay_1"
    }
  });
  const queue = new FakePaymentQueue();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient,
    queue as unknown as ApiQueueService
  );

  await service.verifyRazorpayPayment("customer-1", {
    orderId: "order-1",
    razorpay_order_id: "order_razorpay_1",
    razorpay_payment_id: "pay_razorpay_1",
    razorpay_signature: createPaymentSignature(
      "order_razorpay_1",
      "pay_razorpay_1"
    )
  });

  assert.equal(queue.invoiceJobs.length, 1);
  assert.deepEqual(
    {
      orderId: (queue.invoiceJobs[0] as { orderId: string }).orderId,
      version: (queue.invoiceJobs[0] as { version: number }).version
    },
    {
      orderId: "order-1",
      version: 1
    }
  );
  assert.ok(Date.parse((queue.invoiceJobs[0] as { requestedAt: string }).requestedAt));
});

test("verifyRazorpayPayment rejects invalid signatures", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerOrderId: "order_razorpay_1"
    }
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.verifyRazorpayPayment("customer-1", {
        orderId: "order-1",
        razorpay_order_id: "order_razorpay_1",
        razorpay_payment_id: "pay_razorpay_1",
        razorpay_signature: "invalid-signature"
      }),
    UnauthorizedException
  );
  assert.equal(prisma.records.payment.status, "PENDING");
  assert.equal(prisma.records.order.paymentStatus, "PENDING");
});

test("verifyRazorpayPayment rejects stored Razorpay amount mismatches", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerAmountPaise: 100,
      providerOrderId: "order_razorpay_1"
    }
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.verifyRazorpayPayment("customer-1", {
        orderId: "order-1",
        razorpay_order_id: "order_razorpay_1",
        razorpay_payment_id: "pay_razorpay_1",
        razorpay_signature: createPaymentSignature(
          "order_razorpay_1",
          "pay_razorpay_1"
        )
      }),
    BadRequestException
  );
  assert.equal(prisma.records.payment.status, "PENDING");
  assert.equal(prisma.records.order.paymentStatus, "PENDING");
});

test("verifyRazorpayPayment prevents duplicate successful payments", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      paymentStatus: "PAID"
    },
    payment: {
      provider: "razorpay",
      providerOrderId: "order_razorpay_1",
      providerPaymentId: "pay_razorpay_1",
      status: "PAID"
    }
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.verifyRazorpayPayment("customer-1", {
        orderId: "order-1",
        razorpay_order_id: "order_razorpay_1",
        razorpay_payment_id: "pay_razorpay_2",
        razorpay_signature: createPaymentSignature(
          "order_razorpay_1",
          "pay_razorpay_2"
        )
      }),
    ConflictException
  );
});

test("handleRazorpayWebhook rejects invalid webhook signatures before persisting", async () => {
  const prisma = createPaymentsPrismaMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );
  const payload = {
    event: "payment.captured",
    payload: {}
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  await assert.rejects(
    () => service.handleRazorpayWebhook(rawBody, payload, "invalid-signature"),
    UnauthorizedException
  );
  assert.equal(prisma.calls.paymentWebhookCreate.length, 0);
});

test("handleRazorpayWebhook enqueues signed payload for async webhook follow-up", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerOrderId: "order_razorpay_1"
    }
  });
  const queue = new FakePaymentQueue();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient,
    queue as unknown as ApiQueueService
  );
  const payload = {
    account_id: "acc_1",
    contains: ["payment"],
    created_at: 1779693600,
    entity: "event",
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          amount: 28320,
          id: "pay_razorpay_1",
          order_id: "order_razorpay_1"
        }
      }
    },
    id: "evt_1"
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  const result = (await service.handleRazorpayWebhook(
    rawBody,
    payload,
    createWebhookSignature(rawBody)
  )) as Record<string, unknown>;

  assert.equal(result.queued, true);
  assert.equal(result.received, true);
  assert.equal(queue.paymentWebhookJobs.length, 1);
  assert.deepEqual(
    {
      provider: (queue.paymentWebhookJobs[0] as { provider: string }).provider,
      providerEventId: (queue.paymentWebhookJobs[0] as { providerEventId: string })
        .providerEventId,
      rawBodyBase64: (
        queue.paymentWebhookJobs[0] as { rawBodyBase64: string }
      ).rawBodyBase64,
      signature: (queue.paymentWebhookJobs[0] as { signature: string }).signature,
      version: (queue.paymentWebhookJobs[0] as { version: number }).version
    },
    {
      provider: "razorpay",
      providerEventId: "evt_1",
      rawBodyBase64: rawBody.toString("base64"),
      signature: createWebhookSignature(rawBody),
      version: 1
    }
  );
  assert.ok(
    Date.parse(
      (queue.paymentWebhookJobs[0] as { receivedAt: string }).receivedAt
    )
  );
  assert.equal(prisma.calls.paymentWebhookCreate.length, 1);
  assert.equal(prisma.records.payment.status, "PAID");
});
