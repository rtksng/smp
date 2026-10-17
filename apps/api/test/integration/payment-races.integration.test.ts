import "reflect-metadata";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../src/database/prisma.service";
import { OrdersService } from "../../src/modules/orders/orders.service";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { RazorpayClient } from "../../src/modules/payments/razorpay.client";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

// Runs against a real, migrated PostgreSQL database so row locks and
// conditional updates are exercised for real. CI provides one; locally:
//   DATABASE_TEST_URL=postgresql://... node scripts/run-tests.mjs
const databaseUrl = process.env.DATABASE_TEST_URL;
const skip = databaseUrl ? false : "Set DATABASE_TEST_URL to a migrated test database.";

const KEY_SECRET = "integration-key-secret";
const ROUNDS = 8;

let prisma: PrismaService;
const customerIds: string[] = [];
const originalFetch = globalThis.fetch;

// Stands in for Razorpay's HTTP API. Each call waits a little so concurrent
// requests overlap the way they would in production.
const razorpayCalls = { createOrder: 0, createRefund: 0 };

function fakeRazorpayFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status
      });

    if (url.endsWith("/v1/orders") && init?.method === "POST") {
      razorpayCalls.createOrder += 1;
      const body = JSON.parse(String(init.body)) as { amount: number; receipt: string };
      return json(200, {
        amount: body.amount,
        currency: "INR",
        id: `order_rzp_${randomUUID()}`,
        receipt: body.receipt,
        status: "created"
      });
    }

    if (/\/v1\/payments\/[^/]+\/refunds$/.test(url)) {
      return json(200, { count: 0, entity: "collection", items: [] });
    }

    if (/\/v1\/payments\/[^/]+\/refund$/.test(url) && init?.method === "POST") {
      razorpayCalls.createRefund += 1;
      const body = JSON.parse(String(init.body)) as { amount: number };
      const paymentId = url.split("/")[5] as string;
      return json(200, {
        amount: body.amount,
        id: `rfnd_${randomUUID()}`,
        payment_id: paymentId,
        status: "processed"
      });
    }

    return json(404, { error: { code: "NOT_FOUND" } });
  }) as typeof fetch;
}

function services() {
  const config = new ConfigService({
    razorpayKeyId: "rzp_test_integration",
    razorpayKeySecret: KEY_SECRET,
    razorpayRequestTimeoutMs: 5000,
    razorpayWebhookSecret: "integration-webhook-secret"
  });
  const payments = new PaymentsService(prisma, new RazorpayClient(config));
  const orders = new OrdersService(
    prisma,
    {} as unknown as WarehouseAccessService,
    undefined,
    undefined,
    payments
  );

  return { orders, payments };
}

async function createCustomer() {
  const customer = await prisma.user.create({
    data: {
      firstName: "Race",
      mobileNumber: `+91${Math.floor(6_000_000_000 + Math.random() * 3_999_999_999)}`
    }
  });
  customerIds.push(customer.id);
  return customer.id;
}

async function createOnlineOrder(
  userId: string,
  payment: { providerOrderId?: string | null; providerPaymentId?: string; status?: "PAID" | "PENDING" } = {},
  status: "CANCELLED" | "CREATED" = "CREATED"
) {
  const providerOrderId =
    payment.providerOrderId === undefined ? `order_rzp_${randomUUID()}` : payment.providerOrderId;
  const order = await prisma.order.create({
    data: {
      grandTotal: "283.20",
      orderNumber: `ORD-TEST-${randomUUID()}`,
      paymentStatus: payment.status ?? "PENDING",
      payments: {
        create: {
          amount: "283.20",
          method: "ONLINE",
          provider: providerOrderId ? "razorpay" : null,
          providerAmountPaise: providerOrderId ? 28320 : null,
          providerOrderId,
          providerPaymentId: payment.providerPaymentId,
          status: payment.status ?? "PENDING"
        }
      },
      status,
      subtotal: "240.00",
      userId
    },
    include: { payments: true }
  });

  return { order, payment: order.payments[0] as (typeof order.payments)[number] };
}

