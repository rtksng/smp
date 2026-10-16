import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CustomerEmailTemplateKey } from "@surgical/types";
import { Pool } from "pg";
import {
  upsertNotification,
  type NotificationRecord
} from "../notifications/notification-log.repository";

export const CUSTOMER_EMAIL_CHANNEL = "email";

export type CustomerEmailLogEntry = {
  customerId: string | null;
  dedupeKey: string;
  email: string;
  emailId: string | null;
  failure: string | null;
  requestedAt: string;
  status: "FAILED" | "SENT";
  template: CustomerEmailTemplateKey;
};

export abstract class CustomerEmailLogRepository {
  abstract findStatus(dedupeKey: string): Promise<string | null>;
  abstract record(entry: CustomerEmailLogEntry): Promise<void>;
}

export function customerEmailProviderRef(dedupeKey: string) {
  return `email:${dedupeKey}`;
}

export function buildCustomerEmailNotificationRecord(
  entry: CustomerEmailLogEntry
): NotificationRecord {
  return {
    channel: CUSTOMER_EMAIL_CHANNEL,
    payload: {
      dedupeKey: entry.dedupeKey,
      emailId: entry.emailId,
      failure: entry.failure,
      provider: "resend",
      requestedAt: entry.requestedAt,
      template: entry.template,
      version: 1
    },
    providerRef: customerEmailProviderRef(entry.dedupeKey),
    recipient: entry.email,
    sentAt: entry.status === "SENT" ? new Date() : null,
    status: entry.status,
    templateKey: `customer_email_${entry.template.replaceAll("-", "_")}`,
    userId: entry.customerId
  };
}

@Injectable()
export class PgCustomerEmailLogRepository
  extends CustomerEmailLogRepository
  implements OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    super();
    const connectionString =
      configService.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for customer email workers.");
    }

    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async findStatus(dedupeKey: string) {
    const result = await this.pool.query<{ status: string }>(
      `SELECT "status" FROM "NotificationLog" WHERE "providerRef" = $1 LIMIT 1`,
      [customerEmailProviderRef(dedupeKey)]
    );

    return result.rows[0]?.status ?? null;
  }

  async record(entry: CustomerEmailLogEntry) {
    await upsertNotification(this.pool, buildCustomerEmailNotificationRecord(entry));
  }
}
