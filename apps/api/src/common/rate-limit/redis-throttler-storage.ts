import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";

export type RedisThrottlerClient = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ttlMs: number): Promise<number>;
  pttl(key: string): Promise<number>;
  quit(): Promise<unknown>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  constructor(
    private readonly redis: RedisThrottlerClient,
    private readonly keyPrefix: string
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = this.key("hits", throttlerName, key);
    const blockKey = this.key("block", throttlerName, key);
    const existingBlockTtl = await this.redis.pttl(blockKey);

    if (existingBlockTtl > 0) {
      return {
        isBlocked: true,
        timeToBlockExpire: millisecondsToSeconds(existingBlockTtl),
        timeToExpire: millisecondsToSeconds(await this.redis.pttl(hitKey)),
        totalHits: limit + 1
      };
    }

    const totalHits = await this.redis.incr(hitKey);

    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }

    const timeToExpire = millisecondsToSeconds(await this.redis.pttl(hitKey));

    if (totalHits > limit) {
      await this.redis.set(blockKey, "1", "PX", blockDuration);

      return {
        isBlocked: true,
        timeToBlockExpire: millisecondsToSeconds(blockDuration),
        timeToExpire,
        totalHits
      };
    }

    return {
      isBlocked: false,
      timeToBlockExpire: 0,
      timeToExpire,
      totalHits
    };
  }

  async onApplicationShutdown() {
    await this.redis.quit();
  }

  private key(type: "block" | "hits", throttlerName: string, key: string) {
    return `${this.keyPrefix}:rate-limit:${throttlerName}:${type}:${key}`;
  }
}

export function createRedisThrottlerStorage(configService: ConfigService) {
  const redis = new Redis(configService.getOrThrow<string>("redisUrl"), {
    maxRetriesPerRequest: 3
  });

  return new RedisThrottlerStorage(
    redis,
    configService.get<string>("redisQueuePrefix", "surgical-platform")
  );
}

function millisecondsToSeconds(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.ceil(value / 1000);
}
