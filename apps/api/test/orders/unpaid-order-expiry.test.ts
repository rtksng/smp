import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ORDER_MAINTENANCE_JOB_NAMES } from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import type { PrismaService } from "../../src/database/prisma.service";
import type { PaymentsService } from "../../src/modules/payments/payments.service";
import type { RazorpayClient } from "../../src/modules/payments/razorpay.client";
import {
  OrderMaintenanceProcessor,
  UNPAID_ORDER_EXPIRY_INTERVAL_MS
} from "../../src/modules/orders/order-maintenance.processor";
import type { OrdersService } from "../../src/modules/orders/orders.service";
import { UnpaidOrderExpiryService } from "../../src/modules/orders/unpaid-order-expiry.service";
import type { ApiQueueService } from "../../src/queues/api-queue.service";

const NOW = new Date("2026-10-17T10:00:00.000Z");

type Candidate = {
  createdAt: Date;
  id: string;
  orderNumber: string;
  payments: Array<{ providerOrderId: string | null }>;
};

function candidate(index: number, providerOrderId: string | null = null): Candidate {
  return {
    // One second apart, all well before the 30 minute cutoff.
    createdAt: new Date(NOW.getTime() - 3_600_000 + index * 1000),
    id: `order-${String(index).padStart(4, "0")}`,
    orderNumber: `ORD-${index}`,
    payments: [{ providerOrderId }]
  };
}

// Applies the keyset paging from the service's filter so skipped orders are
// not returned twice, like the real query.
function fakePrisma(candidates: Candidate[]) {
  const queries: Array<{ take: number; where: Record<string, unknown> }> = [];
  const prisma = {
    order: {
      findMany: async (args: { take: number; where: Record<string, unknown> }) => {
        queries.push(args);
        const keyset = (args.where.AND as Array<Record<string, unknown>>)[1] as {
          OR?: [{ createdAt: { gt: Date } }, { createdAt: Date; id: { gt: string } }];
        };
        const after = keyset.OR
          ? { createdAt: keyset.OR[0].createdAt.gt, id: keyset.OR[1].id.gt }
          : null;

        return candidates
          .filter(
            (entry) =>
              !after ||
              entry.createdAt > after.createdAt ||
              (entry.createdAt.getTime() === after.createdAt.getTime() && entry.id > after.id)
          )
          .slice(0, args.take);
      }
    }
  };

  return { prisma: prisma as unknown as PrismaService, queries };
}

function fakeRazorpay(statusesByOrder: Record<string, string[] | Error>) {
  return {
    fetchOrderPayments: async (razorpayOrderId: string) => {
      const statuses = statusesByOrder[razorpayOrderId] ?? [];

      if (statuses instanceof Error) {
        throw statuses;
      }

      return statuses.map((status, index) => ({ id: `pay_${index}`, status }));
    }
  } as unknown as RazorpayClient;
}

function fakeOrders(outcomes: Record<string, boolean | Error> = {}) {
  const expired: Array<{ orderId: string; timeoutMinutes: number }> = [];
  const orders = {
    expireUnpaidOrder: async (orderId: string, timeoutMinutes: number) => {
      const outcome = outcomes[orderId] ?? true;

      if (outcome instanceof Error) {
        throw outcome;
      }

      if (outcome) {
        expired.push({ orderId, timeoutMinutes });
      }

      return outcome;
    }
  };

  return { expired, orders: orders as unknown as OrdersService };
}

function config(values: Record<string, unknown> = {}) {
  return new ConfigService(values);
}

test("expires unpaid orders that never reached Razorpay or whose payments all failed", async () => {
  const { prisma } = fakePrisma([candidate(1), candidate(2, "order_rzp_2")]);
  const { expired, orders } = fakeOrders();
  const service = new UnpaidOrderExpiryService(
    prisma,
    orders,
    fakeRazorpay({ order_rzp_2: ["failed", "created"] }),
    config({ unpaidOrderTimeoutMinutes: 45 })
  );

  const result = await service.expireDueOrders(NOW);

  assert.deepEqual(expired, [
    { orderId: "order-0001", timeoutMinutes: 45 },
    { orderId: "order-0002", timeoutMinutes: 45 }
  ]);
  assert.equal(result.checked, 2);
  assert.equal(result.expired, 2);
});

test("keeps orders that Razorpay shows as captured, authorized or could not confirm", async () => {
  const { prisma } = fakePrisma([
    candidate(1, "order_rzp_captured"),
    candidate(2, "order_rzp_authorized"),
    candidate(3, "order_rzp_down")
  ]);
  const { expired, orders } = fakeOrders();
  const service = new UnpaidOrderExpiryService(
    prisma,
    orders,
    fakeRazorpay({
      order_rzp_authorized: ["failed", "authorized"],
      order_rzp_captured: ["captured"],
      order_rzp_down: new Error("Razorpay request timed out.")
    }),
    config()
  );

  const result = await service.expireDueOrders(NOW);

  assert.deepEqual(expired, []);
  assert.deepEqual(result.skipped, {
    authorized: 1,
    captured: 1,
    changed: 0,
    gatewayError: 1
  });
});

