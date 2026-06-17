import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
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

type FakeRefund = {
  amount: string;
  createdAt: Date;
  id: string;
  orderId: string;
  paymentId: string | null;
  processedAt: Date | null;
  providerRefundId: string | null;
  reason: string | null;
  status: string;
  updatedAt: Date;
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

function createPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string) {
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
  payments?: Partial<FakePayment>[];
  refund?: Partial<FakeRefund>;
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
  const payments: FakePayment[] = [
    payment,
    ...(input?.payments ?? []).map((entry, index) => ({
      ...payment,
      id: `payment-${index + 2}`,
      providerAmountPaise: null,
      providerOrderId: null,
      providerPaymentId: null,
      transactionRef: null,
      ...entry
    }))
  ];
  const order: FakeOrder = {
    deletedAt: null,
    grandTotal: "283.20",
    id: "order-1",
    orderNumber: "ORD-20260525-000001",
    paymentStatus: "PENDING",
    payments,
    status: "CREATED",
    userId: "customer-1",
    ...input?.order
  };
  const refunds: FakeRefund[] = input?.refund
    ? [
        {
          amount: input.refund.amount ?? payment.amount,
          createdAt: now,
          id: input.refund.id ?? "refund-1",
          orderId: input.refund.orderId ?? order.id,
          paymentId:
            input.refund.paymentId === undefined ? payment.id : input.refund.paymentId,
          processedAt: input.refund.processedAt ?? null,
          providerRefundId: input.refund.providerRefundId ?? null,
          reason: input.refund.reason ?? "Customer requested return.",
          status: input.refund.status ?? "PENDING",
          updatedAt: now
        }
      ]
    : [];
  const calls: Record<string, unknown[]> = {
    cartItemDeleteMany: [],
    orderFindFirst: [],
    orderStatusHistoryCreate: [],
    orderUpdate: [],
    paymentCreate: [],
    paymentFindFirst: [],
    paymentUpdate: [],
    paymentWebhookCreate: [],
    paymentWebhookFindFirst: [],
    refundCreate: [],
    refundFindFirst: [],
    refundFindMany: [],
    refundUpdate: []
  };
  const existingWebhookIds = new Set<string>();

  if (input?.existingWebhookEventId) {
    existingWebhookIds.add(input.existingWebhookEventId);
  }

  const prisma = {
    calls,
    records: {
      order,
      payment,
      payments,
      refunds
    },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma),
    cartItem: {
      deleteMany: async (args: unknown) => {
        calls.cartItemDeleteMany.push(args);
        return { count: 1 };
      }
    },
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
      create: async (args: { data: Partial<FakePayment> }) => {
        calls.paymentCreate.push(args);
        const createdPayment: FakePayment = {
          amount: String(args.data.amount ?? payment.amount),
          id: `payment-${payments.length + 1}`,
          method: args.data.method ?? "ONLINE",
          orderId: args.data.orderId ?? order.id,
          paidAt: null,
          provider: null,
          providerAmountPaise: null,
          providerOrderId: null,
          providerPaymentId: null,
          status: args.data.status ?? "PENDING",
          transactionRef: null
        };

        payments.push(createdPayment);
        order.payments = payments;
        return createdPayment;
      },
      findFirst: async (args: unknown) => {
        calls.paymentFindFirst.push(args);
        const where = (
          args as {
            where: {
              id?: string;
              providerOrderId?: string;
              providerPaymentId?: string;
            };
          }
        ).where;
        const matchingPayment = payments.find((candidate) => {
          if (
            where.providerOrderId &&
            where.providerOrderId !== candidate.providerOrderId
          ) {
            return false;
          }

          if (
            where.providerPaymentId &&
            where.providerPaymentId !== candidate.providerPaymentId
          ) {
            return false;
          }

          if (where.id && where.id !== candidate.id) {
            return false;
          }

          return true;
        });

        if (!matchingPayment) {
          return null;
        }

        return {
          ...matchingPayment,
          order
        };
      },
      update: async (args: { data: Partial<FakePayment>; where: { id: string } }) => {
        calls.paymentUpdate.push(args);
        const targetPayment = payments.find(
          (candidate) => candidate.id === args.where.id
        );

        if (!targetPayment) {
          throw new Error(`Payment ${args.where.id} not found in mock.`);
        }

        Object.assign(targetPayment, args.data);
        return targetPayment;
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
      },
      findFirst: async (args: unknown) => {
        calls.refundFindFirst.push(args);
        const where = (
          args as {
            where?: {
              id?: string;
              orderId?: string;
              providerRefundId?: string;
              status?: { in?: string[] } | string;
            };
          }
        ).where ?? {};
        const refund =
          refunds.find((candidate) => {
            if (where.id && candidate.id !== where.id) {
              return false;
            }

            if (where.orderId && candidate.orderId !== where.orderId) {
              return false;
            }

            if (
              where.providerRefundId &&
              candidate.providerRefundId !== where.providerRefundId
            ) {
              return false;
            }

            if (
              typeof where.status === "string" &&
              candidate.status !== where.status
            ) {
              return false;
            }

            if (
              typeof where.status === "object" &&
              where.status.in &&
              !where.status.in.includes(candidate.status)
            ) {
              return false;
            }

            return true;
          }) ?? null;

        if (!refund) {
          return null;
        }

        return {
          ...refund,
          order,
          payment: refund.paymentId
            ? payments.find((candidate) => candidate.id === refund.paymentId) ?? null
            : null
        };
      },
      findMany: async (args: unknown) => {
        calls.refundFindMany.push(args);
        const where = (
          args as {
            where?: {
              paymentId?: string;
              status?: string;
            };
          }
        ).where ?? {};

        return refunds.filter((candidate) => {
          if (where.paymentId && candidate.paymentId !== where.paymentId) {
            return false;
          }

          if (where.status && candidate.status !== where.status) {
            return false;
          }

          return true;
        });
      },
      update: async (args: { data: Partial<FakeRefund>; where: { id: string } }) => {
        calls.refundUpdate.push(args);
        const refund = refunds.find((candidate) => candidate.id === args.where.id);

        if (!refund) {
          throw new Error(`Refund ${args.where.id} not found in mock.`);
        }

        Object.assign(refund, args.data);
        return refund;
      }
    }
  };

  return prisma;
}

