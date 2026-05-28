import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  NOTIFICATION_JOB_NAMES,
  type NotificationJobName,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import type { Job } from "bullmq";

@Processor(QUEUE_NAMES.notifications)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(
    job: Job<SendOrderConfirmationJobData, void, NotificationJobName>
  ) {
    if (job.name !== NOTIFICATION_JOB_NAMES.sendOrderConfirmation) {
      throw new Error(`Unsupported notification job: ${job.name}`);
    }

    this.logger.log(
      `Mock order confirmation for order ${job.data.orderNumber} and customer ${job.data.customerId}`
    );
  }
}
