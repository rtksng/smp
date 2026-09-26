import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsDashboard } from "./reports-dashboard";
import type { DashboardReport, ReportView } from "../../lib/reports-management";

const { request, requestResponse, hasPermission } = vi.hoisted(() => ({
  request: vi.fn(),
  requestResponse: vi.fn(),
  hasPermission: vi.fn()
}));

vi.mock("../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request, requestResponse }, hasPermission })
}));

const report: DashboardReport = {
  todayDate: "2026-09-03",
  warehouseOptions: [{ id: "warehouse-1", name: "Delhi warehouse", code: "DEL-01" }],
  filters: {
    dateFrom: "2026-07-05", dateTo: "2026-09-03", nearExpiryDays: 60,
    orderStatus: null, paymentStatus: "PENDING", warehouseId: "warehouse-1"
  },
  cards: {
    activeCustomers: 3, activeDeliveryPartners: 2, activeWarehouses: 1,
    lowStockProducts: 2, nearExpiryBatches: 1, pendingOrders: 7,
    revenue: 1250, todayOrders: 0, totalOrders: 8
  },
  charts: {
    ordersByDay: [{ date: "2026-07-05", orders: 8 }],
    revenueByDay: [{ date: "2026-07-05", revenue: 1250 }],
    topSellingProducts: [{ productId: "product-1", name: "Curved Forceps", sku: "CF-1", quantity: 5, revenue: 1250 }],
    stockAlerts: [{ warehouseId: "warehouse-1", warehouseName: "Delhi warehouse", warehouseCode: "DEL-01", lowStockProducts: 2, nearExpiryBatches: 1 }],
    warehouseStockSummary: [{ warehouseId: "warehouse-1", warehouseName: "Delhi warehouse", warehouseCode: "DEL-01", lowStockProducts: 2, nearExpiryBatches: 1, activeBatches: 3, availableQuantity: 25, reservedQuantity: 4 }]
  }
};

function renderReport(view: ReportView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ReportsDashboard view={view} /></QueryClientProvider>);
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportsDashboard
        eyebrow="Dashboard"
        hideSectionNavigation
        title="Admin dashboard"
      />
    </QueryClientProvider>
  );
}

async function readDownloadedBlob() {
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
  return { blob, content };
}

const reportSections = {
  orders: "Orders by day", sales: "Pending order value by day", products: "Top selling products",
  inventory: "Stock alerts", warehouses: "Warehouse stock summary"
} as const;

