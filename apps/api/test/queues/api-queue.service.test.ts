import assert from "node:assert/strict";
import { test } from "node:test";
import { OTP_JOB_NAMES, type SendOtpJobData } from "@surgical/types";
import type { JobsOptions } from "bullmq";
import { ApiQueueService } from "../../src/queues/api-queue.service";

class RecordingQueue {
  readonly jobs: Array<{ data: unknown; name: string; options?: JobsOptions }> = [];

  async add(name: string, data: unknown, options?: JobsOptions) {
    this.jobs.push({ data, name, options });
  }
}

test("enqueueOtp removes OTP jobs from Redis as soon as they finish or fail", async () => {
  const otpQueue = new RecordingQueue();
  const otherQueue = new RecordingQueue();
  const service = new (ApiQueueService as unknown as new (
    ...queues: RecordingQueue[]
  ) => ApiQueueService)(
    otpQueue,
    otherQueue,
    otherQueue,
    otherQueue,
    otherQueue,
    otherQueue,
    otherQueue
  );
  const data: SendOtpJobData = {
    mobileNumber: "+919876543210",
    otp: "123456",
    purpose: "customer",
    requestedAt: "2026-10-17T06:30:00.000Z",
    version: 1
  };

  await service.enqueueOtp(data);

  assert.equal(otpQueue.jobs.length, 1);
  assert.equal(otpQueue.jobs[0]?.name, OTP_JOB_NAMES.sendOtp);
  assert.deepEqual(otpQueue.jobs[0]?.data, data);
  assert.equal(otpQueue.jobs[0]?.options?.removeOnComplete, true);
  assert.equal(otpQueue.jobs[0]?.options?.removeOnFail, true);
  assert.equal(otpQueue.jobs[0]?.options?.attempts, 3);
  assert.equal(otherQueue.jobs.length, 0);
});