test("counts orders that changed meanwhile and keeps going after a failure", async () => {
  const { prisma } = fakePrisma([candidate(1), candidate(2), candidate(3), candidate(4)]);
  const { expired, orders } = fakeOrders({
    "order-0001": false,
    "order-0002": new ConflictException("Order status changed."),
    "order-0003": new Error("Reserved inventory is no longer consistent.")
  });
  const service = new UnpaidOrderExpiryService(prisma, orders, fakeRazorpay({}), config());

  const result = await service.expireDueOrders(NOW);

  assert.deepEqual(expired, [{ orderId: "order-0004", timeoutMinutes: 30 }]);
  assert.equal(result.skipped.changed, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.expired, 1);
});

test("pages past skipped orders instead of re-reading them", async () => {
  const candidates = Array.from({ length: 55 }, (_, index) =>
    candidate(index + 1, index < 50 ? `order_rzp_${index + 1}` : null)
  );
  const unreachable = Object.fromEntries(
    candidates.slice(0, 50).map((entry) => [
      entry.payments[0]?.providerOrderId as string,
      new Error("Razorpay unavailable")
    ])
  );
  const { prisma, queries } = fakePrisma(candidates);
  const { expired, orders } = fakeOrders();
  const service = new UnpaidOrderExpiryService(
    prisma,
    orders,
    fakeRazorpay(unreachable),
    config()
  );

  const result = await service.expireDueOrders(NOW);

  assert.equal(queries.length, 2);
  assert.equal(result.checked, 55);
  assert.equal(result.skipped.gatewayError, 50);
  assert.deepEqual(
    expired.map((entry) => entry.orderId),
    candidates.slice(50).map((entry) => entry.id)
  );
});

test("selects only old, unpaid, online, non-quote orders and caps one run", async () => {
  const candidates = Array.from({ length: 520 }, (_, index) => candidate(index + 1));
  const { prisma, queries } = fakePrisma(candidates);
  const { orders } = fakeOrders();
  const service = new UnpaidOrderExpiryService(prisma, orders, fakeRazorpay({}), config());

  const result = await service.expireDueOrders(NOW);

  assert.equal(result.checked, 500);
  const where = queries[0]?.where as Record<string, unknown>;
  assert.deepEqual(where.createdAt, { lte: new Date("2026-10-17T09:30:00.000Z") });
  assert.equal(where.status, "CREATED");
  assert.deepEqual(where.paymentStatus, { in: ["PENDING", "FAILED"] });
  assert.deepEqual(where.payments, { some: { method: "ONLINE" } });
  assert.deepEqual((where.AND as unknown[])[0], {
    OR: [
      { checkoutIdempotencyKey: null },
      { NOT: { checkoutIdempotencyKey: { startsWith: "quote:" } } }
    ]
  });
});

function processor(options: {
  enabled?: boolean;
  payments?: Partial<Record<keyof PaymentsService, unknown>>;
  queues?: Partial<Record<keyof ApiQueueService, unknown>>;
  runs?: unknown[];
}) {
  const expiry = {
    expireDueOrders: async () => {
      options.runs?.push("run");
      return { checked: 0, expired: 0, failed: 0, skipped: {} };
    }
  };

  return new OrderMaintenanceProcessor(
    expiry as unknown as UnpaidOrderExpiryService,
    (options.queues ?? {}) as unknown as ApiQueueService,
    (options.payments ?? {}) as unknown as PaymentsService,
    config({ unpaidOrderExpiryEnabled: options.enabled ?? true })
  );
}

function maintenanceJob(name: string, data: Record<string, unknown> = {}) {
  return { data, id: "job-1", name } as unknown as Job<
    Record<string, never>,
    void,
    typeof ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders
  >;
}

test("processor schedules expiry every five minutes, or removes the schedule when disabled", async () => {
  const calls: unknown[] = [];
  const queues = {
    removeUnpaidOrderExpirySchedule: async () => {
      calls.push("remove");
    },
    scheduleUnpaidOrderExpiry: async (everyMs: number) => {
      calls.push(everyMs);
    }
  };

  await processor({ queues }).onApplicationBootstrap();
  await processor({ enabled: false, queues }).onApplicationBootstrap();
  await processor({
    queues: {
      scheduleUnpaidOrderExpiry: async () => {
        throw new Error("Redis unavailable");
      }
    }
  }).onApplicationBootstrap();

  assert.deepEqual(calls, [UNPAID_ORDER_EXPIRY_INTERVAL_MS, "remove"]);
  assert.equal(UNPAID_ORDER_EXPIRY_INTERVAL_MS, 300_000);
});

test("processor runs expiry for its job, skips it when disabled, and rejects unknown jobs", async () => {
  const runs: unknown[] = [];

  await processor({ runs }).process(maintenanceJob(ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders));
  await processor({ enabled: false, runs }).process(
    maintenanceJob(ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders)
  );
  await assert.rejects(
    () => processor({ runs }).process(maintenanceJob("unknown-job")),
    UnrecoverableError
  );

  assert.equal(runs.length, 1);
});

test("processor sends queued refunds to the payments service", async () => {
  const refunded: string[] = [];
  const payments = {
    processRefund: async (refundId: string) => {
      refunded.push(refundId);
      return { status: "COMPLETED" };
    }
  };

  await processor({ payments }).process(
    maintenanceJob(ORDER_MAINTENANCE_JOB_NAMES.processRefund, { refundId: "refund-1" })
  );
  await assert.rejects(
    () => processor({ payments }).process(maintenanceJob(ORDER_MAINTENANCE_JOB_NAMES.processRefund)),
    UnrecoverableError
  );

  assert.deepEqual(refunded, ["refund-1"]);
});
