import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  PAYMENT_WEBHOOK_JOB_NAMES,
  type PaymentWebhookJobName,
  type ProcessPaymentWebhookJobData
} from "@surgical/types";
import type { Job } from "bullmq";

@Processor(QUEUE_NAMES.paymentWebhook)
export class PaymentWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentWebhookProcessor.name);

  async process(
    job: Job<ProcessPaymentWebhookJobData, void, PaymentWebhookJobName>
  ) {
    if (job.name !== PAYMENT_WEBHOOK_JOB_NAMES.processRazorpayWebhook) {
      throw new Error(`Unsupported payment webhook job: ${job.name}`);
    }

    this.logger.log(
      `Processed ${job.data.provider} webhook ${job.data.providerEventId ?? "without-event-id"} (${job.data.rawBodyBase64.length} base64 chars)`
    );
  }
}
