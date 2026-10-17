import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "@surgical/config";
import {
  ORDER_MAINTENANCE_JOB_NAMES,
  type OrderMaintenanceJobName,
  type ProcessRefundJobData
} from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import { ApiQueueService } from "../../queues/api-queue.service";
import { PaymentsService } from "../payments/payments.service";
import { UnpaidOrderExpiryService } from "./unpaid-order-expiry.service";

export const UNPAID_ORDER_EXPIRY_INTERVAL_MS = 5 * 60_000;

// Runs in the API rather than the worker because it reuses the order
// cancellation logic that releases stock and holds the Razorpay keys for
// refunds. Every API replica runs this worker; BullMQ hands each job to only
// one of them.
@Processor(QUEUE_NAMES.orderMaintenance)
export class OrderMaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderMaintenanceProcessor.name);
  private readonly expiryEnabled: boolean;

  constructor(
    private readonly unpaidOrderExpiry: UnpaidOrderExpiryService,
    private readonly queues: ApiQueueService,
    private readonly payments: PaymentsService,
    configService: ConfigService
  ) {
    super();
    this.expiryEnabled = configService.get<boolean>("unpaidOrderExpiryEnabled", true);
  }

  async onApplicationBootstrap() {
    try {
      if (this.expiryEnabled) {
        await this.queues.scheduleUnpaidOrderExpiry(UNPAID_ORDER_EXPIRY_INTERVAL_MS);
      } else {
        await this.queues.removeUnpaidOrderExpirySchedule();
      }
    } catch (error) {
      // Redis may be briefly unavailable at startup; the API still serves
      // traffic and the next deploy or restart schedules the job.
      this.logger.error(
        `Unpaid order expiry schedule was not updated: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async process(
    job: Job<ProcessRefundJobData | Record<string, never>, void, OrderMaintenanceJobName>
  ) {
    if (job.name === ORDER_MAINTENANCE_JOB_NAMES.processRefund) {
      const refundId = (job.data as Partial<ProcessRefundJobData>).refundId;

      if (typeof refundId !== "string" || refundId.length === 0) {
        throw new UnrecoverableError("Refund job is missing its refund id.");
      }

      const refund = await this.payments.processRefund(refundId);
      this.logger.log({ event: "refunds.processed", refundId, status: refund.status });
      return;
    }

    if (job.name !== ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders) {
      throw new UnrecoverableError(`Unsupported order maintenance job: ${job.name}`);
    }

    if (!this.expiryEnabled) {
      return;
    }

    const result = await this.unpaidOrderExpiry.expireDueOrders();

    this.logger.log({ event: "orders.unpaid_expiry", ...result });
  }
}
