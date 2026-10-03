import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDashboardReportQuery,
  buildReportDrilldownHref,
  buildReportExportData,
  buildTodayOrdersHref,
  canAccessReportHref,
  createDefaultReportFilters,
  downloadDashboardReportExport,
  formatReportCurrency,
  getDashboardEmptyState,
  getReportRevenueContext,
  getReportWarehouseOptions,
  reportDateRangeError,
  resolveReportFilters,
  type DashboardReport
} from "./reports-management";

const emptyReport: DashboardReport = {
  todayDate: "2026-09-03",
  warehouseOptions: [],
  cards: {
    activeCustomers: 0,
    activeDeliveryPartners: 0,
    activeWarehouses: 0,
    lowStockProducts: 0,
    nearExpiryBatches: 0,
    pendingOrders: 0,
    revenue: 0,
    todayOrders: 0,
    totalOrders: 0
  },
  charts: {
    ordersByDay: [],
    revenueByDay: [],
    stockAlerts: [],
    topSellingProducts: [],
    warehouseStockSummary: []
  }
};

const exportReport: DashboardReport = {
  ...emptyReport,
  filters: {
    dateFrom: "2026-08-05", dateTo: "2026-09-03", nearExpiryDays: 60,
    orderStatus: null, paymentStatus: "PENDING", warehouseId: "warehouse-1"
  },
  cards: {
    ...emptyReport.cards, totalOrders: 7, pendingOrders: 4, revenue: 123.45,
    lowStockProducts: 2, nearExpiryBatches: 1, activeWarehouses: 1
  },
  charts: {
    ordersByDay: [{ date: "2026-08-10", orders: 7 }],
    revenueByDay: [{ date: "2026-08-10", revenue: 123.45 }],
    topSellingProducts: [{ productId: "product-1", name: 'Forceps, curved "sterile"', sku: "CF-1", quantity: 3, revenue: 234.50 }],
    stockAlerts: [{ warehouseId: "warehouse-1", warehouseName: "Delhi warehouse", warehouseCode: "DEL-01", lowStockProducts: 2, nearExpiryBatches: 1 }],
    warehouseStockSummary: [{ warehouseId: "warehouse-1", warehouseName: "Delhi warehouse", warehouseCode: "DEL-01", lowStockProducts: 2, nearExpiryBatches: 1, activeBatches: 3, availableQuantity: 25, reservedQuantity: 4 }]
  }
};

const reportSections = {
  orders: "Orders by day", sales: "Pending order value by day", products: "Top selling products",
  inventory: "Stock alerts", warehouses: "Warehouse stock summary"
} as const;

function mockDownload() {
  const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:report-download");
  const revokeObjectURL = vi.fn();
  const OriginalURL = globalThis.URL;
  vi.stubGlobal("URL", class extends OriginalURL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL, click };
}

