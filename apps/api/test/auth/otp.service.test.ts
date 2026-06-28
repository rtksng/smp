import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OtpPurpose,
  OtpService,
  type OtpServiceOptions
} from "../../src/modules/auth/common/otp.service";

type CacheEntry = {
  expiresAt: number;
  value: string;
};

class InMemoryOtpCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly now: () => number) {}

  async get(key: string) {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.entries.set(key, {
      expiresAt: this.now() + ttlSeconds * 1000,
      value
    });
  }

  async delete(key: string) {
    this.entries.delete(key);
  }

  async increment(key: string, ttlSeconds: number) {
    const current = Number((await this.get(key)) ?? "0") + 1;
    await this.set(key, String(current), ttlSeconds);
    return current;
  }
}

class FakeOtpQueue {
  readonly otpJobs: unknown[] = [];

  async enqueueOtp(data: unknown) {
    this.otpJobs.push(data);
  }
}

test("requestOtp stores an OTP and blocks immediate resend during cooldown", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const cache = new InMemoryOtpCache(() => Date.now());
  const service = new OtpService(cache, {
    cooldownSeconds: 30,
    generator: () => "123456",
    otpTtlSeconds: 300,
    rateLimit: 5,
    rateWindowSeconds: 3600
  });

  try {
    const response = await service.requestOtp(
      OtpPurpose.Customer,
      "+919876543210"
    );

    assert.deepEqual(response, {
      devOtp: "123456",
      expiresInSeconds: 300,
      mobileNumber: "+919876543210",
      resendAfterSeconds: 30
    });
    await assert.rejects(
      () => service.requestOtp(OtpPurpose.Customer, "+919876543210"),
      /wait before requesting another OTP/i
    );
    assert.equal(
      await service.verifyOtp(OtpPurpose.Customer, "+919876543210", "123456"),
      true
    );
    assert.equal(
      await service.verifyOtp(OtpPurpose.Customer, "+919876543210", "123456"),
      false
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("requestOtp enqueues the generated OTP for async delivery", async () => {
  const cache = new InMemoryOtpCache(() => Date.now());
  const queue = new FakeOtpQueue();
  const options: OtpServiceOptions = {
    cooldownSeconds: 30,
    generator: () => "123456",
    otpTtlSeconds: 300,
    rateLimit: 5,
    rateWindowSeconds: 3600
  };
  const service = new (OtpService as unknown as new (
    cache: InMemoryOtpCache,
    options: OtpServiceOptions,
    queue: FakeOtpQueue
  ) => OtpService)(cache, options, queue);

  await service.requestOtp(OtpPurpose.Customer, " +919876543210 ");

  assert.equal(queue.otpJobs.length, 1);
  assert.deepEqual(
    {
      mobileNumber: (queue.otpJobs[0] as { mobileNumber: string }).mobileNumber,
      otp: (queue.otpJobs[0] as { otp: string }).otp,
      purpose: (queue.otpJobs[0] as { purpose: OtpPurpose }).purpose,
      version: (queue.otpJobs[0] as { version: number }).version
    },
    {
      mobileNumber: "+919876543210",
      otp: "123456",
      purpose: OtpPurpose.Customer,
      version: 1
    }
  );
  assert.ok(
    Date.parse((queue.otpJobs[0] as { requestedAt: string }).requestedAt)
  );
});

test("requestOtp hides the generated OTP in production responses", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const cache = new InMemoryOtpCache(() => Date.now());
    const service = new OtpService(cache, {
      cooldownSeconds: 30,
      generator: () => "123456",
      otpTtlSeconds: 300,
      rateLimit: 5,
      rateWindowSeconds: 3600
    });

    assert.deepEqual(
      await service.requestOtp(OtpPurpose.Customer, "+919876543210"),
      {
        expiresInSeconds: 300,
        mobileNumber: "+919876543210",
        resendAfterSeconds: 30
      }
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("requestOtp can expose the generated OTP when explicitly enabled in development", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    const cache = new InMemoryOtpCache(() => Date.now());
    const service = new OtpService(cache, {
      cooldownSeconds: 30,
      exposeOtpInResponse: true,
      generator: () => "123456",
      otpTtlSeconds: 300,
      rateLimit: 5,
      rateWindowSeconds: 3600
    });

    assert.deepEqual(
      await service.requestOtp(OtpPurpose.Customer, "+919876543210"),
      {
        devOtp: "123456",
        expiresInSeconds: 300,
        mobileNumber: "+919876543210",
        resendAfterSeconds: 30
      }
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("requestOtp enforces a Redis-backed request rate limit", async () => {
  const cache = new InMemoryOtpCache(() => Date.now());
  const service = new OtpService(cache, {
    cooldownSeconds: 0,
    generator: () => "123456",
    otpTtlSeconds: 300,
    rateLimit: 2,
    rateWindowSeconds: 3600
  });

  await service.requestOtp(OtpPurpose.DeliveryPartner, "+919876543210");
  await service.requestOtp(OtpPurpose.DeliveryPartner, "+919876543210");

  await assert.rejects(
    () => service.requestOtp(OtpPurpose.DeliveryPartner, "+919876543210"),
    /too many OTP requests/i
  );
});
