import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ORDER_MAINTENANCE_JOB_NAMES,
  OTP_JOB_NAMES,
  type SendOtpJobData
} from "@surgical/types";
import type { JobsOptions } from "bullmq";
import { ApiQueueService } from "../../src/queues/api-queue.service";

class RecordingQueue {
  readonly jobs: Array<{ data: unknown; name: string; options?: JobsOptions }> = [];
  readonly schedulers: unknown[] = [];

  async add(name: string, data: unknown, options?: JobsOptions) {
    this.jobs.push({ data, name, options });
  }

  async upsertJobScheduler(id: string, repeat: unknown, template: unknown) {
    this.schedulers.push({ id, repeat, template });
  }

  async removeJobScheduler(id: string) {
    this.schedulers.push({ removed: id });
  }
}

function queueService() {
  const otpQueue = new RecordingQueue();
  const orderMaintenanceQueue = new RecordingQueue();
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
    otherQueue,
    orderMaintenanceQueue
  );

  return { orderMaintenanceQueue, otherQueue, otpQueue, service };
}

test("enqueueOtp removes OTP jobs from Redis as soon as they finish or fail", async () => {
  const { otherQueue, otpQueue, service } = queueService();
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

test("unpaid order expiry uses one named schedule that replicas can upsert or remove", async () => {
  const { orderMaintenanceQueue, service } = queueService();

  await service.scheduleUnpaidOrderExpiry(300_000);
  await service.scheduleUnpaidOrderExpiry(300_000);
  await service.removeUnpaidOrderExpirySchedule();

  const expected = {
    id: "expire-unpaid-orders",
    repeat: { every: 300_000 },
    template: {
      data: {},
      name: ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders,
      opts: { removeOnComplete: 100, removeOnFail: 500 }
    }
  };
  assert.deepEqual(orderMaintenanceQueue.schedulers, [
    expected,
    expected,
    { removed: "expire-unpaid-orders" }
  ]);
});

test("enqueueRefundProcessing queues one retried job per refund", async () => {
  const { orderMaintenanceQueue, service } = queueService();

  await service.enqueueRefundProcessing("refund-1");

  assert.equal(orderMaintenanceQueue.jobs.length, 1);
  assert.equal(orderMaintenanceQueue.jobs[0]?.name, ORDER_MAINTENANCE_JOB_NAMES.processRefund);
  assert.equal(
    (orderMaintenanceQueue.jobs[0]?.data as { refundId: string }).refundId,
    "refund-1"
  );
  assert.equal(orderMaintenanceQueue.jobs[0]?.options?.jobId, "refund-refund-1");
  assert.equal(orderMaintenanceQueue.jobs[0]?.options?.attempts, 5);
});
