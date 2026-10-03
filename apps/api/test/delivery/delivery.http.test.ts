import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createDeliveryHttpFixture, deliveryHttpIds as ids } from "./delivery.http.fixture";

test("HTTP admin assignment, driver delivery, customer tracking and COD settlement stay consistent", async () => {
  const fixture = await createDeliveryHttpFixture();
  const server = fixture.app.getHttpServer();
  const statusPath = `/delivery/assignments/${ids.assignment}/status`;
  try {
    const created = await request(server).post("/admin/delivery/assign").send({ orderId: ids.order, deliveryPartnerId: ids.partner }).expect(201);
    assert.equal(created.body.data.status, "ASSIGNED");
    const notifications = await request(server).get("/delivery/notifications").expect(200);
    assert.equal(notifications.body.data.unreadCount, 1);
    const notificationId = notifications.body.data.items[0].id;
    await request(server).patch(`/delivery/notifications/${notificationId}/read`).set("x-test-principal", "other-driver").expect(404);
    await request(server).patch(`/delivery/notifications/${notificationId}/read`).expect(200);
    const read = await request(server).get("/delivery/notifications").expect(200);
    assert.equal(read.body.data.unreadCount, 0);
    const list = await request(server).get("/delivery/assignments").expect(200);
    assert.equal(list.body.data.items[0].id, ids.assignment);
    await request(server).patch(statusPath).send({ status: "DELIVERED" }).expect(400);
    await request(server).patch(statusPath).set("x-test-principal", "other-driver").send({ status: "ACCEPTED" }).expect(404);
    for (const status of ["ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"]) {
      const update = await request(server).patch(statusPath).send({ status, latitude: 28.6, longitude: 77.2 }).expect(200);
      assert.equal(update.body.data.status, status);
      const customer = await request(server).get(`/orders/${ids.order}`).expect(200);
      assert.equal(customer.body.data.deliveryTracking[0].status, status);
    }
    const proof = { status: "DELIVERED", receiverName: "QA Receiver", proofOfDeliveryKey: "qa/proof.jpg", proofOfDeliveryUrl: "https://example.test/qa-proof.jpg", cashCollectedAmount: 1225 };
    await request(server).patch(statusPath).send({ ...proof, cashCollectedAmount: 1 }).expect(400);
    await request(server).patch(statusPath).send(proof).expect(200);
    await request(server).patch(statusPath).send(proof).expect(200);
    const delivered = await request(server).get(`/orders/${ids.order}`).expect(200);
    assert.equal(delivered.body.data.status, "DELIVERED");
    assert.equal(delivered.body.data.paymentStatus, "PAID");
    assert.equal(delivered.body.data.deliveryTracking[0].proofOfDeliveryUrl, proof.proofOfDeliveryUrl);
    assert.equal(fixture.prisma.calls.inventoryStockUpdateMany.length, 1);
    assert.equal(fixture.prisma.calls.paymentUpdateMany.length, 1);
    const cash = await request(server).get("/delivery/cash").expect(200);
    assert.equal(cash.body.data.cashInHand, 1225);
    for (const status of ["SUBMITTED", "SETTLED", "SETTLED"]) {
      await request(server).patch(`/admin/delivery/assignments/${ids.assignment}/cash-settlement`).send({ status }).expect(200);
    }
    const settled = await request(server).get("/delivery/cash").expect(200);
    assert.equal(settled.body.data.cashInHand, 0);
    assert.equal(settled.body.data.settledAmount, 1225);
    await request(server).patch("/delivery/notifications/read-all").expect(200);
    const dashboard = await request(server).get("/delivery/dashboard").expect(200);
    assert.equal(dashboard.body.data.completedCount, 1);
    assert.equal(dashboard.body.data.activeCount, 0);
  } finally { await fixture.app.close(); }
});

test("HTTP incident reporting, resolution and failed-attempt reassignment", async () => {
  const fixture = await createDeliveryHttpFixture();
  const server = fixture.app.getHttpServer();
  try {
    await request(server).post("/admin/delivery/assign").send({ orderId: ids.order, deliveryPartnerId: ids.partner }).expect(201);
    for (const status of ["ACCEPTED", "PICKED_UP"]) await request(server).patch(`/delivery/assignments/${ids.assignment}/status`).send({ status }).expect(200);
    const incident = await request(server).post(`/delivery/assignments/${ids.assignment}/incidents`).send({ type: "CUSTOMER_UNREACHABLE", note: "QA customer unavailable" }).expect(201);
    const listed = await request(server).get("/delivery/incidents").expect(200);
    assert.equal(listed.body.data.items[0].id, incident.body.data.id);
    const resolved = await request(server).patch(`/admin/delivery/incidents/${incident.body.data.id}/resolve`).expect(200);
    assert.equal(resolved.body.data.status, "RESOLVED");
    await request(server).patch(`/delivery/assignments/${ids.assignment}/status`).send({ status: "FAILED", failureReason: "QA customer unavailable" }).expect(200);
    const customer = await request(server).get(`/orders/${ids.order}`).expect(200);
    assert.equal(customer.body.data.status, "PACKED");
    assert.equal(customer.body.data.deliveryTracking[0].failureReason, "QA customer unavailable");
    await request(server).post("/admin/delivery/assign").send({ orderId: ids.order, deliveryPartnerId: ids.partner }).expect(201);
    assert.equal(fixture.prisma.calls.inventoryStockUpdateMany.length, 0);
  } finally { await fixture.app.close(); }
});

test("HTTP admin partner list narrows to one warehouse and rejects a malformed warehouse id", async () => {
  const fixture = await createDeliveryHttpFixture();
  const server = fixture.app.getHttpServer();
  try {
    await request(server).get("/admin/delivery-partners?warehouseId=not-a-uuid").expect(400);
    const listed = await request(server).get(`/admin/delivery-partners?warehouseId=${ids.warehouse}&limit=5`).expect(200);
    assert.equal(listed.body.data.items[0].id, ids.partner);
    const lastQuery = fixture.prisma.calls.deliveryPartnerFindMany.at(-1) as { take: number; where: unknown };
    assert.equal(lastQuery.take, 5);
    assert.deepEqual(lastQuery.where, {
      assignments: {
        some: {
          OR: [
            { pickupWarehouseId: ids.warehouse },
            { order: { warehouseId: ids.warehouse }, pickupWarehouseId: null }
          ]
        }
      },
      deletedAt: null
    });
  } finally { await fixture.app.close(); }
});