function signed(orderId: string, razorpayOrderId: string) {
  const razorpayPaymentId = `pay_${randomUUID()}`;

  return {
    orderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: createHmac("sha256", KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex")
  };
}

async function assertNoPaidCancelledOrderWithoutRefund(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    include: { payments: true, refunds: true },
    where: { id: orderId }
  });
  const payment = order.payments[0];

  if (order.status === "CANCELLED") {
    assert.ok(
      payment?.status !== "PAID" || order.refunds.length === 1,
      `order ${order.orderNumber} is cancelled and paid without a refund`
    );
  } else {
    assert.equal(order.status, "CONFIRMED");
    assert.equal(payment?.status, "PAID");
    assert.equal(order.refunds.length, 0);
  }
}

before(async () => {
  if (!databaseUrl) return;
  prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
  await prisma.$connect();
  globalThis.fetch = fakeRazorpayFetch();
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (!databaseUrl) return;
  const orders = { userId: { in: customerIds } };
  await prisma.refund.deleteMany({ where: { order: orders } });
  await prisma.payment.deleteMany({ where: { order: orders } });
  await prisma.orderStatusHistory.deleteMany({ where: { order: orders } });
  await prisma.order.deleteMany({ where: orders });
  await prisma.user.deleteMany({ where: { id: { in: customerIds } } });
  await prisma.$disconnect();
});

test("payment verification racing a customer cancellation never keeps money without a refund", { skip }, async () => {
  const { orders, payments } = services();
  const customerId = await createCustomer();

  for (let round = 0; round < ROUNDS; round += 1) {
    const { order, payment } = await createOnlineOrder(customerId);

    await Promise.allSettled([
      payments.verifyRazorpayPayment(
        customerId,
        signed(order.id, payment.providerOrderId as string)
      ),
      orders.cancelMyOrder(customerId, order.id, { reason: "Race test" })
    ]);

    await assertNoPaidCancelledOrderWithoutRefund(order.id);
  }
});

test("payment verification racing the unpaid order expiry never keeps money without a refund", { skip }, async () => {
  const { orders, payments } = services();
  const customerId = await createCustomer();

  for (let round = 0; round < ROUNDS; round += 1) {
    const { order, payment } = await createOnlineOrder(customerId);

    await Promise.allSettled([
      payments.verifyRazorpayPayment(
        customerId,
        signed(order.id, payment.providerOrderId as string)
      ),
      orders.expireUnpaidOrder(order.id, 30)
    ]);

    await assertNoPaidCancelledOrderWithoutRefund(order.id);
  }
});

test("tapping Pay several times at once attaches a single Razorpay order", { skip }, async () => {
  const { payments } = services();
  const customerId = await createCustomer();
  const { order, payment } = await createOnlineOrder(customerId, { providerOrderId: null });

  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      payments.createRazorpayOrder(customerId, { orderId: order.id })
    )
  );
  const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

  assert.ok(stored.providerOrderId);
  assert.deepEqual(
    new Set(results.map((result) => result.razorpay.orderId)),
    new Set([stored.providerOrderId])
  );
});

test("processing one refund from several places sends it to Razorpay once", { skip }, async () => {
  const { payments } = services();
  const customerId = await createCustomer();
  const { order, payment } = await createOnlineOrder(
    customerId,
    { providerPaymentId: `pay_${randomUUID()}`, status: "PAID" },
    "CANCELLED"
  );
  const refund = await prisma.refund.create({
    data: {
      amount: "283.20",
      orderId: order.id,
      paymentId: payment.id,
      reason: "Race test",
      status: "PENDING"
    }
  });
  const refundCallsBefore = razorpayCalls.createRefund;

  await Promise.allSettled(
    Array.from({ length: 5 }, () => payments.processRefund(refund.id))
  );
  const stored = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });

  assert.equal(razorpayCalls.createRefund - refundCallsBefore, 1);
  assert.equal(stored.status, "COMPLETED");
  assert.ok(stored.providerRefundId);
});
