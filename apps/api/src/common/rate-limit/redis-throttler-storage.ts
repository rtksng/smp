import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import Redis from "ioredis";

export type RedisThrottlerClient = {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: Array<number | string>
  ): Promise<unknown>;
  quit(): Promise<unknown>;
};

// Runs the whole check-increment-block sequence atomically so a crash or a
// concurrent request can never leave a hit counter without an expiry.
// Returns [totalHits, timeToExpireMs, isBlocked (0|1), timeToBlockExpireMs].
export const THROTTLE_INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local blockTtl = redis.call("PTTL", blockKey)
if blockTtl > 0 then
  return { limit + 1, redis.call("PTTL", hitKey), 1, blockTtl }
end

local totalHits = redis.call("INCR", hitKey)
local timeToExpire = redis.call("PTTL", hitKey)
if timeToExpire < 0 then
  redis.call("PEXPIRE", hitKey, ttl)
  timeToExpire = ttl
end

if totalHits > limit then
  redis.call("SET", blockKey, "1", "PX", blockDuration)
  return { totalHits, timeToExpire, 1, blockDuration }
end

return { totalHits, timeToExpire, 0, 0 }
`;

const FAILURE_LOG_INTERVAL_MS = 10_000;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private lastFailureLoggedAt = 0;

  constructor(
    private readonly redis: RedisThrottlerClient,
    private readonly keyPrefix: string,
    private readonly now: () => number = Date.now
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    try {
      const result = await this.redis.eval(
        THROTTLE_INCREMENT_SCRIPT,
        2,
        this.key("hits", throttlerName, key),
        this.key("block", throttlerName, key),
        ttl,
        limit,
        blockDuration
      );
      const [totalHits, timeToExpireMs, isBlocked, timeToBlockExpireMs] =
        parseScriptResult(result);

      return {
        isBlocked: isBlocked === 1,
        timeToBlockExpire: millisecondsToSeconds(timeToBlockExpireMs),
        timeToExpire: millisecondsToSeconds(timeToExpireMs),
        totalHits
      };
    } catch (error) {
      // Rate limiting is a protection layer, not a dependency: when Redis is
      // unavailable, let traffic through instead of failing every request.
      this.logFailure(error);

      return {
        isBlocked: false,
        timeToBlockExpire: 0,
        timeToExpire: 0,
        totalHits: 0
      };
    }
  }

  async onApplicationShutdown() {
    await this.redis.quit();
  }

  private key(type: "block" | "hits", throttlerName: string, key: string) {
    return `${this.keyPrefix}:rate-limit:${throttlerName}:${type}:${key}`;
  }

  private logFailure(error: unknown) {
    const now = this.now();

    if (now - this.lastFailureLoggedAt < FAILURE_LOG_INTERVAL_MS) {
      return;
    }

    this.lastFailureLoggedAt = now;
    this.logger.warn(
      `Rate limiting skipped because Redis is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function createRedisThrottlerStorage(configService: ConfigService) {
  const redis = new Redis(configService.getOrThrow<string>("redisUrl"), {
    // Fail fast so an unreachable Redis skips rate limiting instead of
    // stalling requests while commands queue for a reconnect.
    commandTimeout: 500,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });

  // Without a listener ioredis reports connection errors as unhandled.
  redis.on("error", () => undefined);

  return new RedisThrottlerStorage(
    redis,
    configService.get<string>("redisQueuePrefix", "surgical-platform")
  );
}

function parseScriptResult(result: unknown): [number, number, number, number] {
  if (!Array.isArray(result) || result.length !== 4) {
    throw new Error("Unexpected rate limit script result.");
  }

  return result.map((value) => Number(value)) as [number, number, number, number];
}

function millisecondsToSeconds(value: number) {
  if (value <= 0) {
    return 0;
  }

  return Math.ceil(value / 1000);
}
