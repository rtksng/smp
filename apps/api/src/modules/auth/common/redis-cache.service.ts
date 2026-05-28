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
    const count = await this.redis.incr(key);

    if (count === 1 && ttlSeconds > 0) {
      await this.redis.expire(key, ttlSeconds);
    }

    return count;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
