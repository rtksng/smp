import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  INVOICE_JOB_NAMES,
  type GenerateGstInvoiceJobData,
  type InvoiceJobName
} from "@surgical/types";
import type { Job } from "bullmq";
import {
  logJobCompleted,
  logJobFailed,
  requireIsoDateString,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "./job-processing";
import { StructuredLogger } from "../structured-logger.service";

@Processor(QUEUE_NAMES.invoice)
export class InvoicesProcessor extends WorkerHost {
  constructor(private readonly logger: StructuredLogger = new StructuredLogger()) {
    super();
  }

  async process(job: Job<GenerateGstInvoiceJobData, void, InvoiceJobName>) {
    const startedAtMs = Date.now();

    try {
      if (
        job.name !== INVOICE_JOB_NAMES.generateInvoice &&
        job.name !== INVOICE_JOB_NAMES.generateGstInvoice
      ) {
        throw new Error(`Unsupported invoice job: ${job.name}`);
      }

      const data = validateGenerateGstInvoiceJobData(job.data);

      logJobCompleted(
        this.logger,
        InvoicesProcessor.name,
        QUEUE_NAMES.invoice,
        job,
        "invoice.queued",
        startedAtMs,
        {
          orderId: data.orderId
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        InvoicesProcessor.name,
        QUEUE_NAMES.invoice,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateGenerateGstInvoiceJobData(
  value: unknown
): GenerateGstInvoiceJobData {
  const data = requireRecordPayload(value, "invoice job");
  requireVersionOne(data);

  return {
    orderId: requireString(data, "orderId"),
    requestedAt: requireIsoDateString(data, "requestedAt"),
    version: 1
  };
}
