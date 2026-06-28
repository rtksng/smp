import { Processor, WorkerHost } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@surgical/config";
import {
  OTP_JOB_NAMES,
  type OtpJobName,
  type SendOtpJobData
} from "@surgical/types";
import type { Job } from "bullmq";
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
import { StructuredLogger } from "../structured-logger.service";

@Processor(QUEUE_NAMES.otp)
export class OtpProcessor extends WorkerHost {
  constructor(private readonly logger: StructuredLogger = new StructuredLogger()) {
    super();
  }

  async process(job: Job<SendOtpJobData, void, OtpJobName>) {
    const startedAtMs = Date.now();

    try {
      assertJobName(job, OTP_JOB_NAMES.sendOtp, "OTP");
      const data = validateSendOtpJobData(job.data);

      logJobCompleted(
        this.logger,
        OtpProcessor.name,
        QUEUE_NAMES.otp,
        job,
        "otp.sent",
        startedAtMs,
        {
          mobileNumber: redactMobileNumber(data.mobileNumber),
          purpose: data.purpose
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
