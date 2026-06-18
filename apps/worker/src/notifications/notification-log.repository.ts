import { randomUUID } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type SendLowStockAlertJobData,
  type SendNearExpiryAlertJobData,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import { Pool, type QueryResultRow } from "pg";

const NOTIFICATION_STATUS_SENT = "SENT";

type NotificationRecord = {
  channel: string;
  payload: Record<string, unknown>;
  providerRef: string;
  recipient: string;
  sentAt: Date;
  status: string;
  templateKey: string;
  userId: string | null;
};

export abstract class NotificationLogRepository {
  abstract createLowStockAlert(data: SendLowStockAlertJobData): Promise<void>;
  abstract createNearExpiryAlert(data: SendNearExpiryAlertJobData): Promise<void>;
  abstract createOrderConfirmation(
    data: SendOrderConfirmationJobData
  ): Promise<void>;
}

@Injectable()
export class PgNotificationLogRepository
  extends NotificationLogRepository
  implements OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    super();
    const connectionString =
      configService.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is required for notification workers.");
    }

    this.pool = new Pool({ connectionString });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async createOrderConfirmation(data: SendOrderConfirmationJobData) {
    await this.upsertNotification({
      channel: "customer",
      payload: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        requestedAt: data.requestedAt,
        version: data.version
      },
      providerRef: `worker:order-confirmation:${data.orderId}`,
      recipient: data.customerId,
      sentAt: new Date(),
      status: NOTIFICATION_STATUS_SENT,
      templateKey: "order_confirmation",
      userId: data.customerId
    });
  }

  async createLowStockAlert(data: SendLowStockAlertJobData) {
    await this.upsertNotification({
      channel: "admin",
      payload: {
        availableQuantity: data.availableQuantity,
        productId: data.productId,
        reorderLevel: data.reorderLevel,
        requestedAt: data.requestedAt,
        variantId: data.variantId,
        version: data.version,
        warehouseId: data.warehouseId
      },
      providerRef: [
        "worker:low-stock",
        data.warehouseId,
        data.productId,
        data.variantId ?? "default",
        data.requestedAt
      ].join(":"),
      recipient: data.warehouseId,
      sentAt: new Date(),
      status: NOTIFICATION_STATUS_SENT,
      templateKey: "low_stock_alert",
      userId: null
    });
  }

  async createNearExpiryAlert(data: SendNearExpiryAlertJobData) {
    await this.upsertNotification({
      channel: "admin",
      payload: {
        batchId: data.batchId,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate,
        productId: data.productId,
        quantity: data.quantity,
        requestedAt: data.requestedAt,
        variantId: data.variantId,
        version: data.version,
        warehouseId: data.warehouseId
      },
      providerRef: [
        "worker:near-expiry",
        data.warehouseId,
        data.batchId,
        data.requestedAt
      ].join(":"),
      recipient: data.warehouseId,
      sentAt: new Date(),
      status: NOTIFICATION_STATUS_SENT,
      templateKey: "near_expiry_alert",
      userId: null
    });
  }

  private async upsertNotification(record: NotificationRecord) {
    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM "NotificationLog" WHERE "providerRef" = $1 LIMIT 1`,
      [record.providerRef]
    );

    if (existing.rows[0]) {
      await this.pool.query(
        `UPDATE "NotificationLog"
         SET "payload" = $1,
             "status" = $2,
             "sentAt" = $3,
             "updatedAt" = $4
         WHERE id = $5`,
        [
          JSON.stringify(record.payload),
          record.status,
          record.sentAt,
          new Date(),
          existing.rows[0].id
        ]
      );
      return;
    }

    await this.pool.query<QueryResultRow>(
      `INSERT INTO "NotificationLog"
       ("id", "userId", "channel", "recipient", "templateKey", "payload", "status", "providerRef", "sentAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(),
        record.userId,
        record.channel,
        record.recipient,
        record.templateKey,
        JSON.stringify(record.payload),
        record.status,
        record.providerRef,
        record.sentAt,
        new Date(),
        new Date()
      ]
    );
  }
}