function createRazorpayClientMock() {
  const calls: Record<string, unknown[]> = {
    createOrder: [],
    createRefund: [],
    fetchRefund: []
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
    createRefund: async (paymentId: string, input: unknown) => {
      calls.createRefund.push({ input, paymentId });

      return {
        amount: 28320,
        id: "rfnd_razorpay_1",
        payment_id: paymentId,
        status: "processed"
      };
    },
    fetchRefund: async (refundId: string) => {
      calls.fetchRefund.push(refundId);

      return {
        amount: 28320,
        id: refundId,
        payment_id: "pay_razorpay_1",
        status: "processed"
      };
    },
    getKeyId: () => "rzp_test_key",
    isConfigured: () => true,
    verifyPaymentSignature: (
      razorpayOrderId: string,
      razorpayPaymentId: string,
      signature: string
    ) => signature === createPaymentSignature(razorpayOrderId, razorpayPaymentId),
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

test("getPaymentGatewayStatus reports Razorpay unavailable when keys are not configured", () => {
  const razorpayClient = {
    ...createRazorpayClientMock(),
    isConfigured: () => false
  };
  const service = new PaymentsService(
    createPaymentsPrismaMock() as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  assert.deepEqual(service.getPaymentGatewayStatus(), {
    message: "Payment gateway is not configured yet.",
    onlinePaymentEnabled: false,
    provider: "razorpay"
  });
});

test("createRazorpayOrder stops before gateway calls when Razorpay is unavailable", async () => {
  const prisma = createPaymentsPrismaMock();
  const razorpayClient = {
    ...createRazorpayClientMock(),
    isConfigured: () => false
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  await assert.rejects(
    () =>
      service.createRazorpayOrder("customer-1", {
        orderId: "order-1"
      }),
    ServiceUnavailableException
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

test("createRazorpayOrder creates a fresh attempt for failed online payments", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      paymentStatus: "FAILED"
    },
    payment: {
      provider: "razorpay",
      providerAmountPaise: 28320,
      providerOrderId: "order_failed_1",
      providerPaymentId: "pay_failed_1",
      status: "FAILED",
      transactionRef: "pay_failed_1"
    }
  });
  const razorpayClient = createRazorpayClientMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  const result = await service.createRazorpayOrder("customer-1", {
    orderId: "order-1"
  });
  const retryPayment = prisma.records.payments[1];

  assert.equal(prisma.calls.paymentCreate.length, 1);
  assert.equal(prisma.records.order.paymentStatus, "PENDING");
  assert.equal(retryPayment?.status, "PENDING");
  assert.equal(retryPayment?.providerOrderId, "order_razorpay_1");
  assert.equal(result.paymentId, retryPayment?.id);
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
    razorpay_signature: createPaymentSignature("order_razorpay_1", "pay_razorpay_1")
  });

  assert.equal(result.paymentStatus, "PAID");
  assert.equal(prisma.records.payment.status, "PAID");
  assert.equal(prisma.records.payment.providerPaymentId, "pay_razorpay_1");
  assert.equal(prisma.records.order.paymentStatus, "PAID");
  assert.equal(prisma.records.order.status, "CONFIRMED");
  assert.equal(prisma.calls.cartItemDeleteMany.length, 1);
});

test("verifyRazorpayPayment confirms the matching retry attempt after an earlier failure", async () => {
  const prisma = createPaymentsPrismaMock({
    payment: {
      provider: "razorpay",
      providerAmountPaise: 28320,
      providerOrderId: "order_failed_1",
      providerPaymentId: "pay_failed_1",
      status: "FAILED",
      transactionRef: "pay_failed_1"
    },
    payments: [
      {
        id: "payment-retry-1",
        provider: "razorpay",
        providerOrderId: "order_retry_1",
        status: "PENDING"
      }
    ]
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );

  const result = await service.verifyRazorpayPayment("customer-1", {
    orderId: "order-1",
    razorpay_order_id: "order_retry_1",
    razorpay_payment_id: "pay_retry_1",
    razorpay_signature: createPaymentSignature("order_retry_1", "pay_retry_1")
  });

  assert.equal(result.paymentId, "payment-retry-1");
  assert.equal(result.paymentStatus, "PAID");
  assert.equal(prisma.records.payments[0]?.status, "FAILED");
  assert.equal(prisma.records.payments[1]?.status, "PAID");
  assert.equal(prisma.records.payments[1]?.providerPaymentId, "pay_retry_1");
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
    razorpay_signature: createPaymentSignature("order_razorpay_1", "pay_razorpay_1")
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
        razorpay_signature: createPaymentSignature("order_razorpay_1", "pay_razorpay_1")
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
        razorpay_signature: createPaymentSignature("order_razorpay_1", "pay_razorpay_2")
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
      rawBodyBase64: (queue.paymentWebhookJobs[0] as { rawBodyBase64: string })
        .rawBodyBase64,
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
    Date.parse((queue.paymentWebhookJobs[0] as { receivedAt: string }).receivedAt)
  );
  assert.equal(prisma.calls.paymentWebhookCreate.length, 1);
  assert.equal(prisma.records.payment.status, "PAID");
  assert.equal(prisma.calls.cartItemDeleteMany.length, 1);
});

test("handleRazorpayWebhook marks failed payments for customer recovery", async () => {
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
  const payload = {
    account_id: "acc_1",
    contains: ["payment"],
    created_at: 1779693600,
    entity: "event",
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          amount: 28320,
          id: "pay_failed_1",
          order_id: "order_razorpay_1"
        }
      }
    },
    id: "evt_failed_1"
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  const result = (await service.handleRazorpayWebhook(
    rawBody,
    payload,
    createWebhookSignature(rawBody)
  )) as Record<string, unknown>;

  assert.equal(result.processed, true);
  assert.equal(prisma.records.payment.status, "FAILED");
  assert.equal(prisma.records.payment.providerPaymentId, "pay_failed_1");
  assert.equal(prisma.records.order.paymentStatus, "FAILED");
});

