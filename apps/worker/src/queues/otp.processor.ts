import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  OTP_JOB_NAMES,
  type OtpJobName,
  type SendOtpJobData
} from "@surgical/types";
import type { Job } from "bullmq";

@Processor(QUEUE_NAMES.otp)
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);

  async process(job: Job<SendOtpJobData, void, OtpJobName>) {
    if (job.name !== OTP_JOB_NAMES.sendOtp) {
      throw new Error(`Unsupported OTP job: ${job.name}`);
    }

    this.logger.log(
      `Mock OTP for ${job.data.purpose} ${job.data.mobileNumber}: ${job.data.otp}`
    );
  }
}