describe("Reports page integration", () => {
  beforeEach(() => {
    request.mockReset().mockResolvedValue(report);
    requestResponse.mockReset().mockRejectedValue(new Error("property view should not exist"));
    hasPermission.mockReset().mockReturnValue(true);
    vi.stubGlobal("ResizeObserver", class {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:test-report");
      static revokeObjectURL = vi.fn();
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the main dashboard with filtered KPI links and a complete export", async () => {
    renderDashboard();

    const metrics = await screen.findByRole("region", {
      name: "Dashboard key metrics"
    });
    const controls = screen.getByRole("region", { name: "Dashboard controls" });
    expect(screen.queryByRole("navigation", { name: "Report sections" })).toBeNull();
    expect(controls).toHaveAttribute("data-dashboard-layout", "responsive");
    expect(
      within(controls).getAllByRole("button").map((button) => button.textContent)
    ).toEqual(["Add filter", "CSV", "PDF", "Refresh"]);

    const revenueHref = within(metrics)
      .getByRole("link", { name: /Pending order value/ })
      .getAttribute("href");
    const revenueUrl = new URL(revenueHref!, "http://localhost");
    expect(revenueUrl.searchParams.get("dateFrom")).toBe("2026-07-05");
    expect(revenueUrl.searchParams.get("dateTo")).toBe("2026-09-03");
    expect(revenueUrl.searchParams.get("paymentStatus")).toBe("PENDING");
    expect(revenueUrl.searchParams.get("warehouseId")).toBe("warehouse-1");

    const inventoryUrl = new URL(
      within(metrics)
        .getByRole("link", { name: /Inventory risk/ })
        .getAttribute("href")!,
      "http://localhost"
    );
    expect(inventoryUrl.pathname).toBe("/inventory");
    expect(inventoryUrl.searchParams.get("lowStock")).toBe("true");
    expect(inventoryUrl.searchParams.get("warehouseId")).toBe("warehouse-1");

    expect(screen.getByRole("region", { name: "Dashboard charts" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    await waitFor(
      () => expect(URL.createObjectURL).toHaveBeenCalledTimes(1),
      { timeout: 10_000 }
    );
    const { content } = await readDownloadedBlob();
    expect(content).toContain("Dashboard report");
    expect(content).toContain("Orders by day");
    expect(content).toContain("Top selling products");
    expect(content).toContain("Warehouse stock summary");
  }, 30_000);

  it("keeps main-dashboard resource drilldowns disabled for reports-only staff", async () => {
    hasPermission.mockImplementation((permission) => permission === "reports.read");
    renderDashboard();

    const metrics = await screen.findByRole("region", {
      name: "Dashboard key metrics"
    });
    expect(within(metrics).queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Curved Forceps" })).toBeNull();
    expect(screen.getAllByText("Curved Forceps").length).toBeGreaterThan(0);
    expect(screen.getByText("Open inventory")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByText("Open warehouses")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("link", { name: "Open sales report" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open product report" })).toBeInTheDocument();
  });

  it("validates dashboard filters before requesting another report", async () => {
    renderDashboard();
    await screen.findByRole("region", { name: "Dashboard key metrics" });
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const drawer = await screen.findByRole("dialog", { name: "Report filters" });

    fireEvent.change(within(drawer).getByLabelText("From"), {
      target: { value: "2026-09-04" }
    });
    fireEvent.change(within(drawer).getByLabelText("To"), {
      target: { value: "2026-09-03" }
    });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply filters" }));

    expect(await within(drawer).findByRole("alert")).toHaveTextContent(
      "Start date must be before end date."
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  for (const view of ["orders", "sales", "products", "inventory", "warehouses"] as const) {
    it.each(["CSV", "PDF"])(`${view} downloads its own %s from the displayed report without another API request`, async (format) => {
      renderReport(view);
      await screen.findByRole("table");
      const navigation = screen.getByRole("navigation", { name: "Report sections" });
      expect(within(navigation).getAllByRole("link")).toHaveLength(5);
      expect(within(navigation).queryByRole("link", { name: "Overview" })).toBeNull();
      const requestCount = request.mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: format }));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
      const { blob, content } = await readDownloadedBlob();
      expect(blob.type).toBe(format === "PDF" ? "application/pdf" : "text/csv; charset=utf-8");
      expect(content).toContain(reportSections[view]);
      for (const other of Object.keys(reportSections) as Array<keyof typeof reportSections>) {
        if (other !== view) expect(content).not.toContain(reportSections[other]);
      }
      const value = { orders: "8", sales: "1250.00", products: "CF-1", inventory: "DEL-01", warehouses: "25" }[view];
      expect(content).toContain(value);
      expect(content.startsWith(format === "PDF" ? "%PDF-1.4\n" : `${view[0]!.toUpperCase()}${view.slice(1)} report`)).toBe(true);
      expect(requestResponse).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledTimes(requestCount);
      expect(request.mock.calls.every(([path]) => path === "/admin/reports/dashboard")).toBe(true);
    });
  }

  it("renders report data and exports for reports-only staff without forbidden drilldowns", async () => {
    hasPermission.mockImplementation((permission) => permission === "reports.read");
    renderReport("inventory");
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Delhi warehouse")).toBeInTheDocument();
    expect(within(table).queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "CSV" })).toBeEnabled();
    expect(request.mock.calls.every(([path]) => path === "/admin/reports/dashboard")).toBe(true);
  });

  it("uses the counted UTC day and pending status set in metric links", async () => {
    renderReport("orders");
    await screen.findByRole("table");
    const today = new URL(screen.getByRole("link", { name: /Today orders\s*0/ }).getAttribute("href")!, "http://localhost");
    expect(today.searchParams.get("dateFrom")).toBe("2026-09-03");
    expect(today.searchParams.get("dateTo")).toBe("2026-09-03");
    const pending = new URL(screen.getByRole("link", { name: /Pending orders\s*7/ }).getAttribute("href")!, "http://localhost");
    expect(pending.searchParams.get("pendingOnly")).toBe("true");
    expect(pending.searchParams.get("dateFrom")).toBe("2026-07-05");
  });

  it("exports legacy report responses and derives warehouse choices from their displayed rows", async () => {
    request.mockResolvedValue({ cards: report.cards, charts: report.charts });
    renderReport("warehouses");
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect((await readDownloadedBlob()).content).toContain("Delhi warehouse");
    expect(requestResponse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const drawer = await screen.findByRole("dialog", { name: "Report filters" });
    expect(within(drawer).getByRole("button", { name: "All visible warehouses Warehouse" })).toBeEnabled();
    expect(within(drawer).getByRole("option", { name: "Delhi warehouse DEL-01", hidden: true }))
      .toHaveValue("warehouse-1");
  });

  it("shows an export error if the browser cannot create the download", async () => {
    renderReport("orders");
    await screen.findByRole("table");
    vi.mocked(URL.createObjectURL).mockImplementation(() => { throw new Error("Download unavailable"); });
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Download unavailable");
    expect(requestResponse).not.toHaveBeenCalled();
  });
});
