import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import {
  createDeliveryChargesHttpFixture, DELIVERY_TEST_WAREHOUSE_ID, DELIVERY_DELETED_WAREHOUSE_ID
} from "./delivery-charges.fixture";

const route = "/admin/delivery-charge-rules";
let fixture: Awaited<ReturnType<typeof createDeliveryChargesHttpFixture>>;
before(async () => { fixture = await createDeliveryChargesHttpFixture(); });
after(async () => { await fixture.app.close(); });

test("HTTP create, list, update, disable, and archive affect the actual delivery calculation", async () => {
  const client = fixture.app.getHttpServer();
  const created = await request(client).post(route).send({
    name: "  Global standard  ", charge: 75, priority: 0, isActive: true
  }).expect(201);
  const globalId = created.body.data.id;
  assert.equal(created.body.data.name, "Global standard");
  assert.equal(created.body.data.charge, 75);
  assert.deepEqual(await fixture.service.calculateDeliveryCharge({ subtotal: 250 }), {
    deliveryCharge: 75, rule: { id: globalId, name: "Global standard" }
  });
  const scoped = await request(client).post(route).send({
    name: "Delhi local", charge: "40.50", pincode: "110001",
    warehouseId: DELIVERY_TEST_WAREHOUSE_ID, minOrderAmount: 100,
    maxOrderAmount: 1000, freeDeliveryThreshold: 500, priority: 10, isActive: true
  }).expect(201);
  const scopedId = scoped.body.data.id;
  assert.equal(scoped.body.data.warehouse.id, DELIVERY_TEST_WAREHOUSE_ID);
  const quote = (subtotal: number) => fixture.service.calculateDeliveryCharge({
    subtotal, pincode: "110001", warehouseId: DELIVERY_TEST_WAREHOUSE_ID
  });
  assert.equal((await quote(99.99)).deliveryCharge, 75);
  assert.equal((await quote(100)).deliveryCharge, 40.5);
  assert.equal((await quote(499.99)).deliveryCharge, 40.5);
  assert.equal((await quote(500)).deliveryCharge, 0);
  assert.equal((await quote(1000)).deliveryCharge, 0);
  assert.equal((await quote(1000.01)).deliveryCharge, 75);
  const listing = await request(client).get(route).query({ search: "delhi", pincode: "110001",
    warehouseId: DELIVERY_TEST_WAREHOUSE_ID, isActive: "true", limit: 1, page: 1 }).expect(200);
  assert.equal(listing.body.data.items.length, 1);
  assert.equal(listing.body.data.items[0].id, scopedId);
  assert.equal(listing.body.data.pagination.total, 1);

  await request(client).patch(`${route}/${scopedId}`).send({ charge: 35, isActive: false }).expect(200);
  assert.equal((await quote(250)).deliveryCharge, 75);
  const inactive = await request(client).get(route).query({ isActive: "false" }).expect(200);
  assert.deepEqual(inactive.body.data.items.map((item: { id: string }) => item.id), [scopedId]);
  await request(client).patch(`${route}/${scopedId}`).send({ isActive: true, freeDeliveryThreshold: null }).expect(200);
  assert.equal((await quote(500)).deliveryCharge, 35);
  await request(client).delete(`${route}/${scopedId}`).expect(200);
  assert.equal((await quote(250)).deliveryCharge, 75);
  await request(client).patch(`${route}/${scopedId}`).send({ isActive: true }).expect(404);
  await request(client).delete(`${route}/${globalId}`).expect(200);
  assert.deepEqual(await fixture.service.calculateDeliveryCharge({ subtotal: 250 }), {
    deliveryCharge: 0, rule: null
  });
  const archived = await request(client).get(route).expect(200);
  assert.equal(archived.body.data.pagination.total, 0);
  assert.deepEqual(archived.body.data.items, []);
});

test("HTTP validation rejects string booleans, null nonnullable fields, and malformed money before persistence", async () => {
  const client = fixture.app.getHttpServer();
  const created = await request(client).post(route).send({ name: "Validation rule", charge: 25, isActive: false }).expect(201);
  const id = created.body.data.id;
  const originalWrites = { ...fixture.calls };
  for (const body of [
    { name: "Wrong boolean", charge: 75, isActive: "false" },
    { name: "Empty fee", charge: "" }, { name: "Blank fee", charge: " " },
    { name: "Boolean fee", charge: true }, { name: "Array fee", charge: [] },
    { name: "Null priority", charge: 10, priority: null },
    { name: "Overflow fee", charge: 10_000_000_000 },
    { name: "Overflow priority", charge: 10, priority: 2_147_483_648 }
  ]) {
    await request(client).post(route).send(body).expect(400);
  }
  for (const body of [
    { name: null }, { isActive: null }, { charge: null }, { priority: null },
    { isActive: "false" }, { minOrderAmount: true }, { maxOrderAmount: "" },
    { freeDeliveryThreshold: [] }, { name: 1234 }, { priority: false }
  ]) {
    await request(client).patch(`${route}/${id}`).send(body).expect(400);
  }
  assert.deepEqual(fixture.calls, originalWrites);
  assert.equal(fixture.rules.find((rule) => rule.id === id)?.isActive, false);
});

