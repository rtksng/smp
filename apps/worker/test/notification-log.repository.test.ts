import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  SendLowStockAlertJobData,
  SendNearExpiryAlertJobData
} from "@surgical/types";
import {
  buildLowStockAlertNotificationRecord,
  buildNearExpiryAlertNotificationRecord,
  upsertNotification,
  type NotificationRecord
} from "../src/notifications/notification-log.repository";

test("low-stock alert providerRef is stable for duplicate business events", () => {
  const first = buildLowStockAlertNotificationRecord(
    lowStockAlert("2026-06-18T10:30:00.000Z")
  );
  const duplicate = buildLowStockAlertNotificationRecord(
    lowStockAlert("2026-06-18T10:35:00.000Z")
  );

  assert.equal(first.providerRef, duplicate.providerRef);
});

test("near-expiry alert providerRef is stable for duplicate business events", () => {
  const first = buildNearExpiryAlertNotificationRecord(
    nearExpiryAlert("2026-06-18T10:30:00.000Z")
  );
  const duplicate = buildNearExpiryAlertNotificationRecord(
    nearExpiryAlert("2026-06-18T10:35:00.000Z")
  );

  assert.equal(first.providerRef, duplicate.providerRef);
});

test("upsertNotification serializes duplicate providerRef writes in one DB transaction", async () => {
  const client = new FakeClient([{ id: "notification-1" }]);
  const pool = {
    async connect() {
      return client;
    }
  };

  await upsertNotification(pool, notificationRecord());

  assert.deepEqual(client.queries.map((entry) => entry.sql), [
    "BEGIN",
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    'SELECT id FROM "NotificationLog" WHERE "providerRef" = $1 LIMIT 1',
    "UPDATE",
    "COMMIT"
  ]);
  assert.deepEqual(client.queries[1]?.values, ["worker:test:1"]);
  assert.equal(client.released, true);
}
);

class FakeClient {
  readonly queries: Array<{ sql: string; values?: unknown[] }> = [];
  released = false;

  constructor(private readonly existingRows: Array<{ id: string }>) {}

  async query(sql: string, values?: unknown[]) {
    const normalizedSql = normalizeSql(sql);
    this.queries.push({ sql: normalizedSql, values });

    if (normalizedSql.startsWith("SELECT id")) {
      return { rows: this.existingRows };
    }

    return { rows: [] };
  }

  release() {
    this.released = true;
  }
}

function lowStockAlert(requestedAt: string): SendLowStockAlertJobData {
  return {
    availableQuantity: 3,
    productId: "product-1",
    reorderLevel: 5,
    requestedAt,
    variantId: null,
    version: 1,
    warehouseId: "warehouse-1"
  };
}

function nearExpiryAlert(requestedAt: string): SendNearExpiryAlertJobData {
  return {
    batchId: "batch-1",
    batchNumber: "B-1001",
    expiryDate: "2026-07-15T00:00:00.000Z",
    productId: "product-1",
    quantity: 8,
    requestedAt,
    variantId: "variant-1",
    version: 1,
    warehouseId: "warehouse-1"
  };
}

function notificationRecord(): NotificationRecord {
  return {
    channel: "test",
    payload: { ok: true },
    providerRef: "worker:test:1",
    recipient: "recipient-1",
    sentAt: new Date("2026-06-18T10:30:00.000Z"),
    status: "SENT",
    templateKey: "test",
    userId: null
  };
}

function normalizeSql(sql: string) {
  const compact = sql.replace(/\s+/g, " ").trim();

  if (compact.startsWith("UPDATE")) {
    return "UPDATE";
  }

  if (compact.startsWith("INSERT")) {
    return "INSERT";
  }

  return compact;
}
