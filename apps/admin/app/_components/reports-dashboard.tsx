"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Download,
  ExternalLink,
  FileText,
  IndianRupee,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Warehouse
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useAdminSession } from "../../lib/admin-session";
import {
  buildDashboardReportQuery,
  buildReportDrilldownHref,
  createDefaultReportFilters,
  downloadDashboardReportExport,
  formatReportCurrency,
  formatReportNumber,
  formatReportStatusLabel,
  getDashboardEmptyState,
  reportDateRangeError,
  REPORT_ORDER_STATUSES,
  REPORT_PAYMENT_STATUSES,
  type DashboardCards,
  type DashboardReport,
  type DashboardReportFilters,
  type ReportExportFormat,
  type RevenueByDayPoint,
  type StockAlertPoint,
  type TopSellingProductPoint,
  type WarehouseStockSummaryPoint
} from "../../lib/reports-management";
import type { WarehouseListResponse } from "../../lib/warehouse-management";

export type ReportView =
  | "overview"
  | "orders"
  | "sales"
  | "products"
  | "inventory"
  | "warehouses";

type ReportsDashboardProps = {
  eyebrow?: string;
  hideSectionNavigation?: boolean;
  title?: string;
  view?: ReportView;
};

type ReportMetricCard = {
  href?: string;
  icon: ReactNode;
  label: string;
  tone: "neutral" | "primary" | "warning";
  value: string;
};

const reportSections: Array<{
  description: string;
  href: string;
  id: ReportView;
  title: string;
}> = [
  {
    description: "Operational summary across orders, revenue, inventory, and coverage.",
    href: "/reports",
    id: "overview",
    title: "Overview"
  },
  {
    description: "Daily order volume and order workflow drilldowns.",
    href: "/reports/orders",
    id: "orders",
    title: "Orders"
  },
  {
    description: "Paid revenue by day with order drilldowns.",
    href: "/reports/sales",
    id: "sales",
    title: "Sales"
  },
  {
    description: "Top-selling products ranked by quantity and revenue.",
    href: "/reports/products",
    id: "products",
    title: "Products"
  },
  {
    description: "Low-stock and near-expiry alerts by warehouse.",
    href: "/reports/inventory",
    id: "inventory",
    title: "Inventory"
  },
  {
    description: "Warehouse stock coverage, reservations, batches, and alerts.",
    href: "/reports/warehouses",
    id: "warehouses",
    title: "Warehouses"
  }
];

const reportCopy: Record<ReportView, { summary: string; title: string }> = {
  inventory: {
    summary: "Track low-stock and near-expiry alerts in a focused warehouse table.",
    title: "Inventory reports"
  },
  orders: {
    summary: "Review daily order volume and open filtered order lists from each row.",
    title: "Order reports"
  },
  overview: {
    summary: "Choose a focused report page instead of scanning one long dashboard.",
    title: "Operational reports"
  },
  products: {
    summary: "Rank product movement by units sold and revenue for the selected range.",
    title: "Product reports"
  },
  sales: {
    summary: "Review paid revenue trends by day with quick access to matching orders.",
    title: "Sales reports"
  },
  warehouses: {
    summary: "Compare available stock, reserved stock, batches, and alerts by warehouse.",
    title: "Warehouse reports"
  }
};

