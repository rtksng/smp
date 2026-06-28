import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  NOTIFICATION_JOB_NAMES,
  type NotificationJobName,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import { NotificationLogRepository } from "../notifications/notification-log.repository";
import {
  assertJobName,
  logJobCompleted,
  logJobFailed,
  requireIsoDateString,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "./job-processing";
import { StructuredLogger } from "../structured-logger.service";

@Processor(QUEUE_NAMES.notifications)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly notificationLogs: NotificationLogRepository,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(
    job: Job<SendOrderConfirmationJobData, void, NotificationJobName>
  ) {
    const startedAtMs = Date.now();

    try {
      assertJobName(
        job,
        NOTIFICATION_JOB_NAMES.sendOrderConfirmation,
        "notification"
      );
      const data = validateSendOrderConfirmationJobData(job.data);

      await this.notificationLogs.createOrderConfirmation(data);
      logJobCompleted(
        this.logger,
        NotificationsProcessor.name,
        QUEUE_NAMES.notifications,
        job,
        "notification.persisted",
        startedAtMs,
        {
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          templateKey: "order_confirmation"
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        NotificationsProcessor.name,
        QUEUE_NAMES.notifications,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateSendOrderConfirmationJobData(
  value: unknown
): SendOrderConfirmationJobData {
  const data = requireRecordPayload(value, "notification job");
  requireVersionOne(data);

  return {
    customerId: requireString(data, "customerId"),
    orderId: requireString(data, "orderId"),
    orderNumber: requireString(data, "orderNumber"),
    requestedAt: requireIsoDateString(data, "requestedAt"),
    version: 1
  };
}
