import { randomUUID } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type SendLowStockAlertJobData,
  type SendNearExpiryAlertJobData,
  type SendDeliveryAssignmentNotificationJobData,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import { Pool, type QueryResultRow } from "pg";

const NOTIFICATION_STATUS_SENT = "SENT";

export type NotificationRecord = {
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
  abstract sendDeliveryAssignment(
    data: SendDeliveryAssignmentNotificationJobData
  ): Promise<void>;
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
    await upsertNotification(
      this.pool,
      buildOrderConfirmationNotificationRecord(data)
    );
  }

  async sendDeliveryAssignment(
    data: SendDeliveryAssignmentNotificationJobData
  ) {
    const devices = await this.pool.query<{ pushToken: string }>(
      `SELECT "pushToken"
       FROM "DeliveryPartnerDevice"
       WHERE "deliveryPartnerId" = $1
         AND "notificationsEnabled" = true
         AND "revokedAt" IS NULL`,
      [data.deliveryPartnerId]
    );
    const tokens = devices.rows
      .map((device) => device.pushToken)
      .filter((token) => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));

    if (tokens.length === 0) {
      await this.updateDeliveryNotification(data.notificationId, {
        providerRef: null,
        status: "NO_RECIPIENTS"
      });
      return;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      body: JSON.stringify(
        tokens.map((to) => ({
          body: data.body,
          data: { assignmentId: data.assignmentId },
          sound: "default",
          title: data.title,
          to
        }))
      ),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const responseBody = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: string; message?: string; status?: string }> }
      | null;
    const tickets = responseBody?.data ?? [];
    const failed = !response.ok || tickets.some((ticket) => ticket.status === "error");
    const providerRef = tickets.find((ticket) => ticket.id)?.id ?? null;

    await this.updateDeliveryNotification(data.notificationId, {
      providerRef,
      status: failed ? "FAILED" : "SENT"
    });

    if (failed) {
      throw new Error("Expo rejected the delivery assignment notification.");
    }
  }

  async createLowStockAlert(data: SendLowStockAlertJobData) {
    await upsertNotification(this.pool, buildLowStockAlertNotificationRecord(data));
  }

  async createNearExpiryAlert(data: SendNearExpiryAlertJobData) {
    await upsertNotification(
      this.pool,
      buildNearExpiryAlertNotificationRecord(data)
    );
  }

  private async updateDeliveryNotification(
    notificationId: string,
    input: { providerRef: string | null; status: string }
  ) {
    await this.pool.query(
      `UPDATE "NotificationLog"
       SET "providerRef" = $1,
           "status" = $2,
           "sentAt" = CASE WHEN $2 = 'SENT' THEN NOW() ELSE "sentAt" END,
           "updatedAt" = NOW()
       WHERE "id" = $3`,
      [input.providerRef, input.status, notificationId]
    );
  }
}

type NotificationDbClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[]
  ): Promise<{ rows: T[] }>;
  release(): void;
};

type NotificationDbPool = {
  connect(): Promise<NotificationDbClient>;
};

export function buildOrderConfirmationNotificationRecord(
  data: SendOrderConfirmationJobData
): NotificationRecord {
  return {
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
  };
}

export function buildLowStockAlertNotificationRecord(
  data: SendLowStockAlertJobData
): NotificationRecord {
  return {
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
      data.variantId ?? "default"
    ].join(":"),
    recipient: data.warehouseId,
    sentAt: new Date(),
    status: NOTIFICATION_STATUS_SENT,
    templateKey: "low_stock_alert",
    userId: null
  };
}

export function buildNearExpiryAlertNotificationRecord(
  data: SendNearExpiryAlertJobData
): NotificationRecord {
  return {
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
    providerRef: ["worker:near-expiry", data.warehouseId, data.batchId].join(
      ":"
    ),
    recipient: data.warehouseId,
    sentAt: new Date(),
    status: NOTIFICATION_STATUS_SENT,
    templateKey: "near_expiry_alert",
    userId: null
  };
}

export async function upsertNotification(
  pool: NotificationDbPool,
  record: NotificationRecord
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [record.providerRef]
    );
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM "NotificationLog" WHERE "providerRef" = $1 LIMIT 1`,
      [record.providerRef]
    );

    if (existing.rows[0]) {
      await client.query(
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
      await client.query("COMMIT");
      return;
    }

    await client.query<QueryResultRow>(
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