export function ReportsDashboard({
  eyebrow = "Reports",
  hideSectionNavigation = false,
  title,
  view = "overview"
}: ReportsDashboardProps) {
  const { api, session } = useAdminSession();
  const [draftFilters, setDraftFilters] = useState<DashboardReportFilters>(() =>
    createDefaultReportFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<DashboardReportFilters>(() =>
    createDefaultReportFilters()
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(
    null
  );
  const reportQuery = useMemo(
    () => buildDashboardReportQuery(appliedFilters),
    [appliedFilters]
  );

  const dashboardQuery = useQuery({
    queryFn: () =>
      api.request<DashboardReport>("/admin/reports/dashboard", {
        query: reportQuery
      }),
    queryKey: ["admin", "reports", "dashboard", reportQuery]
  });
  const warehousesQuery = useQuery({
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100,
          status: "ACTIVE"
        }
      }),
    queryKey: ["admin", "reports", "warehouses"]
  });

  const report = dashboardQuery.data;
  const warehouses = warehousesQuery.data?.items ?? [];
  const emptyState = getDashboardEmptyState(report);
  const errorMessage =
    dashboardQuery.error instanceof Error
      ? dashboardQuery.error.message
      : "Unable to load dashboard reports.";

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rangeError = reportDateRangeError(draftFilters);

    if (rangeError) {
      setFilterError(rangeError);
      return;
    }

    setFilterError(null);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const defaults = createDefaultReportFilters();

    setFilterError(null);
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
  }

  async function handleExport(format: ReportExportFormat) {
    if (!session) {
      setExportError("Admin session is required to export reports.");
      return;
    }

    setExportError(null);
    setExportingFormat(format);

    try {
      await downloadDashboardReportExport(
        appliedFilters,
        format,
        session.tokens.accessToken
      );
    } catch (error) {
      setExportError(getErrorMessage(error) ?? "Unable to export dashboard report.");
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <>
      <section className="panel reportControlPanel">
        {hideSectionNavigation ? null : <ReportSectionNav active={view} />}
        <PageHeader
          className="reportPageHeader"
          actions={
            <div className="reportExportActions">
              <Button
                className="iconTextButton"
                disabled={Boolean(exportingFormat)}
                onClick={() => void handleExport("csv")}
                type="button"
                variant="outline"
              >
                <Download aria-hidden size={16} />
                <span>{exportingFormat === "csv" ? "Exporting..." : "CSV"}</span>
              </Button>
              <Button
                className="iconTextButton"
                disabled={Boolean(exportingFormat)}
                onClick={() => void handleExport("pdf")}
                type="button"
                variant="outline"
              >
                <FileText aria-hidden size={16} />
                <span>{exportingFormat === "pdf" ? "Exporting..." : "PDF"}</span>
              </Button>
              <Button
                className="iconTextButton"
                disabled={dashboardQuery.isFetching}
                onClick={() => void dashboardQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>{dashboardQuery.isFetching ? "Refreshing..." : "Refresh"}</span>
              </Button>
            </div>
          }
          eyebrow={eyebrow}
          summary={reportCopy[view].summary}
          title={title ?? reportCopy[view].title}
        />
        <ReportFilterForm
          filters={draftFilters}
          isWarehouseLoading={warehousesQuery.isLoading}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={applyFilters}
          warehouses={warehouses}
        />
        {filterError ? (
          <p className="formError" role="alert">
            {filterError}
          </p>
        ) : null}
        {warehousesQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
          </p>
        ) : null}
        {exportError ? (
          <p className="formError" role="alert">
            {exportError}
          </p>
        ) : null}
      </section>

      {dashboardQuery.isLoading ? <LoadingState label="Loading reports..." /> : null}
      {dashboardQuery.isError ? (
        <Card>
          <CardContent>
            <p className="formError" role="alert">
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {emptyState ? <EmptyState body={emptyState} title="No report data" /> : null}

      {report ? (
        <>
          <MetricGrid cards={report.cards} filters={appliedFilters} view={view} />
          {view === "overview" ? (
            <ReportHub cards={report.cards} />
          ) : (
            <ReportViewTable filters={appliedFilters} report={report} view={view} />
          )}
        </>
      ) : null}
    </>
  );
}

function ReportSectionNav({ active }: { active: ReportView }) {
  return (
    <nav className="reportSectionNav" aria-label="Report sections">
      {reportSections.map((section) => (
        <Link
          aria-current={active === section.id ? "page" : undefined}
          href={section.href}
          key={section.id}
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}

function ReportHub({ cards }: { cards: DashboardCards }) {
  return (
    <section className="reportHubGrid">
      {reportSections
        .filter((section) => section.id !== "overview")
        .map((section) => (
          <Link className="reportHubCard" href={section.href} key={section.id}>
            <span>{section.title}</span>
            <strong>{getReportSectionMetric(section.id, cards)}</strong>
            <p>{section.description}</p>
          </Link>
        ))}
    </section>
  );
}

function ReportFilterForm({
  filters,
  isWarehouseLoading,
  onChange,
  onReset,
  onSubmit,
  warehouses
}: {
  filters: DashboardReportFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: DashboardReportFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="reportFilters" onSubmit={onSubmit}>
      <Label>
        From
        <Input
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
      </Label>
      <Label>
        To
        <Input
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
      </Label>
      <Label>
        Warehouse
        <Select
          aria-label="Warehouse"
          disabled={isWarehouseLoading}
          onValueChange={(warehouseId) => onChange({ ...filters, warehouseId })}
          value={filters.warehouseId}
        >
          <SelectTrigger>
            <SelectValue placeholder="All visible warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All visible warehouses</SelectItem>
            {warehouses.map((warehouse) => (
              <SelectItem
                key={warehouse.id}
                textValue={`${warehouse.name} ${warehouse.code}`}
                value={warehouse.id}
              >
                {warehouse.name} ({warehouse.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Order status
        <Select
          aria-label="Order status"
          onValueChange={(orderStatus) =>
            onChange({
              ...filters,
              orderStatus: orderStatus as DashboardReportFilters["orderStatus"]
            })
          }
          value={filters.orderStatus}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any status</SelectItem>
            {REPORT_ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatReportStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Payment status
        <Select
          aria-label="Payment status"
          onValueChange={(paymentStatus) =>
            onChange({
              ...filters,
              paymentStatus: paymentStatus as DashboardReportFilters["paymentStatus"]
            })
          }
          value={filters.paymentStatus}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any payment</SelectItem>
            {REPORT_PAYMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatReportStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Expiry window
        <Input
          inputMode="numeric"
          max={365}
          min={1}
          onChange={(event) =>
            onChange({ ...filters, nearExpiryDays: event.target.value })
          }
          type="number"
          value={filters.nearExpiryDays}
        />
      </Label>
      <div className="productFilterActions">
        <Button className="iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </Button>
        <Button onClick={onReset} type="button" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
}

function MetricGrid({
  cards,
  filters,
  view
}: {
  cards: DashboardCards;
  filters: DashboardReportFilters;
  view: ReportView;
}) {
  const metrics = getMetricsForView(cards, filters, view);

  return (
    <section className="metricGrid reportMetricGrid" aria-label="Report metrics">
      {metrics.map((metric) => {
        const card = (
          <Card className={`metric reportMetric metric--${metric.tone}`}>
            <CardContent>
              <span className="reportMetricLabel">
                {metric.icon}
                <span>{metric.label}</span>
              </span>
              <strong className="metricText">{metric.value}</strong>
            </CardContent>
          </Card>
        );

        return metric.href ? (
          <Link className="reportMetricLink" href={metric.href} key={metric.label}>
            {card}
          </Link>
        ) : (
          <div key={metric.label}>{card}</div>
        );
      })}
    </section>
  );
}

function ReportViewTable({
  filters,
  report,
  view
}: {
  filters: DashboardReportFilters;
  report: DashboardReport;
  view: Exclude<ReportView, "overview">;
}) {
  if (view === "orders") {
    return <OrdersByDayTable filters={filters} items={report.charts.ordersByDay} />;
  }

  if (view === "sales") {
    return <RevenueByDayTable filters={filters} items={report.charts.revenueByDay} />;
  }

  if (view === "products") {
    return <TopProductsTable filters={filters} items={report.charts.topSellingProducts} />;
  }

  if (view === "inventory") {
    return <StockAlertsTable filters={filters} items={report.charts.stockAlerts} />;
  }

  return (
    <WarehouseStockSummaryTable
      filters={filters}
      items={report.charts.warehouseStockSummary}
    />
  );
}

function ReportTablePanel({
  children,
  emptyState,
  isEmpty,
  summary,
  title
}: {
  children: ReactNode;
  emptyState: string;
  isEmpty: boolean;
  summary: string;
  title: string;
}) {
  return (
    <section className="panel reportTablePanel">
      <PageHeader
        className="settingsSectionHeader"
        eyebrow="Report table"
        level={2}
        summary={summary}
        title={title}
      />
      {isEmpty ? <div className="emptyPanel smallEmpty">{emptyState}</div> : children}
    </section>
  );
}

function OrdersByDayTable({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: Array<{ date: string; orders: number }>;
}) {
  return (
    <ReportTablePanel
      emptyState="No orders in this date range."
      isEmpty={items.length === 0}
      summary="Daily order counts with a direct link to matching order records."
      title="Orders by day"
    >
      <div className="resourceTable reportDataTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Drilldown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.date}>
                <TableCell>
                  <strong>{formatLongDate(item.date)}</strong>
                  <em>{item.date}</em>
                </TableCell>
                <TableCell>{formatReportNumber(item.orders)}</TableCell>
                <TableCell>
                  <ReportTableLink
                    href={buildReportDrilldownHref("orders", {
                      ...filters,
                      dateFrom: item.date,
                      dateTo: item.date
                    })}
                  >
                    Open orders
                  </ReportTableLink>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportTablePanel>
  );
}

function RevenueByDayTable({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: RevenueByDayPoint[];
}) {
  return (
    <ReportTablePanel
      emptyState="No paid revenue in this date range."
      isEmpty={items.length === 0}
      summary="Daily paid revenue, linked to paid order records for each day."
      title="Revenue by day"
    >
      <div className="resourceTable reportDataTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Drilldown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.date}>
                <TableCell>
                  <strong>{formatLongDate(item.date)}</strong>
                  <em>{item.date}</em>
                </TableCell>
                <TableCell>{formatReportCurrency(item.revenue)}</TableCell>
                <TableCell>
                  <ReportTableLink
                    href={buildReportDrilldownHref("orders", {
                      ...filters,
                      dateFrom: item.date,
                      dateTo: item.date,
                      paymentStatus: "PAID"
                    })}
                  >
                    Open paid orders
                  </ReportTableLink>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportTablePanel>
  );
}

function TopProductsTable({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: TopSellingProductPoint[];
}) {
  return (
    <ReportTablePanel
      emptyState="No product sales in this date range."
      isEmpty={items.length === 0}
      summary="Products ranked by sold quantity, with revenue and catalog drilldowns."
      title="Top selling products"
    >
      <div className="resourceTable reportDataTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Drilldown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <strong>{item.name}</strong>
                </TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{formatReportNumber(item.quantity)}</TableCell>
                <TableCell>{formatReportCurrency(item.revenue)}</TableCell>
                <TableCell>
                  <ReportTableLink
                    href={buildReportDrilldownHref(
                      "product",
                      filters,
                      item.productId
                    )}
                  >
                    Open product
                  </ReportTableLink>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportTablePanel>
  );
}

function StockAlertsTable({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: StockAlertPoint[];
}) {
  return (
    <ReportTablePanel
      emptyState="No stock alerts for visible warehouses."
      isEmpty={items.length === 0}
      summary="Warehouse alert counts separated into low-stock and near-expiry actions."
      title="Stock alerts"
    >
      <div className="resourceTable reportDataTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Low stock</TableHead>
              <TableHead>Near expiry</TableHead>
              <TableHead>Drilldowns</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.warehouseId}>
                <TableCell>
                  <strong>{item.warehouseName}</strong>
                  <em>{item.warehouseCode}</em>
                </TableCell>
                <TableCell>{formatReportNumber(item.lowStockProducts)}</TableCell>
                <TableCell>{formatReportNumber(item.nearExpiryBatches)}</TableCell>
                <TableCell>
                  <div className="tableActions">
                    <ReportTableLink
                      href={buildReportDrilldownHref(
                        "inventory-low-stock",
                        filters,
                        item.warehouseId
                      )}
                    >
                      Low stock
                    </ReportTableLink>
                    <ReportTableLink
                      href={buildReportDrilldownHref(
                        "inventory-near-expiry",
                        filters,
                        item.warehouseId
                      )}
                    >
                      Expiry
                    </ReportTableLink>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportTablePanel>
  );
}

function WarehouseStockSummaryTable({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: WarehouseStockSummaryPoint[];
}) {
  return (
    <ReportTablePanel
      emptyState="No warehouse stock summary available."
      isEmpty={items.length === 0}
      summary="Warehouse inventory coverage with reservation, batch, and alert columns."
      title="Warehouse-wise stock summary"
    >
      <div className="resourceTable reportDataTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Alerts</TableHead>
              <TableHead>Drilldown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.warehouseId}>
                <TableCell>
                  <strong>{item.warehouseName}</strong>
                  <em>{item.warehouseCode}</em>
                </TableCell>
                <TableCell>{formatReportNumber(item.availableQuantity)}</TableCell>
                <TableCell>{formatReportNumber(item.reservedQuantity)}</TableCell>
                <TableCell>{formatReportNumber(item.activeBatches)}</TableCell>
                <TableCell>
                  <span className="flagList">
                    {item.lowStockProducts > 0 ? (
                      <Link
                        href={buildReportDrilldownHref(
                          "inventory-low-stock",
                          filters,
                          item.warehouseId
                        )}
                      >
                        {formatReportNumber(item.lowStockProducts)} low
                      </Link>
                    ) : null}
                    {item.nearExpiryBatches > 0 ? (
                      <Link
                        href={buildReportDrilldownHref(
                          "inventory-near-expiry",
                          filters,
                          item.warehouseId
                        )}
                      >
                        {formatReportNumber(item.nearExpiryBatches)} expiry
                      </Link>
                    ) : null}
                    {item.lowStockProducts === 0 && item.nearExpiryBatches === 0 ? (
                      <span>-</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <ReportTableLink
                    href={buildReportDrilldownHref(
                      "warehouse",
                      filters,
                      item.warehouseId
                    )}
                  >
                    Open warehouse
                  </ReportTableLink>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportTablePanel>
  );
}

function ReportTableLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="reportTableLink" href={href}>
      <span>{children}</span>
      <ExternalLink aria-hidden size={13} />
    </Link>
  );
}

function getMetricsForView(
  cards: DashboardCards,
  filters: DashboardReportFilters,
  view: ReportView
): ReportMetricCard[] {
  const allMetrics: Record<Exclude<ReportView, "overview">, ReportMetricCard[]> = {
    inventory: [
      {
        href: buildReportDrilldownHref("inventory-low-stock", filters),
        icon: <AlertTriangle aria-hidden size={18} />,
        label: "Low stock products",
        tone: "warning",
        value: formatReportNumber(cards.lowStockProducts)
      },
      {
        href: buildReportDrilldownHref("inventory-near-expiry", filters),
        icon: <Boxes aria-hidden size={18} />,
        label: "Near expiry batches",
        tone: "warning",
        value: formatReportNumber(cards.nearExpiryBatches)
      },
      {
        href: buildReportDrilldownHref("warehouse", filters),
        icon: <Warehouse aria-hidden size={18} />,
        label: "Active warehouses",
        tone: "neutral",
        value: formatReportNumber(cards.activeWarehouses)
      }
    ],
    orders: [
      {
        href: buildReportDrilldownHref("orders", filters),
        icon: <ShoppingCart aria-hidden size={18} />,
        label: "Total orders",
        tone: "primary",
        value: formatReportNumber(cards.totalOrders)
      },
      {
        href: buildReportDrilldownHref("orders", filters),
        icon: <CalendarDays aria-hidden size={18} />,
        label: "Today orders",
        tone: "primary",
        value: formatReportNumber(cards.todayOrders)
      },
      {
        href: buildReportDrilldownHref("orders", filters),
        icon: <AlertTriangle aria-hidden size={18} />,
        label: "Pending orders",
        tone: "warning",
        value: formatReportNumber(cards.pendingOrders)
      }
    ],
    products: [
      {
        icon: <Boxes aria-hidden size={18} />,
        label: "Low stock products",
        tone: "warning",
        value: formatReportNumber(cards.lowStockProducts)
      },
      {
        icon: <IndianRupee aria-hidden size={18} />,
        label: "Revenue",
        tone: "primary",
        value: formatReportCurrency(cards.revenue)
      },
      {
        href: buildReportDrilldownHref("orders", filters),
        icon: <ShoppingCart aria-hidden size={18} />,
        label: "Total orders",
        tone: "neutral",
        value: formatReportNumber(cards.totalOrders)
      }
    ],
    sales: [
      {
        href: buildReportDrilldownHref("orders", {
          ...filters,
          paymentStatus: "PAID"
        }),
        icon: <IndianRupee aria-hidden size={18} />,
        label: "Revenue",
        tone: "primary",
        value: formatReportCurrency(cards.revenue)
      },
      {
        href: buildReportDrilldownHref("orders", filters),
        icon: <ShoppingCart aria-hidden size={18} />,
        label: "Total orders",
        tone: "neutral",
        value: formatReportNumber(cards.totalOrders)
      },
      {
        href: buildReportDrilldownHref("customers", filters),
        icon: <Users aria-hidden size={18} />,
        label: "Active customers",
        tone: "neutral",
        value: formatReportNumber(cards.activeCustomers)
      }
    ],
    warehouses: [
      {
        href: buildReportDrilldownHref("warehouse", filters),
        icon: <Warehouse aria-hidden size={18} />,
        label: "Active warehouses",
        tone: "primary",
        value: formatReportNumber(cards.activeWarehouses)
      },
      {
        icon: <Truck aria-hidden size={18} />,
        label: "Active delivery partners",
        tone: "neutral",
        value: formatReportNumber(cards.activeDeliveryPartners)
      },
      {
        href: buildReportDrilldownHref("inventory-low-stock", filters),
        icon: <AlertTriangle aria-hidden size={18} />,
        label: "Low stock products",
        tone: "warning",
        value: formatReportNumber(cards.lowStockProducts)
      }
    ]
  };

  if (view !== "overview") {
    return allMetrics[view];
  }

  return [
    {
      href: buildReportDrilldownHref("orders", filters),
      icon: <ShoppingCart aria-hidden size={18} />,
      label: "Total orders",
      tone: "primary",
      value: formatReportNumber(cards.totalOrders)
    },
    {
      href: buildReportDrilldownHref("orders", filters),
      icon: <CalendarDays aria-hidden size={18} />,
      label: "Today orders",
      tone: "primary",
      value: formatReportNumber(cards.todayOrders)
    },
    {
      href: buildReportDrilldownHref("orders", filters),
      icon: <AlertTriangle aria-hidden size={18} />,
      label: "Pending orders",
      tone: "warning",
      value: formatReportNumber(cards.pendingOrders)
    },
    {
      href: buildReportDrilldownHref("orders", {
        ...filters,
        paymentStatus: "PAID"
      }),
      icon: <IndianRupee aria-hidden size={18} />,
      label: "Revenue",
      tone: "primary",
      value: formatReportCurrency(cards.revenue)
    },
    {
      href: buildReportDrilldownHref("inventory-low-stock", filters),
      icon: <AlertTriangle aria-hidden size={18} />,
      label: "Low stock products",
      tone: "warning",
      value: formatReportNumber(cards.lowStockProducts)
    },
    {
      href: buildReportDrilldownHref("inventory-near-expiry", filters),
      icon: <Boxes aria-hidden size={18} />,
      label: "Near expiry batches",
      tone: "warning",
      value: formatReportNumber(cards.nearExpiryBatches)
    },
    {
      href: buildReportDrilldownHref("customers", filters),
      icon: <Users aria-hidden size={18} />,
      label: "Active customers",
      tone: "neutral",
      value: formatReportNumber(cards.activeCustomers)
    },
    {
      href: buildReportDrilldownHref("warehouse", filters),
      icon: <Warehouse aria-hidden size={18} />,
      label: "Active warehouses",
      tone: "neutral",
      value: formatReportNumber(cards.activeWarehouses)
    },
    {
      icon: <Truck aria-hidden size={18} />,
      label: "Active delivery partners",
      tone: "neutral",
      value: formatReportNumber(cards.activeDeliveryPartners)
    }
  ];
}

function getReportSectionMetric(id: ReportView, cards: DashboardCards) {
  if (id === "orders") {
    return formatReportNumber(cards.totalOrders);
  }

  if (id === "sales") {
    return formatReportCurrency(cards.revenue);
  }

  if (id === "products") {
    return formatReportNumber(cards.lowStockProducts);
  }

  if (id === "inventory") {
    return formatReportNumber(cards.lowStockProducts + cards.nearExpiryBatches);
  }

  if (id === "warehouses") {
    return formatReportNumber(cards.activeWarehouses);
  }

  return "-";
}

function formatLongDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
