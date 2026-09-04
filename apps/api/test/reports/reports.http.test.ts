import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { after, before, test } from "node:test";
import request from "supertest";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import {
  createReportsHttpFixture, createReportsServiceFixture, fixtureAuth,
  FIXTURE_DATE_FROM, FIXTURE_DATE_TO, FIXTURE_WAREHOUSES
} from "./reports.fixture";

let fixture: Awaited<ReturnType<typeof createReportsHttpFixture>>;
const dates = { dateFrom: FIXTURE_DATE_FROM, dateTo: FIXTURE_DATE_TO };
const sections = {
  orders: "Orders by day", sales: "Revenue by day", products: "Top selling products",
  inventory: "Stock alerts", warehouses: "Warehouse stock summary"
} as const;

before(async () => { fixture = await createReportsHttpFixture(); });
after(async () => { await fixture.app.close(); });

function parseBytes(response: IncomingMessage, done: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(chunk));
  response.on("end", () => done(null, Buffer.concat(chunks)));
  response.on("error", (error: Error) => done(error));
}

for (const [view, section] of Object.entries(sections)) {
  for (const format of ["csv", "pdf"] as const) {
    test(`${view} ${format} download sends the raw file with only that page's data`, async () => {
      const response = await request(fixture.app.getHttpServer())
        .get("/admin/reports/dashboard/export").query({ ...dates, view, format })
        .buffer(true).parse(parseBytes).expect(200);
      const body = response.body as Buffer;
      const content = body.toString("utf8");
      assert.equal(Number(response.headers["content-length"]), body.length);
      assert.equal(response.headers["x-skip-api-response"], undefined);
      assert.equal(response.headers["content-disposition"],
        `attachment; filename="${view}-report-${FIXTURE_DATE_FROM}-to-${FIXTURE_DATE_TO}.${format}"`);
      assert.equal(response.headers["content-type"], format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8");
      assert.ok(content.includes(section));
      assert.ok(!content.startsWith('{"type":"Buffer"'));
      for (const otherSection of Object.values(sections).filter((title) => title !== section)) {
        assert.ok(!content.includes(otherSection), `${view} must not include ${otherSection}`);
      }
      if (format === "pdf") {
        assert.ok(content.startsWith("%PDF-1.4\n"));
        assert.ok(content.endsWith("%%EOF"));
        const xref = Number(content.match(/startxref\n(\d+)/)?.[1]);
        assert.ok(body.subarray(xref).toString().startsWith("xref\n"));
        assert.ok(content.includes("/WinAnsiEncoding"));
      } else {
        assert.ok(content.startsWith(`${view[0].toUpperCase()}${view.slice(1)} report\r\n`));
        if (view === "products") {
          assert.ok(content.includes('"Forceps, curved 8"" (sterile)",SKU-1,'));
        }
      }
    });
  }
}

test("the full 60-day HTTP report and daily CSV rows reconcile with its totals", async () => {
  const response = await request(fixture.app.getHttpServer())
    .get("/admin/reports/dashboard").query(dates).expect(200);
  const report = response.body.data;
  assert.equal(report.charts.ordersByDay.length, 60);
  assert.equal(report.charts.ordersByDay[0].date, FIXTURE_DATE_FROM);
  assert.equal(report.charts.ordersByDay.at(-1).date, FIXTURE_DATE_TO);
  assert.equal(report.charts.ordersByDay.reduce((sum: number, point: { orders: number }) => sum + point.orders, 0), 60);
  assert.equal(report.cards.totalOrders, 60);
  assert.equal(report.charts.revenueByDay.reduce((sum: number, point: { revenue: number }) => sum + point.revenue, 0), report.cards.revenue);
  assert.equal(report.cards.revenue, fixture.orders.filter((order) => order.paymentStatus === "PAID")
    .reduce((sum, order) => sum + order.grandTotal, 0));
  const csvResponse = await request(fixture.app.getHttpServer())
    .get("/admin/reports/dashboard/export").query({ ...dates, view: "orders", format: "csv" })
    .buffer(true).parse(parseBytes).expect(200);
  const csv = csvResponse.body.toString();
  const dailyRows = csv.split("\r\n").filter((line: string) => /^\d{4}-\d{2}-\d{2},/.test(line));
  assert.equal(dailyRows.length, 60);
  assert.equal(dailyRows[0], `${FIXTURE_DATE_FROM},1`);
  assert.equal(dailyRows.at(-1), `${FIXTURE_DATE_TO},1`);
  assert.equal(dailyRows.reduce((sum: number, line: string) => sum + Number(line.split(",")[1]), 0), report.cards.totalOrders);
  assert.ok(!fixture.calls.rawSql.filter((sql) => sql.includes('FROM "Order" o')).some((sql) => /LIMIT/.test(sql)));
});

test("all ten warehouse rows and alert rows remain present over HTTP and in exports", async () => {
  const response = await request(fixture.app.getHttpServer())
    .get("/admin/reports/dashboard").query(dates).expect(200);
  const report = response.body.data;
  assert.equal(report.warehouseOptions.length, 10);
  assert.equal(report.charts.stockAlerts.length, 10);
  assert.equal(report.charts.warehouseStockSummary.length, 10);
  assert.equal(report.cards.activeWarehouses, 10);
  assert.equal(report.cards.lowStockProducts,
    report.charts.stockAlerts.reduce((sum: number, row: { lowStockProducts: number }) => sum + row.lowStockProducts, 0));
  assert.equal(report.cards.nearExpiryBatches,
    report.charts.stockAlerts.reduce((sum: number, row: { nearExpiryBatches: number }) => sum + row.nearExpiryBatches, 0));
  for (const view of ["inventory", "warehouses"]) {
    const result = await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard/export")
      .query({ ...dates, view, format: "csv" }).buffer(true).parse(parseBytes).expect(200);
    for (const warehouse of FIXTURE_WAREHOUSES) {
      assert.ok(result.body.toString().includes(`${warehouse.name},${warehouse.code},`));
    }
  }
});

test("payment and selected warehouse filters apply equally to totals, daily rows, and page exports", async () => {
  const filters = { ...dates, paymentStatus: "PENDING", warehouseId: FIXTURE_WAREHOUSES[0].id };
  const response = await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard").query(filters).expect(200);
  const report = response.body.data;
  const matching = fixture.orders.filter((order) => order.paymentStatus === filters.paymentStatus && order.warehouseId === filters.warehouseId);
  assert.equal(report.cards.totalOrders, matching.length);
  assert.equal(report.cards.revenue, matching.reduce((sum, order) => sum + order.grandTotal, 0));
  assert.equal(report.charts.revenueByDay.reduce((sum: number, row: { revenue: number }) => sum + row.revenue, 0), report.cards.revenue);
  assert.equal(report.charts.stockAlerts.length, 1);
  assert.equal(report.warehouseOptions.length, 10);
  for (const format of ["csv", "pdf"]) {
    const exported = await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard/export")
      .query({ ...filters, view: "sales", format }).buffer(true).parse(parseBytes).expect(200);
    assert.ok(exported.body.toString().includes("Pending order value"));
    assert.ok(!exported.body.toString().includes("Paid revenue"));
  }
});

test("reports-only permission can load authorized warehouse options independently of selection", async () => {
  const auth = { ...fixtureAuth(), role: AdminRoleCode.OrderManager };
  const assigned = FIXTURE_WAREHOUSES.slice(0, 2).map((warehouse) => warehouse.id);
  const restricted = await createReportsHttpFixture({ auth, assignedWarehouseIds: assigned });
  try {
    const result = await request(restricted.app.getHttpServer()).get("/admin/reports/dashboard")
      .query({ ...dates, warehouseId: assigned[0] }).expect(200);
    assert.deepEqual(result.body.data.warehouseOptions.map((warehouse: { id: string }) => warehouse.id), assigned);
    assert.equal(result.body.data.charts.warehouseStockSummary.length, 1);
    await request(restricted.app.getHttpServer()).get("/admin/reports/dashboard/export")
      .query({ ...dates, warehouseId: FIXTURE_WAREHOUSES[2].id, view: "warehouses" }).expect(403);
  } finally { await restricted.app.close(); }
});

test("report exports reject invalid view and report dates, and still require ReportsRead", async () => {
  await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard/export")
    .query({ ...dates, view: "unknown" }).expect(400);
  await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard")
    .query({ dateFrom: FIXTURE_DATE_TO, dateTo: FIXTURE_DATE_FROM }).expect(400);
  await request(fixture.app.getHttpServer()).get("/admin/reports/dashboard")
    .query({ dateFrom: "2026-02-31", dateTo: FIXTURE_DATE_TO }).expect(400);
  const forbidden = await createReportsHttpFixture({ auth: fixtureAuth([]) });
  try {
    await request(forbidden.app.getHttpServer()).get("/admin/reports/dashboard/export")
      .query({ ...dates, view: "orders" }).expect(403);
  } finally { await forbidden.app.close(); }
});

test("omitted dates consistently use a thirty-day range, with an explicit UTC today date", async () => {
  const local = createReportsServiceFixture();
  for (const query of [{}, { dateTo: FIXTURE_DATE_TO }]) {
    const report = await local.service.getDashboard(query, fixtureAuth());
    assert.equal(report.charts.ordersByDay.length, 30);
    assert.equal(report.charts.ordersByDay[0].date, report.filters.dateFrom);
    assert.equal(report.charts.ordersByDay.at(-1)?.date, report.filters.dateTo);
    assert.equal(report.charts.ordersByDay.reduce((sum, point) => sum + point.orders, 0), report.cards.totalOrders);
    assert.equal(report.charts.revenueByDay.reduce((sum, point) => sum + point.revenue, 0), report.cards.revenue);
    assert.equal(report.todayDate, new Date().toISOString().slice(0, 10));
  }
  const fromOnly = await local.service.getDashboard({ dateFrom: FIXTURE_DATE_FROM }, fixtureAuth());
  assert.equal(fromOnly.charts.ordersByDay[0].date, FIXTURE_DATE_FROM);
  assert.equal(fromOnly.charts.ordersByDay.at(-1)?.date, fromOnly.todayDate);
  assert.equal(fromOnly.charts.ordersByDay.reduce((sum, point) => sum + point.orders, 0), fromOnly.cards.totalOrders);
});

test("an unassigned report reader receives no warehouse rows or order values", async () => {
  const local = createReportsServiceFixture();
  const report = await local.service.getDashboard(dates, { ...fixtureAuth(), role: AdminRoleCode.OrderManager });
  assert.deepEqual(report.warehouseOptions, []);
  assert.deepEqual(report.charts.warehouseStockSummary, []);
  assert.deepEqual(report.charts.stockAlerts, []);
  assert.equal(report.cards.totalOrders, 0);
  assert.equal(report.cards.revenue, 0);
});
