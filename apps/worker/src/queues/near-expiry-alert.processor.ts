import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  type NearExpiryAlertJobName,
  type SendNearExpiryAlertJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import { NotificationLogRepository } from "../notifications/notification-log.repository";

@Processor(QUEUE_NAMES.nearExpiryAlert)
export class NearExpiryAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(NearExpiryAlertProcessor.name);

  constructor(private readonly notificationLogs: NotificationLogRepository) {
    super();
  }

  async process(
    job: Job<SendNearExpiryAlertJobData, void, NearExpiryAlertJobName>
  ) {
    if (job.name !== NEAR_EXPIRY_ALERT_JOB_NAMES.sendNearExpiryAlert) {
      throw new Error(`Unsupported near expiry alert job: ${job.name}`);
    }

    await this.notificationLogs.createNearExpiryAlert(job.data);
    this.logger.log(
      `Persisted near expiry alert for batch ${job.data.batchNumber} at warehouse ${job.data.warehouseId}: expires ${job.data.expiryDate}`
    );
  }
}
