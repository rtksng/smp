import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QUEUE_NAMES } from "@surgical/config";
import { InvoicesProcessor } from "./queues/invoices.processor";
import {
  NotificationLogRepository,
  PgNotificationLogRepository
} from "./notifications/notification-log.repository";
import { LowStockAlertProcessor } from "./queues/low-stock-alert.processor";
import { NearExpiryAlertProcessor } from "./queues/near-expiry-alert.processor";
import { NotificationsProcessor } from "./queues/notifications.processor";
import { OtpProcessor } from "./queues/otp.processor";
import { PaymentWebhookProcessor } from "./queues/payment-webhook.processor";
import { StructuredLogger } from "./structured-logger.service";

function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const parsedUrl = new URL(redisUrl);
    const database = parsedUrl.pathname.replace("/", "");

    return {
      db: database ? Number(database) : undefined,
      host: parsedUrl.hostname,
      maxRetriesPerRequest: null,
      password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
      port: Number(parsedUrl.port || 6379),
      username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined
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
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: createRedisConnection(),
      prefix: process.env.REDIS_QUEUE_PREFIX ?? "surgical-platform"
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.otp
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.notifications
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.invoice
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.paymentWebhook
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.lowStockAlert
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.nearExpiryAlert
    })
  ],
  providers: [
    StructuredLogger,
    {
      provide: NotificationLogRepository,
      useClass: PgNotificationLogRepository
    },
    OtpProcessor,
    NotificationsProcessor,
    InvoicesProcessor,
    PaymentWebhookProcessor,
    LowStockAlertProcessor,
    NearExpiryAlertProcessor
  ]
})
export class WorkerModule {}
