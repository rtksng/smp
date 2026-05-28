import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QUEUE_NAMES } from "@surgical/config";
import type { RedisOptions } from "ioredis";
import { ApiQueueService } from "./api-queue.service";

function createRedisConnection(configService: ConfigService): RedisOptions {
  const redisUrl = configService.get<string>("redisUrl") ?? process.env.REDIS_URL;

  if (redisUrl) {
    const parsedUrl = new URL(redisUrl);
    const database = parsedUrl.pathname.replace("/", "");

    return {
      db: database ? Number(database) : undefined,
      host: parsedUrl.hostname,
      maxRetriesPerRequest: null,
      password: parsedUrl.password
        ? decodeURIComponent(parsedUrl.password)
        : undefined,
      port: Number(parsedUrl.port || 6379),
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : undefined
    };
  }

  const redisPassword = process.env.REDIS_PASSWORD;

  return {
    host: process.env.REDIS_HOST ?? "localhost",
    maxRetriesPerRequest: null,
    password: redisPassword && redisPassword.length > 0 ? redisPassword : undefined,
    port: Number(process.env.REDIS_PORT ?? 6379)
  };
}

@Module({
  exports: [ApiQueueService],
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnection(configService),
        prefix:
          configService.get<string>("redisQueuePrefix") ??
          process.env.REDIS_QUEUE_PREFIX ??
          "surgical-platform"
      })
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.otp },
      { name: QUEUE_NAMES.notifications },
      { name: QUEUE_NAMES.invoice },
      { name: QUEUE_NAMES.paymentWebhook },
      { name: QUEUE_NAMES.lowStockAlert },
      { name: QUEUE_NAMES.nearExpiryAlert }
    )
  ],
  providers: [ApiQueueService]
})
export class ApiQueuesModule {}
