import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LOW_STOCK_ALERT_JOB_NAMES,
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  NOTIFICATION_JOB_NAMES,
  type SendDeliveryAssignmentNotificationJobData,
  type SendLowStockAlertJobData,
  type SendNearExpiryAlertJobData,
  type SendOrderConfirmationJobData
} from "@surgical/types";
import type { Job } from "bullmq";
import { LowStockAlertProcessor } from "../src/queues/low-stock-alert.processor";
import { NearExpiryAlertProcessor } from "../src/queues/near-expiry-alert.processor";
import { NotificationsProcessor } from "../src/queues/notifications.processor";
import type { NotificationLogRepository } from "../src/notifications/notification-log.repository";

class FakeNotificationLogRepository implements NotificationLogRepository {
  readonly lowStockAlerts: SendLowStockAlertJobData[] = [];
  readonly nearExpiryAlerts: SendNearExpiryAlertJobData[] = [];
  readonly orderConfirmations: SendOrderConfirmationJobData[] = [];
  readonly deliveryAssignments: SendDeliveryAssignmentNotificationJobData[] = [];

  async sendDeliveryAssignment(data: SendDeliveryAssignmentNotificationJobData) {
    this.deliveryAssignments.push(data);
  }

  async createLowStockAlert(data: SendLowStockAlertJobData) {
    this.lowStockAlerts.push(data);
  }

  async createNearExpiryAlert(data: SendNearExpiryAlertJobData) {
    this.nearExpiryAlerts.push(data);
  }

  async createOrderConfirmation(data: SendOrderConfirmationJobData) {
    this.orderConfirmations.push(data);
  }
}

test("NotificationsProcessor persists order confirmation notifications", async () => {
  const repository = new FakeNotificationLogRepository();
  const processor = new NotificationsProcessor(repository);
  const data: SendOrderConfirmationJobData = {
    customerId: "customer-1",
    orderId: "order-1",
    orderNumber: "SMP-1001",
    requestedAt: "2026-06-18T10:30:00.000Z",
    version: 1
  };

  await processor.process({
    data,
    name: NOTIFICATION_JOB_NAMES.sendOrderConfirmation
  } as Job<SendOrderConfirmationJobData>);

  assert.deepEqual(repository.orderConfirmations, [data]);
});

test("NotificationsProcessor sends delivery assignment push notifications", async () => {
  const repository = new FakeNotificationLogRepository();
  const processor = new NotificationsProcessor(repository);
  const data: SendDeliveryAssignmentNotificationJobData = {
    assignmentId: "assignment-1",
    body: "Order SMP-2001 is ready for pickup.",
    deliveryPartnerId: "partner-1",
    notificationId: "notification-1",
    requestedAt: "2026-08-06T10:30:00.000Z",
    title: "New delivery assigned",
    version: 1
  };

  await processor.process({
    data,
    name: NOTIFICATION_JOB_NAMES.sendDeliveryAssignment
  } as Job<SendDeliveryAssignmentNotificationJobData>);

  assert.deepEqual(repository.deliveryAssignments, [data]);
});

test("LowStockAlertProcessor persists low-stock admin alerts", async () => {
  const repository = new FakeNotificationLogRepository();
  const processor = new LowStockAlertProcessor(repository);
  const data: SendLowStockAlertJobData = {
    availableQuantity: 3,
    productId: "product-1",
    reorderLevel: 5,
    requestedAt: "2026-06-18T10:30:00.000Z",
    variantId: null,
    version: 1,
    warehouseId: "warehouse-1"
  };

  await processor.process({
    data,
    name: LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert
  } as Job<SendLowStockAlertJobData>);

  assert.deepEqual(repository.lowStockAlerts, [data]);
});

test("NearExpiryAlertProcessor persists near-expiry admin alerts", async () => {
  const repository = new FakeNotificationLogRepository();
  const processor = new NearExpiryAlertProcessor(repository);
  const data: SendNearExpiryAlertJobData = {
    batchId: "batch-1",
    batchNumber: "B-1001",
    expiryDate: "2026-07-15T00:00:00.000Z",
    productId: "product-1",
    quantity: 8,
    requestedAt: "2026-06-18T10:30:00.000Z",
    variantId: "variant-1",
    version: 1,
    warehouseId: "warehouse-1"
  };

  await processor.process({
    data,
    name: NEAR_EXPIRY_ALERT_JOB_NAMES.sendNearExpiryAlert
  } as Job<SendNearExpiryAlertJobData>);

  assert.deepEqual(repository.nearExpiryAlerts, [data]);
});
