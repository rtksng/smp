import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QUEUE_NAMES } from "@surgical/config";
import { createRedisConnectionOptions } from "./config/redis";
import {
  CustomerEmailLogRepository,
  PgCustomerEmailLogRepository
} from "./email/customer-email-log.repository";
import {
  CUSTOMER_EMAIL_CONFIG,
  CustomerEmailService
} from "./email/customer-email.service";
import { loadCustomerEmailConfig } from "./email/email.config";
import { CustomerEmailProcessor } from "./queues/customer-email.processor";
import { InvoicesProcessor } from "./queues/invoices.processor";
import {
  NotificationLogRepository,
  PgNotificationLogRepository
} from "./notifications/notification-log.repository";
import { PgPaymentWebhookRepository } from "./payments/payment-webhook.repository";
import { LowStockAlertProcessor } from "./queues/low-stock-alert.processor";
import { NearExpiryAlertProcessor } from "./queues/near-expiry-alert.processor";
import { NotificationsProcessor } from "./queues/notifications.processor";
import { OtpProcessor } from "./queues/otp.processor";
import {
  PaymentWebhookProcessor,
  PaymentWebhookRepository
} from "./queues/payment-webhook.processor";
import { StructuredLogger } from "./structured-logger.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: createRedisConnectionOptions(),
      prefix: process.env.REDIS_QUEUE_PREFIX ?? "surgical-platform"
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.otp
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.notifications
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.customerEmail
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
      // Fails startup when EMAIL_SENDING_ENABLED=true but Resend settings are missing.
      provide: CUSTOMER_EMAIL_CONFIG,
      useFactory: () => loadCustomerEmailConfig()
    },
    {
      provide: CustomerEmailLogRepository,
      useClass: PgCustomerEmailLogRepository
    },
    {
      provide: NotificationLogRepository,
      useClass: PgNotificationLogRepository
    },
    {
      provide: PaymentWebhookRepository,
      useClass: PgPaymentWebhookRepository
    },
    CustomerEmailService,
    CustomerEmailProcessor,
    OtpProcessor,
    NotificationsProcessor,
    InvoicesProcessor,
    PaymentWebhookProcessor,
    LowStockAlertProcessor,
    NearExpiryAlertProcessor
  ]
})
export class WorkerModule {}