test("HTTP warehouse and partial-range validation reject bad edits without changing the rule", async () => {
  const client = fixture.app.getHttpServer();
  const created = await request(client).post(route).send({
    name: "Bounded rule", charge: 50, minOrderAmount: 100, maxOrderAmount: 500
  }).expect(201);
  const id = created.body.data.id;
  const originalWrites = { ...fixture.calls };
  for (const warehouseId of [DELIVERY_DELETED_WAREHOUSE_ID, "00000000-0000-4000-8000-000000000999"]) {
    await request(client).post(route).send({ name: "Invalid warehouse", charge: 50, warehouseId }).expect(404);
    await request(client).patch(`${route}/${id}`).send({ warehouseId }).expect(404);
  }
  await request(client).patch(`${route}/${id}`).send({ minOrderAmount: 501 }).expect(400);
  await request(client).patch(`${route}/${id}`).send({ maxOrderAmount: 99 }).expect(400);
  assert.deepEqual(fixture.calls, originalWrites);
  const cleared = await request(client).patch(`${route}/${id}`).send({
    minOrderAmount: null, maxOrderAmount: null, pincode: null, warehouseId: null
  }).expect(200);
  assert.equal(cleared.body.data.minOrderAmount, null);
  assert.equal(cleared.body.data.maxOrderAmount, null);
  assert.equal(cleared.body.data.warehouseId, null);
});

test("delivery rules retain deterministic priority and location-specific matching", async () => {
  const local = await createDeliveryChargesHttpFixture();
  try {
    const create = (body: object) => request(local.app.getHttpServer()).post(route).send(body).expect(201);
    await create({ name: "Default high priority", charge: 90, priority: 100 });
    await create({ name: "Pincode low priority", charge: 60, pincode: "110001", priority: 1 });
    const high = await create({ name: "Pincode higher priority", charge: 55, pincode: "110001", priority: 2 });
    const scoped = await create({ name: "Warehouse and pincode", charge: 30, pincode: "110001",
      warehouseId: DELIVERY_TEST_WAREHOUSE_ID, priority: 0 });
    const inactive = await create({ name: "Disabled specific rule", charge: 1, pincode: "110001",
      warehouseId: DELIVERY_TEST_WAREHOUSE_ID, priority: 1000, isActive: false });
    assert.equal(inactive.body.data.isActive, false);
    assert.equal((await local.service.calculateDeliveryCharge({ subtotal: 250, pincode: "110001" })).rule?.id, high.body.data.id);
    assert.equal((await local.service.calculateDeliveryCharge({ subtotal: 250, pincode: "110001",
      warehouseId: DELIVERY_TEST_WAREHOUSE_ID })).rule?.id, scoped.body.data.id);
    const page1 = await request(local.app.getHttpServer()).get(route).query({ limit: 2, page: 1 }).expect(200);
    const page2 = await request(local.app.getHttpServer()).get(route).query({ limit: 2, page: 2 }).expect(200);
    assert.equal(page1.body.data.pagination.total, 5);
    assert.equal(page1.body.data.pagination.totalPages, 3);
    assert.equal(page1.body.data.pagination.hasNextPage, true);
    assert.equal(page2.body.data.pagination.hasPreviousPage, true);
    assert.equal(new Set([...page1.body.data.items, ...page2.body.data.items].map((rule: { id: string }) => rule.id)).size, 4);
  } finally { await local.app.close(); }
});

test("delivery rule CRUD requires SettingsManage and rejects invalid IDs and list filters", async () => {
  const forbidden = await createDeliveryChargesHttpFixture([PermissionCode.ReportsRead]);
  try {
    await request(forbidden.app.getHttpServer()).get(route).expect(403);
    await request(forbidden.app.getHttpServer()).post(route).send({ name: "Forbidden", charge: 10 }).expect(403);
    await request(forbidden.app.getHttpServer()).patch(`${route}/${DELIVERY_TEST_WAREHOUSE_ID}`).send({ charge: 10 }).expect(403);
    await request(forbidden.app.getHttpServer()).delete(`${route}/${DELIVERY_TEST_WAREHOUSE_ID}`).expect(403);
    assert.deepEqual(forbidden.calls, { created: 0, updated: 0 });
  } finally { await forbidden.app.close(); }
  for (const query of [{ page: 0 }, { limit: 101 }, { isActive: "invalid" }, { pincode: "123" }]) {
    await request(fixture.app.getHttpServer()).get(route).query(query).expect(400);
  }
  await request(fixture.app.getHttpServer()).patch(`${route}/invalid-id`).send({ charge: 10 }).expect(400);
});
