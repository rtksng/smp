import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  LOW_STOCK_ALERT_JOB_NAMES,
  type LowStockAlertJobName,
  type SendLowStockAlertJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import { NotificationLogRepository } from "../notifications/notification-log.repository";

@Processor(QUEUE_NAMES.lowStockAlert)
export class LowStockAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(LowStockAlertProcessor.name);

  constructor(private readonly notificationLogs: NotificationLogRepository) {
    super();
  }

  async process(
    job: Job<SendLowStockAlertJobData, void, LowStockAlertJobName>
  ) {
    if (job.name !== LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert) {
      throw new Error(`Unsupported low stock alert job: ${job.name}`);
    }

    await this.notificationLogs.createLowStockAlert(job.data);
    this.logger.log(
      `Persisted low stock alert for product ${job.data.productId} at warehouse ${job.data.warehouseId}: ${job.data.availableQuantity}/${job.data.reorderLevel}`
    );
  }
}
