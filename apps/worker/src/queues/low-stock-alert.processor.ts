import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  LOW_STOCK_ALERT_JOB_NAMES,
  type LowStockAlertJobName,
  type SendLowStockAlertJobData
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

@Processor(QUEUE_NAMES.lowStockAlert)
export class LowStockAlertProcessor extends WorkerHost {
  constructor(
    private readonly notificationLogs: NotificationLogRepository,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(
    job: Job<SendLowStockAlertJobData, void, LowStockAlertJobName>
  ) {
    const startedAtMs = Date.now();

    try {
      assertJobName(
        job,
        LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert,
        "low stock alert"
      );
      const data = validateSendLowStockAlertJobData(job.data);

      await this.notificationLogs.createLowStockAlert(data);
      logJobCompleted(
        this.logger,
        LowStockAlertProcessor.name,
        QUEUE_NAMES.lowStockAlert,
        job,
        "lowStockAlert.persisted",
        startedAtMs,
        {
          availableQuantity: data.availableQuantity,
          productId: data.productId,
          reorderLevel: data.reorderLevel,
          variantId: data.variantId,
          warehouseId: data.warehouseId
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        LowStockAlertProcessor.name,
        QUEUE_NAMES.lowStockAlert,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateSendLowStockAlertJobData(
  value: unknown
): SendLowStockAlertJobData {
  const data = requireRecordPayload(value, "low stock alert job");
  requireVersionOne(data);

  return {
    availableQuantity: requireNonNegativeNumber(data, "availableQuantity"),
    productId: requireString(data, "productId"),
    reorderLevel: requireNonNegativeNumber(data, "reorderLevel"),
    requestedAt: requireIsoDateString(data, "requestedAt"),
    variantId: requireOptionalString(data, "variantId"),
    version: 1,
    warehouseId: requireString(data, "warehouseId")
  };
}
