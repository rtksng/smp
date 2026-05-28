import assert from "node:assert/strict";
import { test } from "node:test";
import { RedisThrottlerStorage } from "../../src/common/rate-limit/redis-throttler-storage";

type StoredValue = {
  expiresAt: number | null;
  value: string;
};

class FakeRedisClient {
  private readonly store = new Map<string, StoredValue>();
  now = 0;

  async incr(key: string) {
    const existing = this.getStoredValue(key);
    const nextValue = String(Number(existing?.value ?? "0") + 1);
    this.store.set(key, {
      expiresAt: existing?.expiresAt ?? null,
      value: nextValue
    });

    return Number(nextValue);
  }

  async pexpire(key: string, ttlMs: number) {
    const existing = this.getStoredValue(key);

    if (!existing) {
      return 0;
    }

    this.store.set(key, {
      expiresAt: this.now + ttlMs,
      value: existing.value
    });

    return 1;
  }

  async pttl(key: string) {
    const existing = this.getStoredValue(key);

    if (!existing) {
      return -2;
    }

    if (existing.expiresAt === null) {
      return -1;
    }

    return Math.max(existing.expiresAt - this.now, -2);
  }

  async set(key: string, value: string, mode: "PX", ttlMs: number) {
    assert.equal(mode, "PX");
    this.store.set(key, {
      expiresAt: this.now + ttlMs,
      value
    });

    return "OK";
  }

  async quit() {
    return "OK";
  }

  private getStoredValue(key: string) {
    const existing = this.store.get(key);

    if (!existing) {
      return undefined;
    }

    if (existing.expiresAt !== null && existing.expiresAt <= this.now) {
      this.store.delete(key);
      return undefined;
    }

    return existing;
  }
}

test("RedisThrottlerStorage blocks requests after the configured limit", async () => {
  const redis = new FakeRedisClient();
  const storage = new RedisThrottlerStorage(redis, "test-prefix");

  const first = await storage.increment(
    "GET:/health:127.0.0.1",
    60_000,
    2,
    30_000,
    "default"
  );
  const second = await storage.increment(
    "GET:/health:127.0.0.1",
    60_000,
    2,
    30_000,
    "default"
  );
  const third = await storage.increment(
    "GET:/health:127.0.0.1",
    60_000,
    2,
    30_000,
    "default"
  );
  const blocked = await storage.increment(
    "GET:/health:127.0.0.1",
    60_000,
    2,
    30_000,
    "default"
  );

  assert.deepEqual(first, {
    isBlocked: false,
    timeToBlockExpire: 0,
    timeToExpire: 60,
    totalHits: 1
  });
  assert.equal(second.isBlocked, false);
  assert.equal(second.totalHits, 2);
  assert.equal(third.isBlocked, true);
  assert.equal(third.totalHits, 3);
  assert.equal(third.timeToBlockExpire, 30);
  assert.equal(blocked.isBlocked, true);
  assert.equal(blocked.totalHits, 3);
});