test("processPendingOrderRefund creates a Razorpay refund and completes local refund state", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      paymentStatus: "PAID",
      status: "RETURNED"
    },
    payment: {
      paidAt: now,
      provider: "razorpay",
      providerAmountPaise: 28320,
      providerOrderId: "order_razorpay_1",
      providerPaymentId: "pay_razorpay_1",
      status: "PAID",
      transactionRef: "pay_razorpay_1"
    },
    refund: {
      amount: "283.20",
      paymentId: "payment-1",
      reason: "Seal was damaged on arrival",
      status: "PENDING"
    }
  });
  const razorpayClient = createRazorpayClientMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  const result = await service.processPendingOrderRefund("order-1");

  assert.equal(result?.status, "COMPLETED");
  assert.equal(prisma.records.refunds[0]?.providerRefundId, "rfnd_razorpay_1");
  assert.equal(prisma.records.refunds[0]?.status, "COMPLETED");
  assert.ok(prisma.records.refunds[0]?.processedAt instanceof Date);
  assert.equal(prisma.records.payment.status, "REFUNDED");
  assert.equal(prisma.records.order.paymentStatus, "REFUNDED");
  assert.deepEqual(razorpayClient.calls.createRefund, [
    {
      input: {
        amount: 28320,
        notes: {
          orderId: "order-1",
          orderNumber: "ORD-20260525-000001",
          refundId: "refund-1"
        },
        receipt: "refund-refund-1",
        speed: "normal"
      },
      paymentId: "pay_razorpay_1"
    }
  ]);
});

