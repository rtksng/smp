import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>("redisUrl"), {
      maxRetriesPerRequest: 3
    });
  }

  async get(key: string) {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    if (ttlSeconds <= 0) {
      await this.redis.set(key, value);
      return;
    }

    await this.redis.set(key, value, "EX", ttlSeconds);
  }

  async delete(key: string) {
    await this.redis.del(key);
  }

  async increment(key: string, ttlSeconds: number) {
    if (ttlSeconds <= 0) {
      return this.redis.incr(key);
    }

    // Create the counter with its expiry and increment it in one transaction,
    // so a failure between the two steps can never leave a counter that
    // never expires.
    const results = await this.redis
      .multi()
      .set(key, "0", "EX", ttlSeconds, "NX")
      .incr(key)
      .exec();
    const [, incrementResult] = results ?? [];

    if (!incrementResult || incrementResult[0]) {
      throw incrementResult?.[0] ?? new Error(`Unable to increment ${key}.`);
    }

    return Number(incrementResult[1]);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
