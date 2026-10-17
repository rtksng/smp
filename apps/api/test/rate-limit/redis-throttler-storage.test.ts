import assert from "node:assert/strict";
import { test } from "node:test";
import Redis from "ioredis";
import {
  RedisThrottlerStorage,
  THROTTLE_INCREMENT_SCRIPT
} from "../../src/common/rate-limit/redis-throttler-storage";

type StoredValue = {
  expiresAt: number | null;
  value: string;
};

// Mirrors THROTTLE_INCREMENT_SCRIPT against an in-memory store. The Lua script
// itself is exercised against a real Redis in the REDIS_TEST_URL test below.
class FakeRedisClient {
  readonly store = new Map<string, StoredValue>();
  now = 0;

  async eval(script: string, numberOfKeys: number, ...args: Array<number | string>) {
    assert.equal(script, THROTTLE_INCREMENT_SCRIPT);
    assert.equal(numberOfKeys, 2);
    const [hitKey, blockKey, ttl, limit, blockDuration] = args as [
      string,
      string,
      number,
      number,
      number
    ];
    const blockTtl = this.pttl(blockKey);

    if (blockTtl > 0) {
      return [limit + 1, this.pttl(hitKey), 1, blockTtl];
    }

    const existing = this.read(hitKey);
    const totalHits = Number(existing?.value ?? "0") + 1;
    this.store.set(hitKey, {
      expiresAt: existing?.expiresAt ?? null,
      value: String(totalHits)
    });
    let timeToExpire = this.pttl(hitKey);

    if (timeToExpire < 0) {
      this.store.set(hitKey, { expiresAt: this.now + ttl, value: String(totalHits) });
      timeToExpire = ttl;
    }

    if (totalHits > limit) {
      this.store.set(blockKey, { expiresAt: this.now + blockDuration, value: "1" });
      return [totalHits, timeToExpire, 1, blockDuration];
    }

    return [totalHits, timeToExpire, 0, 0];
  }

  async quit() {
    return "OK";
  }

  private pttl(key: string) {
    const existing = this.read(key);

    if (!existing) {
      return -2;
    }

    return existing.expiresAt === null ? -1 : existing.expiresAt - this.now;
  }

  private read(key: string) {
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

async function hit(storage: RedisThrottlerStorage, key = "GET:/health:127.0.0.1") {
  return storage.increment(key, 60_000, 2, 30_000, "default");
}

async function assertBlocksAfterLimit(storage: RedisThrottlerStorage, key: string) {
  const first = await hit(storage, key);
  const second = await hit(storage, key);
  const third = await hit(storage, key);
  const blocked = await hit(storage, key);

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
}

test("RedisThrottlerStorage blocks requests after the configured limit", async () => {
  await assertBlocksAfterLimit(
    new RedisThrottlerStorage(new FakeRedisClient(), "test-prefix"),
    "GET:/health:127.0.0.1"
  );
});

test("RedisThrottlerStorage restores a missing expiry on an existing hit counter", async () => {
  const redis = new FakeRedisClient();
  const storage = new RedisThrottlerStorage(redis, "test-prefix");
  redis.store.set("test-prefix:rate-limit:default:hits:stuck", {
    expiresAt: null,
    value: "7"
  });

  const result = await storage.increment("stuck", 60_000, 100, 30_000, "default");

  assert.equal(result.totalHits, 8);
  assert.equal(result.timeToExpire, 60);
  assert.equal(
    redis.store.get("test-prefix:rate-limit:default:hits:stuck")?.expiresAt,
    60_000
  );
});

test("RedisThrottlerStorage lets requests through when Redis fails", async () => {
  const storage = new RedisThrottlerStorage(
    {
      eval: async () => {
        throw new Error("Connection is closed.");
      },
      quit: async () => "OK"
    },
    "test-prefix"
  );

  assert.deepEqual(await hit(storage), {
    isBlocked: false,
    timeToBlockExpire: 0,
    timeToExpire: 0,
    totalHits: 0
  });
});

test(
  "RedisThrottlerStorage script blocks after the limit on a real Redis",
  { skip: process.env.REDIS_TEST_URL ? false : "Set REDIS_TEST_URL to run." },
  async () => {
    const redis = new Redis(process.env.REDIS_TEST_URL as string);
    const prefix = `throttler-test-${process.pid}-${Date.now()}`;

    try {
      await assertBlocksAfterLimit(new RedisThrottlerStorage(redis, prefix), "real");

      const hitKey = `${prefix}:rate-limit:default:hits:stuck`;
      await redis.set(hitKey, "7");
      const healed = await new RedisThrottlerStorage(redis, prefix).increment(
        "stuck",
        60_000,
        100,
        30_000,
        "default"
      );

      assert.equal(healed.totalHits, 8);
      assert.ok((await redis.pttl(hitKey)) > 0);
    } finally {
      const keys = await redis.keys(`${prefix}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  }
);
