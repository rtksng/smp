import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  OTP_JOB_NAMES,
  type OtpJobName,
  type SendOtpJobData
} from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import {
  assertJobName,
  logJobCompleted,
  logJobFailed,
  redactMobileNumber,
  requireIsoDateString,
  requireOneOf,
  requireRecordPayload,
  requireString,
  requireVersionOne
} from "./job-processing";
import { OtpDeliveryService } from "../otp/otp-delivery.service";
import { StructuredLogger } from "../structured-logger.service";

// Each send waits on the WhatsApp API; one job at a time would hold users
// waiting for their login code behind each other.
@Processor(QUEUE_NAMES.otp, { concurrency: 10 })
export class OtpProcessor extends WorkerHost {
  constructor(
    private readonly otpDelivery: OtpDeliveryService,
    private readonly logger: StructuredLogger = new StructuredLogger()
  ) {
    super();
  }

  async process(job: Job<SendOtpJobData, void, OtpJobName>) {
    const startedAtMs = Date.now();

    try {
      let data: SendOtpJobData;

      try {
        assertJobName(job, OTP_JOB_NAMES.sendOtp, "OTP");
        data = validateSendOtpJobData(job.data);
      } catch (error) {
        // A malformed payload cannot succeed on retry.
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
      }

      const result = await this.otpDelivery.send(data);

      logJobCompleted(
        this.logger,
        OtpProcessor.name,
        QUEUE_NAMES.otp,
        job,
        result.status === "sent" ? "otp.sent" : "otp.skipped",
        startedAtMs,
        {
          messageId: result.status === "sent" ? result.messageId : undefined,
          mobileNumber: redactMobileNumber(data.mobileNumber),
          purpose: data.purpose,
          reason: result.status === "skipped" ? result.reason : undefined
        }
      );
    } catch (error) {
      logJobFailed(
        this.logger,
        OtpProcessor.name,
        QUEUE_NAMES.otp,
        job,
        startedAtMs,
        error
      );
      throw error;
    }
  }
}

function validateSendOtpJobData(value: unknown): SendOtpJobData {
  const data = requireRecordPayload(value, "OTP job");
  requireVersionOne(data);

  return {
    mobileNumber: requireString(data, "mobileNumber"),
    otp: requireString(data, "otp"),
    purpose: requireOneOf(data, "purpose", [
      "customer",
      "delivery_partner"
    ] as const),
    requestedAt: requireIsoDateString(data, "requestedAt"),
    version: 1
  };
}
