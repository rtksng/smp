import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma
} from "../../generated/prisma/client";
import { RazorpayClient } from "../payments/razorpay.client";
import { OrdersService } from "./orders.service";

const BATCH_SIZE = 50;
// Bounds one run; anything left is picked up five minutes later.
const MAX_ORDERS_PER_RUN = 500;

export type UnpaidOrderExpiryResult = {
  checked: number;
  expired: number;
  failed: number;
  skipped: {
    // Razorpay holds an authorized payment that may still be captured.
    authorized: number;
    // Paid at Razorpay but not recorded here; needs reconciliation.
    captured: number;
    // Paid, cancelled or changed by someone else while this run was working.
    changed: number;
    // Razorpay could not be asked, so the order is retried next run.
    gatewayError: number;
  };
};

type ExpiryCandidate = {
  createdAt: Date;
  id: string;
  orderNumber: string;
  payments: Array<{ providerOrderId: string | null }>;
};

@Injectable()
export class UnpaidOrderExpiryService {
  private readonly logger = new Logger(UnpaidOrderExpiryService.name);
  readonly timeoutMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly razorpay: RazorpayClient,
    configService: ConfigService
  ) {
    this.timeoutMinutes = configService.get<number>("unpaidOrderTimeoutMinutes", 30);
  }

  async expireDueOrders(now = new Date()): Promise<UnpaidOrderExpiryResult> {
    const cutoff = new Date(now.getTime() - this.timeoutMinutes * 60_000);
    const result: UnpaidOrderExpiryResult = {
      checked: 0,
      expired: 0,
      failed: 0,
      skipped: { authorized: 0, captured: 0, changed: 0, gatewayError: 0 }
    };
    let after: Pick<ExpiryCandidate, "createdAt" | "id"> | null = null;

    while (result.checked < MAX_ORDERS_PER_RUN) {
      const candidates: ExpiryCandidate[] = await this.prisma.order.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          createdAt: true,
          id: true,
          orderNumber: true,
          payments: { select: { providerOrderId: true } }
        },
        take: Math.min(BATCH_SIZE, MAX_ORDERS_PER_RUN - result.checked),
        where: candidateFilter(cutoff, after)
      });

      for (const candidate of candidates) {
        result.checked += 1;
        await this.expireCandidate(candidate, result);
      }

      if (candidates.length < BATCH_SIZE) {
        break;
      }

      // Skipped orders still match the filter, so page past them.
      const last = candidates[candidates.length - 1] as ExpiryCandidate;
      after = { createdAt: last.createdAt, id: last.id };
    }

    return result;
  }

  private async expireCandidate(candidate: ExpiryCandidate, result: UnpaidOrderExpiryResult) {
    const providerOrderIds = candidate.payments
      .map((payment) => payment.providerOrderId)
      .filter((id): id is string => Boolean(id));

    // Without a Razorpay order the customer never reached the payment step.
    if (providerOrderIds.length > 0) {
      let statuses: string[];

      try {
        const payments = await Promise.all(
          providerOrderIds.map((id) => this.razorpay.fetchOrderPayments(id))
        );
        statuses = payments.flat().map((payment) => payment.status);
      } catch (error) {
        result.skipped.gatewayError += 1;
        this.logger.warn(
          `Kept unpaid order ${candidate.orderNumber}: Razorpay status check failed (${errorMessage(error)}).`
        );
        return;
      }

      if (statuses.includes("captured")) {
        result.skipped.captured += 1;
        this.logger.error(
          `Order ${candidate.orderNumber} is unpaid here but has a captured Razorpay payment; it needs reconciliation.`
        );
        return;
      }

      if (statuses.includes("authorized")) {
        result.skipped.authorized += 1;
        return;
      }
    }

    try {
      if (await this.orders.expireUnpaidOrder(candidate.id, this.timeoutMinutes)) {
        result.expired += 1;
      } else {
        result.skipped.changed += 1;
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        result.skipped.changed += 1;
        return;
      }

      result.failed += 1;
      this.logger.error(
        `Could not expire unpaid order ${candidate.orderNumber}: ${errorMessage(error)}`
      );
    }
  }
}

function candidateFilter(
  cutoff: Date,
  after: Pick<ExpiryCandidate, "createdAt" | "id"> | null
): Prisma.OrderWhereInput {
  return {
    AND: [
      // Quote orders reuse the key quote:<id>; expiring one would stop the
      // customer from ordering that quote again, so they stay with admins.
      {
        OR: [
          { checkoutIdempotencyKey: null },
          { NOT: { checkoutIdempotencyKey: { startsWith: "quote:" } } }
        ]
      },
      after
        ? {
            OR: [
              { createdAt: { gt: after.createdAt } },
              { createdAt: after.createdAt, id: { gt: after.id } }
            ]
          }
        : {}
    ],
    createdAt: { lte: cutoff },
    deletedAt: null,
    paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
    payments: { some: { method: PaymentMethod.ONLINE } },
    status: OrderStatus.CREATED
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