test("processPendingOrderRefund refetches failed Razorpay refund status", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      paymentStatus: "PAID",
      status: "RETURNED"
    },
    payment: {
      paidAt: now,
      provider: "razorpay",
      providerAmountPaise: 28320,
      providerOrderId: "order_razorpay_1",
      providerPaymentId: "pay_razorpay_1",
      status: "PAID",
      transactionRef: "pay_razorpay_1"
    },
    refund: {
      amount: "283.20",
      paymentId: "payment-1",
      providerRefundId: "rfnd_razorpay_1",
      reason: "Seal was damaged on arrival",
      status: "FAILED"
    }
  });
  const razorpayClient = createRazorpayClientMock();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    razorpayClient as unknown as RazorpayClient
  );

  const result = await service.processPendingOrderRefund("order-1");

  assert.equal(result?.status, "COMPLETED");
  assert.deepEqual(razorpayClient.calls.fetchRefund, ["rfnd_razorpay_1"]);
  assert.equal(razorpayClient.calls.createRefund.length, 0);
  assert.equal(prisma.records.refunds[0]?.status, "COMPLETED");
  assert.ok(prisma.records.refunds[0]?.processedAt instanceof Date);
  assert.equal(prisma.records.payment.status, "REFUNDED");
  assert.equal(prisma.records.order.paymentStatus, "REFUNDED");
});

test("handleRazorpayWebhook completes processing refunds from Razorpay refund webhooks", async () => {
  const prisma = createPaymentsPrismaMock({
    order: {
      paymentStatus: "PAID",
      status: "RETURNED"
    },
    payment: {
      paidAt: now,
      provider: "razorpay",
      providerAmountPaise: 28320,
      providerOrderId: "order_razorpay_1",
      providerPaymentId: "pay_razorpay_1",
      status: "PAID",
      transactionRef: "pay_razorpay_1"
    },
    refund: {
      amount: "283.20",
      paymentId: "payment-1",
      providerRefundId: "rfnd_razorpay_1",
      reason: "Seal was damaged on arrival",
      status: "PROCESSING"
    }
  });
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    createRazorpayClientMock() as unknown as RazorpayClient
  );
  const payload = {
    account_id: "acc_1",
    contains: ["refund"],
    created_at: 1779693600,
    entity: "event",
    event: "refund.processed",
    id: "evt_refund_1",
    payload: {
      refund: {
        entity: {
          amount: 28320,
          id: "rfnd_razorpay_1",
          payment_id: "pay_razorpay_1",
          status: "processed"
        }
      }
    }
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  const result = (await service.handleRazorpayWebhook(
    rawBody,
    payload,
    createWebhookSignature(rawBody)
  )) as Record<string, unknown>;

  assert.equal(result.processed, true);
  assert.equal(prisma.records.refunds[0]?.status, "COMPLETED");
  assert.ok(prisma.records.refunds[0]?.processedAt instanceof Date);
  assert.equal(prisma.records.payment.status, "REFUNDED");
  assert.equal(prisma.records.order.paymentStatus, "REFUNDED");
});
