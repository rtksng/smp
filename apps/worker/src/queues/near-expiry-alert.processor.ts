import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  type NearExpiryAlertJobName,
  type SendNearExpiryAlertJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import { NotificationLogRepository } from "../notifications/notification-log.repository";
import {
  assertJobName,
  logJobCompleted,
  logJobFailed,
  requireIsoDateString,
  requireNonNegativeNumber,
  requireOptionalString,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "./job-processing";
import { StructuredLogger } from "../structured-logger.service";

@Processor(QUEUE_NAMES.nearExpiryAlert)
export class NearExpiryAlertProcessor extends WorkerHost {
  constructor(
    private readonly notificationLogs: NotificationLogRepository,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(
    job: Job<SendNearExpiryAlertJobData, void, NearExpiryAlertJobName>
  ) {
    const startedAtMs = Date.now();

    try {
      assertJobName(
        job,
        NEAR_EXPIRY_ALERT_JOB_NAMES.sendNearExpiryAlert,
        "near expiry alert"
      );
      const data = validateSendNearExpiryAlertJobData(job.data);

      await this.notificationLogs.createNearExpiryAlert(data);
      logJobCompleted(
        this.logger,
        NearExpiryAlertProcessor.name,
        QUEUE_NAMES.nearExpiryAlert,
        job,
        "nearExpiryAlert.persisted",
        startedAtMs,
        {
          batchId: data.batchId,
          productId: data.productId,
          quantity: data.quantity,
          variantId: data.variantId,
          warehouseId: data.warehouseId
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        NearExpiryAlertProcessor.name,
        QUEUE_NAMES.nearExpiryAlert,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateSendNearExpiryAlertJobData(
  value: unknown
): SendNearExpiryAlertJobData {
  const data = requireRecordPayload(value, "near expiry alert job");
  requireVersionOne(data);

  return {
    batchId: requireString(data, "batchId"),
    batchNumber: requireString(data, "batchNumber"),
    expiryDate: requireIsoDateString(data, "expiryDate"),
    productId: requireString(data, "productId"),
    quantity: requireNonNegativeNumber(data, "quantity"),
    requestedAt: requireIsoDateString(data, "requestedAt"),
    variantId: requireOptionalString(data, "variantId"),
    version: 1,
    warehouseId: requireString(data, "warehouseId")
  };
}
