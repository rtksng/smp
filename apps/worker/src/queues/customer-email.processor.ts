import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  CUSTOMER_EMAIL_JOB_NAMES,
  type CustomerEmailJobName,
  type SendCustomerEmailJobData
} from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import { CustomerEmailService } from "../email/customer-email.service";
import { validateSendCustomerEmailJobData } from "../email/customer/job-validation";
import { assertJobName, logJobCompleted, logJobFailed } from "./job-processing";
import { StructuredLogger } from "../structured-logger.service";

// Stay under Resend's default per-team API rate limit.
@Processor(QUEUE_NAMES.customerEmail, { limiter: { duration: 1000, max: 2 } })
export class CustomerEmailProcessor extends WorkerHost {
  constructor(
    private readonly customerEmails: CustomerEmailService,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(job: Job<SendCustomerEmailJobData, void, CustomerEmailJobName>) {
    const startedAtMs = Date.now();

    try {
      let data: SendCustomerEmailJobData;

      try {
        assertJobName(job, CUSTOMER_EMAIL_JOB_NAMES.sendCustomerEmail, "customer email");
        data = validateSendCustomerEmailJobData(job.data);
      } catch (error) {
        // A malformed payload cannot succeed on retry.
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
      }

      const result = await this.customerEmails.send(data);

      logJobCompleted(
        this.logger,
        CustomerEmailProcessor.name,
        QUEUE_NAMES.customerEmail,
        job,
        result.status === "sent" ? "customer-email.sent" : "customer-email.skipped",
        startedAtMs,
        {
          dedupeKey: data.dedupeKey,
          emailId: result.status === "sent" ? result.emailId : undefined,
          reason: result.status === "skipped" ? result.reason : undefined,
          template: data.event.template
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        CustomerEmailProcessor.name,
        QUEUE_NAMES.customerEmail,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}
