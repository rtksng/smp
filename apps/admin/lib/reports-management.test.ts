import { describe, expect, it } from "vitest";
import {
  buildDashboardReportQuery,
  createDefaultReportFilters,
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
      warehouseId: ""
    });
  });

  it("normalizes report filters into the dashboard API query", () => {
    expect(
      buildDashboardReportQuery({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-26",
        nearExpiryDays: "45",
        warehouseId: "warehouse-1"
      })
    ).toEqual({
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      nearExpiryDays: 45,
      warehouseId: "warehouse-1"
    });

    expect(
      buildDashboardReportQuery({
        dateFrom: "",
        dateTo: "",
        nearExpiryDays: "0",
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
        warehouseId: ""
      })
    ).toBe("Start date must be before end date.");
    expect(
      reportDateRangeError({
        dateFrom: "2026-05-01",
        dateTo: "2026-05-26",
        nearExpiryDays: "30",
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
});
