import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  INVOICE_JOB_NAMES,
  type GenerateGstInvoiceJobData,
  type InvoiceJobName
} from "@surgical/types";
import type { Job } from "bullmq";

@Processor(QUEUE_NAMES.invoice)
export class InvoicesProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoicesProcessor.name);

  async process(job: Job<GenerateGstInvoiceJobData, void, InvoiceJobName>) {
    if (
      job.name !== INVOICE_JOB_NAMES.generateInvoice &&
      job.name !== INVOICE_JOB_NAMES.generateGstInvoice
    ) {
      throw new Error(`Unsupported invoice job: ${job.name}`);
    }

    this.logger.log(`Mock invoice generation queued for order ${job.data.orderId}`);
  }
}
