import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { RedisCacheService } from "../../src/modules/auth/common/redis-cache.service";

test(
  "RedisCacheService increment creates the counter with its expiry on a real Redis",
  { skip: process.env.REDIS_TEST_URL ? false : "Set REDIS_TEST_URL to run." },
  async () => {
    const url = process.env.REDIS_TEST_URL as string;
    const cache = new RedisCacheService({
      getOrThrow: () => url
    } as unknown as ConfigService);
    const redis = new Redis(url);
    const key = `redis-cache-test-${process.pid}-${Date.now()}`;

    try {
      const counts = await Promise.all(
        Array.from({ length: 10 }, () => cache.increment(key, 60))
      );

      assert.deepEqual(
        [...counts].sort((left, right) => left - right),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      );
      const ttl = await redis.ttl(key);
      assert.ok(ttl > 0 && ttl <= 60, `expected a 60s expiry, got ${ttl}`);
      assert.equal(await cache.increment(`${key}:no-ttl`, 0), 1);
    } finally {
      await redis.del(key, `${key}:no-ttl`);
      await redis.quit();
      await cache.onModuleDestroy();
    }
  }
);