async function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("reports management helpers", () => {
  it("defaults dashboard filters to the last 30 days", () => {
    expect(createDefaultReportFilters(new Date("2026-05-26T12:00:00.000Z"))).toEqual({
      dateFrom: "2026-04-27",
      dateTo: "2026-05-26",
      nearExpiryDays: "30",
      orderStatus: "",
      paymentStatus: "",
      warehouseId: ""
    });
  });

  it("normalizes report filters into the dashboard API query", () => {
    expect(
      buildDashboardReportQuery({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-26",
        nearExpiryDays: "45",
        orderStatus: "DELIVERED",
        paymentStatus: "PAID",
        warehouseId: "warehouse-1"
      })
    ).toEqual({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      nearExpiryDays: 45,
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
      warehouseId: "warehouse-1"
    });

    expect(
      buildDashboardReportQuery({
        dateFrom: "",
        dateTo: "",
        nearExpiryDays: "0",
        orderStatus: "",
        paymentStatus: "",
        warehouseId: ""
      })
    ).toEqual({});
  });

  it("validates date ranges before applying report filters", () => {
    expect(
      reportDateRangeError({
        dateFrom: "2026-05-27",
        dateTo: "2026-05-26",
        nearExpiryDays: "30",
        orderStatus: "",
        paymentStatus: "",
        warehouseId: ""
      })
    ).toBe("Start date must be before end date.");
    expect(
      reportDateRangeError({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-26",
        nearExpiryDays: "30",
        orderStatus: "",
        paymentStatus: "",
        warehouseId: ""
      })
    ).toBeNull();
  });

  it("detects an empty dashboard report and formats rupee amounts", () => {
    expect(getDashboardEmptyState(emptyReport)).toBe("No report data matches the selected filters.");
    expect(
      getDashboardEmptyState({
        ...emptyReport,
        cards: {
          ...emptyReport.cards,
          totalOrders: 1
        }
      })
    ).toBeNull();
    expect(formatReportCurrency(128520.25)).toBe("₹1,28,520.25");
  });

  it("preserves selected payment status for sales amounts and links", () => {
    const filters = createDefaultReportFilters();
    expect(getReportRevenueContext(filters)).toEqual({
      label: "Paid revenue",
      orderLinkLabel: "Open paid orders",
      paymentStatus: "PAID"
    });
    const context = getReportRevenueContext({ ...filters, paymentStatus: "PENDING" });
    expect(context).toEqual({
      label: "Pending order value",
      orderLinkLabel: "Open pending orders",
      paymentStatus: "PENDING"
    });
    expect(buildReportDrilldownHref("orders", { ...filters, paymentStatus: context.paymentStatus }))
      .toContain("paymentStatus=PENDING");
  });

  it("uses the report's resolved date bounds for drilldowns and exports", () => {
    const filters = { ...createDefaultReportFilters(), dateFrom: "", dateTo: "" };
    const resolved = resolveReportFilters(filters, {
      ...emptyReport,
      filters: {
        dateFrom: "2026-08-05",
        dateTo: "2026-09-03",
        nearExpiryDays: 30,
        orderStatus: null,
        paymentStatus: null,
        warehouseId: null
      }
    });
    expect(resolved).toMatchObject({ dateFrom: "2026-08-05", dateTo: "2026-09-03" });
    expect(buildReportDrilldownHref("orders", resolved))
      .toContain("dateFrom=2026-08-05&dateTo=2026-09-03");
    expect(buildReportExportData(resolved, emptyReport).filters)
      .toMatchObject({ dateFrom: "2026-08-05", dateTo: "2026-09-03" });
  });

  it("narrows Today and Pending drilldowns without dropping other filters", () => {
    const filters = {
      ...createDefaultReportFilters(),
      orderStatus: "CANCELLED" as const,
      paymentStatus: "PENDING" as const,
      warehouseId: "warehouse-1"
    };
    const todayUrl = new URL(buildTodayOrdersHref(filters, "2026-09-02"), "http://localhost");
    expect(Object.fromEntries(todayUrl.searchParams)).toEqual({
      dateFrom: "2026-09-02",
      dateTo: "2026-09-02",
      paymentStatus: "PENDING",
      status: "CANCELLED",
      warehouseId: "warehouse-1"
    });
    const pendingUrl = new URL(buildReportDrilldownHref("orders-pending", filters), "http://localhost");
    expect(pendingUrl.searchParams.get("pendingOnly")).toBe("true");
    expect(pendingUrl.searchParams.get("status")).toBe("CANCELLED");
    expect(pendingUrl.searchParams.get("warehouseId")).toBe("warehouse-1");
    expect(pendingUrl.searchParams.get("paymentStatus")).toBe("PENDING");
  });

  it("forwards expiry days and rejects an invalid expiry window", () => {
    const filters = { ...createDefaultReportFilters(), nearExpiryDays: "60" };
    expect(buildReportDrilldownHref("inventory-near-expiry", filters, "warehouse-2"))
      .toBe("/inventory?nearExpiry=true&nearExpiryDays=60&warehouseId=warehouse-2");
    for (const nearExpiryDays of ["", "0", "366", "1.5", "abc"]) {
      expect(reportDateRangeError({ ...filters, nearExpiryDays }))
        .toBe("Expiry window must be a whole number between 1 and 365 days.");
    }
  });

  it("only allows drilldowns with the destination's permission", () => {
    const reportOnly = (permission: string) => permission === "reports.read";
    for (const href of ["/orders?pendingOnly=true", "/inventory", "/products/product-1/edit", "/warehouses", "/customers"]) {
      expect(canAccessReportHref(href, reportOnly)).toBe(false);
    }
    expect(canAccessReportHref("/reports/orders", reportOnly)).toBe(true);
    expect(canAccessReportHref("/warehouses/warehouse-2", reportOnly)).toBe(false);
    expect(canAccessReportHref("/warehouses/warehouse-2", (permission) => permission === "warehouse.read"))
      .toBe(true);
    expect(canAccessReportHref("/orders?dateFrom=2026-09-03", (permission) => permission === "orders.read"))
      .toBe(true);
  });

  for (const view of ["orders", "sales", "products", "inventory", "warehouses"] as const) {
    it.each(["csv", "pdf"] as const)(`downloads ${view} as real %s with only the visible snapshot data`, async (format) => {
      const { createObjectURL, revokeObjectURL, click } = mockDownload();
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const filename = await downloadDashboardReportExport(createDefaultReportFilters(), format, exportReport, view);
      const blob = createObjectURL.mock.calls[0]![0];
      const content = await readBlob(blob);

      expect(filename).toBe(`${view}-report-2026-08-05-to-2026-09-03.${format}`);
      expect(blob.type).toBe(format === "pdf" ? "application/pdf" : "text/csv; charset=utf-8");
      expect(content).toContain(reportSections[view]);
      for (const other of Object.keys(reportSections) as Array<keyof typeof reportSections>) {
        if (other !== view) expect(content).not.toContain(reportSections[other]);
      }
      const ownValue = { orders: "2026-08-10", sales: "123.45", products: "CF-1", inventory: "DEL-01", warehouses: "25" }[view];
      expect(content).toContain(ownValue);
      expect(content).not.toContain('{"type":"Buffer"');
      if (format === "pdf") {
        expect(content.startsWith("%PDF-1.4\n")).toBe(true);
        expect(content.endsWith("%%EOF")).toBe(true);
        const xref = Number(content.match(/startxref\n(\d+)/)?.[1]);
        expect(content.slice(xref).startsWith("xref\n")).toBe(true);
      } else if (view === "products") {
        expect(content).toContain('"Forceps, curved ""sterile""",CF-1,3,234.50');
      }
      expect(fetch).not.toHaveBeenCalled();
      expect(click).toHaveBeenCalledOnce();
      expect(document.querySelector("a[download]")).toBeNull();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:report-download");
    });
  }

  it("retains the clicked snapshot while the renderer loads", async () => {
    const { createObjectURL } = mockDownload();
    const mutableReport = structuredClone(exportReport);
    const pendingDownload = downloadDashboardReportExport(createDefaultReportFilters(), "csv", mutableReport, "sales");
    mutableReport.cards.revenue = 9999;
    mutableReport.charts.revenueByDay[0]!.revenue = 9999;
    await pendingDownload;
    const content = await readBlob(createObjectURL.mock.calls[0]![0]);
    expect(content).toContain("123.45");
    expect(content).not.toContain("9999");
  });

  it("normalizes legacy responses without inventing or refetching report rows", async () => {
    const { createObjectURL } = mockDownload();
    const legacy: DashboardReport = { cards: exportReport.cards, charts: exportReport.charts };
    const filters = {
      ...createDefaultReportFilters(new Date("2026-09-03T12:00:00Z")),
      warehouseId: "warehouse-1", nearExpiryDays: "60"
    };
    const data = buildReportExportData(filters, legacy);
    expect(data.todayDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.cards).toEqual(legacy.cards);
    expect(data.charts).toEqual(legacy.charts);
    expect(getReportWarehouseOptions(legacy)).toEqual([
      { id: "warehouse-1", name: "Delhi warehouse", code: "DEL-01" }
    ]);
    expect(data.filters).toEqual({
      dateFrom: "2026-08-05", dateTo: "2026-09-03", nearExpiryDays: 60,
      orderStatus: null, paymentStatus: null, warehouseId: "warehouse-1"
    });
    await expect(downloadDashboardReportExport(filters, "pdf", legacy, "inventory"))
      .resolves.toBe("inventory-report-2026-08-05-to-2026-09-03.pdf");
    expect(await readBlob(createObjectURL.mock.calls[0]![0])).toContain("Delhi warehouse");
  });

  it("builds drill-down links into existing admin resources", () => {
    const filters = {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      nearExpiryDays: "30",
      orderStatus: "DELIVERED" as const,
      paymentStatus: "PAID" as const,
      warehouseId: "warehouse-1"
    };

    expect(buildReportDrilldownHref("orders", filters)).toBe(
      "/orders?dateFrom=2026-05-01&dateTo=2026-05-26&paymentStatus=PAID&status=DELIVERED&warehouseId=warehouse-1"
    );
    expect(buildReportDrilldownHref("inventory-low-stock", filters, "warehouse-2")).toBe(
      "/inventory?lowStock=true&warehouseId=warehouse-2"
    );
    expect(buildReportDrilldownHref("product", filters, "product-1")).toBe(
      "/products/product-1/edit"
    );
    expect(buildReportDrilldownHref("warehouse", filters, "warehouse-2")).toBe(
      "/warehouses/warehouse-2"
    );
    expect(buildReportDrilldownHref("warehouse", filters)).toBe(
      "/warehouses?warehouseId=warehouse-1"
    );
  });
});
