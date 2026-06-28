import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  PAYMENT_WEBHOOK_JOB_NAMES,
  type PaymentWebhookJobName,
  type ProcessPaymentWebhookJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import {
  assertJobName,
  logJobCompleted,
  logJobFailed,
  requireBase64String,
  requireIsoDateString,
  requireOptionalString,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "./job-processing";
import { StructuredLogger } from "../structured-logger.service";

export type PaymentWebhookProcessingResult = {
  duplicate: boolean;
  processed: boolean;
  received: boolean;
};

export abstract class PaymentWebhookRepository {
  abstract processRazorpayWebhook(
    data: ProcessPaymentWebhookJobData
  ): Promise<PaymentWebhookProcessingResult>;
}

@Injectable()
export class LoggingPaymentWebhookRepository extends PaymentWebhookRepository {
  async processRazorpayWebhook(): Promise<PaymentWebhookProcessingResult> {
    return {
      duplicate: false,
      processed: false,
      received: true
    };
  }
}

@Processor(QUEUE_NAMES.paymentWebhook)
export class PaymentWebhookProcessor extends WorkerHost {
  constructor(
    private readonly paymentWebhooks: PaymentWebhookRepository,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(
    job: Job<ProcessPaymentWebhookJobData, void, PaymentWebhookJobName>
  ) {
    const startedAtMs = Date.now();

    try {
      assertJobName(
        job,
        PAYMENT_WEBHOOK_JOB_NAMES.processRazorpayWebhook,
        "payment webhook"
      );
      const data = validateProcessPaymentWebhookJobData(job.data);
      const result = await this.paymentWebhooks.processRazorpayWebhook(data);

      logJobCompleted(
        this.logger,
        PaymentWebhookProcessor.name,
        QUEUE_NAMES.paymentWebhook,
        job,
        "paymentWebhook.processed",
        startedAtMs,
        {
          duplicate: result.duplicate,
          processed: result.processed,
          provider: data.provider,
          providerEventId: data.providerEventId,
          rawBodyBytes: Buffer.from(data.rawBodyBase64, "base64").length,
          received: result.received,
          webhookId: data.webhookId
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        PaymentWebhookProcessor.name,
        QUEUE_NAMES.paymentWebhook,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateProcessPaymentWebhookJobData(
  value: unknown
): ProcessPaymentWebhookJobData {
  const data = requireRecordPayload(value, "payment webhook job");
  requireVersionOne(data);

  return {
    payload: data.payload,
    provider: requireString(data, "provider") === "razorpay" ? "razorpay" : failProvider(),
    providerEventId: requireOptionalString(data, "providerEventId"),
    rawBodyBase64: requireBase64String(data, "rawBodyBase64"),
    receivedAt: requireIsoDateString(data, "receivedAt"),
    signature: requireString(data, "signature"),
    version: 1,
    webhookId: requireString(data, "webhookId")
  };
}

function failProvider(): never {
  throw new Error("provider must be razorpay");
}
