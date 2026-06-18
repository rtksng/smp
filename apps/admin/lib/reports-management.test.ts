import { describe, expect, it } from "vitest";
import {
  buildDashboardReportQuery,
  buildReportDrilldownHref,
  buildReportExportUrl,
  createDefaultReportFilters,
  dashboardReportDownloadFilename,
  formatReportCurrency,
  getDashboardEmptyState,
  reportDateRangeError,
  type DashboardReport
} from "./reports-management";

const emptyReport: DashboardReport = {
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

  it("builds report export URLs and stable download filenames", () => {
    const filters = {
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      nearExpiryDays: "45",
      orderStatus: "DELIVERED" as const,
      paymentStatus: "PAID" as const,
      warehouseId: "warehouse-1"
    };

    expect(String(buildReportExportUrl(filters, "csv"))).toBe(
      "/admin/reports/dashboard/export?dateFrom=2026-05-01&dateTo=2026-05-26&format=csv&nearExpiryDays=45&orderStatus=DELIVERED&paymentStatus=PAID&warehouseId=warehouse-1"
    );
    expect(dashboardReportDownloadFilename(filters, "pdf")).toBe(
      "dashboard-report-2026-05-01-to-2026-05-26.pdf"
    );
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
  });
});
