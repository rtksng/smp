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
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  Users,
  Warehouse
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
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
import styles from "./reports-dashboard.module.css";
import { useAdminSession } from "../../lib/admin-session";
import { useTableOverflow } from "../../lib/use-table-overflow";
import {
  buildDashboardReportQuery,
  buildReportDrilldownHref,
  buildTodayOrdersHref,
  canAccessReportHref,
  createDefaultReportFilters,
  downloadDashboardReportExport,
  formatReportCurrency,
  formatReportNumber,
  formatReportStatusLabel,
  getDashboardEmptyState,
  getReportRevenueContext,
  getReportWarehouseOptions,
  reportDateRangeError,
  resolveReportFilters,
  REPORT_ORDER_STATUSES,
  REPORT_PAYMENT_STATUSES,
  type DashboardCards,
  type DashboardReport,
  type DashboardReportFilters,
  type OrdersByDayPoint,
  type ReportExportFormat,
  type ReportView,
  type RevenueByDayPoint,
  type StockAlertPoint,
  type TopSellingProductPoint,
  type WarehouseStockSummaryPoint
} from "../../lib/reports-management";
import "../reports/reports-responsive.css";
export type { ReportView } from "../../lib/reports-management";

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
    description: "Daily order volume and order workflow drilldowns.",
    href: "/reports/orders",
    id: "orders",
    title: "Orders"
  },
  {
    description: "Daily sales values with matching order drilldowns.",
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
    summary: "Review daily sales values with quick access to matching orders.",
    title: "Sales reports"
  },
  warehouses: {
    summary: "Compare available stock, reserved stock, batches, and alerts by warehouse.",
    title: "Warehouse reports"
  }
};

const dashboardChartColors = {
  accent: "#17a89d",
  muted: "#849c98",
  primary: "#0f6f68",
  revenue: "#2563eb",
  warning: "#b7791f"
};

const compactNumberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
  notation: "compact"
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency"
});

export function ReportsDashboard({
  eyebrow = "Reports",
  hideSectionNavigation = false,
  title,
  view = "overview"
}: ReportsDashboardProps) {
  const { api } = useAdminSession();
  const [draftFilters, setDraftFilters] = useState<DashboardReportFilters>(() =>
    createDefaultReportFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<DashboardReportFilters>(() =>
    createDefaultReportFilters()
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
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
  const report = dashboardQuery.data;
  const displayedFilters = resolveReportFilters(appliedFilters, report);
  const warehouses = getReportWarehouseOptions(report);
  const todayDate = report?.todayDate ?? new Date().toISOString().slice(0, 10);
  const emptyState = getDashboardEmptyState(report);
  const isMainDashboard = view === "overview" && hideSectionNavigation;
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
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const defaults = createDefaultReportFilters();

    setFilterError(null);
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
  }

  async function handleExport(format: ReportExportFormat) {
    if (!report) {
      setExportError("Load the report before exporting.");
      return;
    }

    setExportError(null);
    setExportingFormat(format);

    try {
      await downloadDashboardReportExport(
        displayedFilters,
        format,
        report,
        view
      );
    } catch (error) {
      setExportError(getErrorMessage(error) ?? "Unable to export report.");
    } finally {
      setExportingFormat(null);
    }
  }

  const content = (
    <>
      <section
        aria-label={isMainDashboard ? "Dashboard controls" : undefined}
        className={`panel reportControlPanel${isMainDashboard ? ` ${styles.controlPanel}` : ""}`}
        data-dashboard-layout={isMainDashboard ? "responsive" : undefined}
      >
        {hideSectionNavigation ? null : <ReportSectionNav active={view} />}
        <PageHeader
          className="reportPageHeader"
          actions={
            <div className="reportExportActions">
              <Button
                aria-label={isMainDashboard ? undefined : "Add filter"}
                className="iconTextButton"
                onClick={() => setIsFilterDrawerOpen(true)}
                type="button"
              >
                <SlidersHorizontal aria-hidden size={16} />
                <span className="reportActionLabelFull">Add filter</span>
                {isMainDashboard ? null : (
                  <span className="reportActionLabelCompact">Filter</span>
                )}
              </Button>
              <Button
                className="iconTextButton"
                disabled={Boolean(exportingFormat) || dashboardQuery.isFetching || !report || dashboardQuery.isError}
                onClick={() => void handleExport("csv")}
                type="button"
                variant="outline"
              >
                <Download aria-hidden size={16} />
                <span>{exportingFormat === "csv" ? "Exporting..." : "CSV"}</span>
              </Button>
              <Button
                className="iconTextButton"
                disabled={Boolean(exportingFormat) || dashboardQuery.isFetching || !report || dashboardQuery.isError}
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
        <FilterDrawer
          error={filterError}
          isOpen={isFilterDrawerOpen}
          isSubmitting={dashboardQuery.isFetching}
          onApply={applyFilters}
          onOpenChange={setIsFilterDrawerOpen}
          onReset={resetFilters}
          summary="Choose filters for this report."
          title="Report filters"
        >
          <ReportFilterFields
            filters={draftFilters}
            isWarehouseLoading={dashboardQuery.isLoading}
            onChange={setDraftFilters}
            view={view}
            warehouses={warehouses}
          />
        </FilterDrawer>
        {exportError ? (
          <p className="formError" role="alert">
            {exportError}
          </p>
        ) : null}
        {report && !isMainDashboard ? (
          <MetricGrid
            cards={report.cards}
            filters={displayedFilters}
            todayDate={todayDate}
            view={view}
          />
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
        isMainDashboard ? (
          <DashboardOverview filters={displayedFilters} report={report} />
        ) : view === "overview" ? (
          <ReportHub cards={report.cards} />
        ) : (
          <ReportViewTable filters={displayedFilters} report={report} view={view} />
        )
      ) : null}
    </>
  );

  return isMainDashboard ? content : (
    <div className="reportsModule" data-report-view={view}>
      {content}
    </div>
  );
}

function DashboardOverview({
  filters,
  report
}: {
  filters: DashboardReportFilters;
  report: DashboardReport;
}) {
  return (
    <>
      <DashboardKpiStrip cards={report.cards} filters={filters} />
      <section className="dashboardChartGrid" aria-label="Dashboard charts">
        <DashboardTrendChart filters={filters} report={report} />
        <TopProductsChart
          filters={filters}
          items={report.charts.topSellingProducts}
        />
        <InventoryRiskChart
          filters={filters}
          items={report.charts.stockAlerts}
        />
        <WarehouseStockChart
          filters={filters}
          items={report.charts.warehouseStockSummary}
        />
      </section>
    </>
  );
}

function DashboardKpiStrip({
  cards,
  filters
}: {
  cards: DashboardCards;
  filters: DashboardReportFilters;
}) {
  const inventoryRisk = cards.lowStockProducts + cards.nearExpiryBatches;
  const revenue = getReportRevenueContext(filters);
  const kpis = [
    {
      href: buildReportDrilldownHref("orders", {
        ...filters,
        paymentStatus: revenue.paymentStatus
      }),
      label: revenue.label,
      note: "Matching order value",
      tone: "primary",
      value: formatReportCurrency(cards.revenue)
    },
    {
      href: buildReportDrilldownHref("orders", filters),
      label: "Order volume",
      note: `${formatReportNumber(cards.todayOrders)} today`,
      tone: "neutral",
      value: formatReportNumber(cards.totalOrders)
    },
    {
      href: buildReportDrilldownHref("orders-pending", filters),
      label: "Pending queue",
      note: "Needs operation review",
      tone: cards.pendingOrders > 0 ? "warning" : "neutral",
      value: formatReportNumber(cards.pendingOrders)
    },
    {
      href: buildReportDrilldownHref("inventory-low-stock", filters),
      label: "Inventory risk",
      note: `${formatReportNumber(cards.lowStockProducts)} low, ${formatReportNumber(
        cards.nearExpiryBatches
      )} expiry`,
      tone: inventoryRisk > 0 ? "warning" : "neutral",
      value: formatReportNumber(inventoryRisk)
    }
  ];

  return (
    <section
      className={`dashboardKpiGrid ${styles.kpiGrid}`}
      aria-label="Dashboard key metrics"
    >
      {kpis.map((kpi) => (
        <ReportResourceLink
          className={`dashboardKpi dashboardKpi--${kpi.tone}`}
          href={kpi.href}
          key={kpi.label}
        >
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
          <em>{kpi.note}</em>
        </ReportResourceLink>
      ))}
    </section>
  );
}

function DashboardTrendChart({ filters, report }: { filters: DashboardReportFilters; report: DashboardReport }) {
  const data = buildTrendChartData(report);
  const revenue = getReportRevenueContext(filters);

  return (
    <DashboardChartPanel
      actionHref="/reports/sales"
      actionLabel="Open sales report"
      emptyState="No orders or revenue in this date range."
      isEmpty={data.length === 0}
      summary={`Orders and ${revenue.label.toLowerCase()} by day`}
      title="Sales and order trend"
      wide
    >
      <DashboardChartFrame height={300}>
        {(width) => (
        <ComposedChart
          data={data}
          height={300}
          margin={{ bottom: 4, left: 0, right: 12, top: 10 }}
          width={width}
        >
          <CartesianGrid stroke="#e0ecea" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            tickFormatter={formatCompactNumberAxis}
            tickLine={false}
            width={44}
            yAxisId="orders"
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            orientation="right"
            tickFormatter={formatCompactCurrencyAxis}
            tickLine={false}
            width={58}
            yAxisId="revenue"
          />
          <RechartsTooltip formatter={formatChartTooltipValue} />
          <Legend iconType="circle" />
          <Bar
            barSize={18}
            dataKey="orders"
            fill={dashboardChartColors.primary}
            name="Orders"
            radius={[6, 6, 0, 0]}
            yAxisId="orders"
          />
          <Area
            dataKey="revenue"
            fill={dashboardChartColors.revenue}
            fillOpacity={0.12}
            name={revenue.label}
            stroke={dashboardChartColors.revenue}
            strokeWidth={2}
            type="monotone"
            yAxisId="revenue"
          />
        </ComposedChart>
        )}
      </DashboardChartFrame>
    </DashboardChartPanel>
  );
}

function TopProductsChart({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: TopSellingProductPoint[];
}) {
  const data = items.slice(0, 6).map((item) => ({
    ...item,
    href: buildReportDrilldownHref("product", filters, item.productId),
    id: item.productId,
    label: compactLabel(item.name)
  }));

  return (
    <DashboardChartPanel
      actionHref="/reports/products"
      actionLabel="Open product report"
      emptyState="No product movement in this date range."
      isEmpty={data.length === 0}
      summary="Top selling products by quantity"
      title="Product movement"
    >
      <DashboardChartFrame>
        {(width) => (
        <BarChart
          data={data}
          height={280}
          layout="vertical"
          margin={{ bottom: 4, left: 8, right: 18, top: 4 }}
          width={width}
        >
          <CartesianGrid stroke="#e0ecea" horizontal={false} />
          <XAxis
            axisLine={false}
            fontSize={12}
            tickFormatter={formatCompactNumberAxis}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            type="category"
            width={118}
          />
          <RechartsTooltip formatter={formatChartTooltipValue} />
          <Bar dataKey="quantity" name="Quantity sold" radius={[0, 6, 6, 0]}>
            {data.map((item, index) => (
              <Cell
                fill={index % 2 === 0 ? dashboardChartColors.primary : dashboardChartColors.accent}
                key={item.id}
              />
            ))}
          </Bar>
        </BarChart>
        )}
      </DashboardChartFrame>
      <div className={`dashboardChartDrilldowns ${styles.chartDrilldowns}`}>
        {data.slice(0, 3).map((item) => (
          <ReportTableLink href={item.href} key={item.id}>
            {item.name}
          </ReportTableLink>
        ))}
      </div>
    </DashboardChartPanel>
  );
}

function InventoryRiskChart({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: StockAlertPoint[];
}) {
  const data = items.slice(0, 6).map((item) => ({
    ...item,
    label: compactLabel(item.warehouseName)
  }));

  return (
    <DashboardChartPanel
      actionHref={buildReportDrilldownHref("inventory-low-stock", filters)}
      actionLabel="Open inventory"
      emptyState="No stock alerts for visible warehouses."
      isEmpty={data.length === 0}
      summary="Low stock and near expiry alerts"
      title="Inventory risk"
    >
      <DashboardChartFrame>
        {(width) => (
        <ComposedChart
          data={data}
          height={280}
          margin={{ bottom: 4, left: 0, right: 12, top: 4 }}
          width={width}
        >
          <CartesianGrid stroke="#e0ecea" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            tickFormatter={formatCompactNumberAxis}
            tickLine={false}
            width={38}
          />
          <RechartsTooltip formatter={formatChartTooltipValue} />
          <Legend iconType="circle" />
          <Bar
            dataKey="lowStockProducts"
            fill={dashboardChartColors.warning}
            name="Low stock"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="nearExpiryBatches"
            fill={dashboardChartColors.accent}
            name="Near expiry"
            radius={[6, 6, 0, 0]}
          />
        </ComposedChart>
        )}
      </DashboardChartFrame>
    </DashboardChartPanel>
  );
}

function WarehouseStockChart({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: WarehouseStockSummaryPoint[];
}) {
  const data = items.slice(0, 6).map((item) => ({
    ...item,
    label: compactLabel(item.warehouseName)
  }));

  return (
    <DashboardChartPanel
      actionHref={buildReportDrilldownHref("warehouse", filters)}
      actionLabel="Open warehouses"
      emptyState="No warehouse stock summary available."
      isEmpty={data.length === 0}
      summary="Available and reserved stock coverage"
      title="Warehouse stock"
    >
      <DashboardChartFrame>
        {(width) => (
        <ComposedChart
          data={data}
          height={280}
          margin={{ bottom: 4, left: 0, right: 12, top: 4 }}
          width={width}
        >
          <CartesianGrid stroke="#e0ecea" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            fontSize={12}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            fontSize={12}
            tickFormatter={formatCompactNumberAxis}
            tickLine={false}
            width={42}
          />
          <RechartsTooltip formatter={formatChartTooltipValue} />
          <Legend iconType="circle" />
          <Bar
            dataKey="availableQuantity"
            fill={dashboardChartColors.primary}
            name="Available"
            radius={[6, 6, 0, 0]}
          />
          <Bar
            dataKey="reservedQuantity"
            fill={dashboardChartColors.muted}
            name="Reserved"
            radius={[6, 6, 0, 0]}
          />
          <Line
            dataKey="activeBatches"
            dot={{ r: 3 }}
            name="Batches"
            stroke={dashboardChartColors.revenue}
            strokeWidth={2}
            type="monotone"
          />
        </ComposedChart>
        )}
      </DashboardChartFrame>
    </DashboardChartPanel>
  );
}

function DashboardChartPanel({
  actionHref,
  actionLabel,
  children,
  emptyState,
  isEmpty,
  summary,
  title,
  wide = false
}: {
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
  emptyState: string;
  isEmpty: boolean;
  summary: string;
  title: string;
  wide?: boolean;
}) {
  return (
    <section className="panel dashboardChartPanel" data-wide={wide ? "true" : undefined}>
      <div className={`dashboardChartHeader ${styles.chartHeader}`}>
        <span>
          <strong>{title}</strong>
          <em>{summary}</em>
        </span>
        <ReportTableLink href={actionHref}>{actionLabel}</ReportTableLink>
      </div>
      {isEmpty ? <div className="emptyPanel smallEmpty">{emptyState}</div> : children}
    </section>
  );
}

function DashboardChartFrame({
  children,
  height = 280
}: {
  children: (width: number) => ReactNode;
  height?: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const syncWidth = () => {
      const nextWidth = Math.floor(frame.getBoundingClientRect().width);

      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    };
    const resizeObserver = new ResizeObserver(syncWidth);

    syncWidth();
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="dashboardChartFrame" ref={frameRef} style={{ height }}>
      {children(width)}
    </div>
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

function ReportFilterFields({
  filters,
  isWarehouseLoading,
  onChange,
  view,
  warehouses
}: {
  filters: DashboardReportFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: DashboardReportFilters) => void;
  view: ReportView;
  warehouses: NonNullable<DashboardReport["warehouseOptions"]>;
}) {
  const hasOrderFilters = view !== "inventory" && view !== "warehouses";
  const hasExpiryFilter = view === "overview" || view === "inventory" || view === "warehouses";

  return (
    <div className="filterDrawerFields">
      {hasOrderFilters ? <>
      <Label>
        From
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
      </Label>
      <Label>
        To
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
      </Label>
      </> : null}
      <Label>
        Warehouse
        <Select
          aria-label="Warehouse"
          disabled={isWarehouseLoading}
          onValueChange={(warehouseId) => onChange({ ...filters, warehouseId })}
          value={filters.warehouseId}
        >
          <SelectTrigger className="filterDrawerControl">
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
      {hasOrderFilters ? <>
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
          <SelectTrigger className="filterDrawerControl">
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
          <SelectTrigger className="filterDrawerControl">
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
      </> : null}
      {hasExpiryFilter ? (
      <Label>
        Expiry window
        <Input
          className="filterDrawerControl"
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
      ) : null}
    </div>
  );
}

function MetricGrid({
  cards,
  filters,
  todayDate,
  view
}: {
  cards: DashboardCards;
  filters: DashboardReportFilters;
  todayDate: string;
  view: ReportView;
}) {
  const { hasPermission } = useAdminSession();
  const metrics = getMetricsForView(cards, filters, view, todayDate);
  const spansRow = getMetricRowSpans(metrics);

  return (
    <section className="metricGrid reportMetricGrid" aria-label="Report metrics">
      {metrics.map((metric, index) => {
        const span = spansRow[index] ? "row" : undefined;
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

        return metric.href && canAccessReportHref(metric.href, hasPermission) ? (
          <Link
            className="reportMetricLink"
            data-span={span}
            href={metric.href}
            key={metric.label}
          >
            {card}
          </Link>
        ) : (
          <div data-span={span} key={metric.label}>
            {card}
          </div>
        );
      })}
    </section>
  );
}

/*
 * Phones show metrics two per row. Long values (currency) take a full row, and an odd
 * leftover card stretches so the grid never ends with an empty half row.
 */
function getMetricRowSpans(metrics: ReportMetricCard[]) {
  const isWide = metrics.map((metric) => metric.value.length > 9);
  const narrowIndexes = metrics.flatMap((_, index) => (isWide[index] ? [] : [index]));
  const stretchedIndex =
    narrowIndexes.length % 2 === 1 ? narrowIndexes[narrowIndexes.length - 1] : -1;

  return metrics.map((_, index) => isWide[index] || index === stretchedIndex);
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
  const { isOverflowing, shellRef } = useTableOverflow(!isEmpty);

  return (
    <section className="panel reportTablePanel">
      <PageHeader
        className="settingsSectionHeader"
        eyebrow="Report table"
        level={2}
        summary={summary}
        title={title}
      />
      {isEmpty ? (
        <div className="emptyPanel smallEmpty">{emptyState}</div>
      ) : (
        <div
          className="reportTableShell"
          data-overflowing={isOverflowing ? "true" : undefined}
          ref={shellRef}
        >
          {isOverflowing ? (
            <p className="reportTableHint" id={REPORT_TABLE_HINT_ID}>
              Swipe sideways to view every report detail and drilldown.
            </p>
          ) : null}
          {children}
        </div>
      )}
    </section>
  );
}

const REPORT_TABLE_HINT_ID = "report-table-hint";

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
        <Table aria-describedby={REPORT_TABLE_HINT_ID} aria-label="Orders by day">
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
                <TableCell className="reportTitleCell">
                  <strong>{formatLongDate(item.date)}</strong>
                  <em>{item.date}</em>
                </TableCell>
                <TableCell data-label="Orders">{formatReportNumber(item.orders)}</TableCell>
                <TableCell className="reportLinksCell">
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
  const revenue = getReportRevenueContext(filters);

  return (
    <ReportTablePanel
      emptyState={`No ${revenue.label.toLowerCase()} in this date range.`}
      isEmpty={items.length === 0}
      summary={`Daily ${revenue.label.toLowerCase()}, linked to matching order records for each day.`}
      title={`${revenue.label} by day`}
    >
      <div className="resourceTable reportDataTable">
        <Table
          aria-describedby={REPORT_TABLE_HINT_ID}
          aria-label={`${revenue.label} by day`}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>{revenue.label}</TableHead>
              <TableHead>Drilldown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.date}>
                <TableCell className="reportTitleCell">
                  <strong>{formatLongDate(item.date)}</strong>
                  <em>{item.date}</em>
                </TableCell>
                <TableCell data-label={revenue.label}>
                  {formatReportCurrency(item.revenue)}
                </TableCell>
                <TableCell className="reportLinksCell">
                  <ReportTableLink
                    href={buildReportDrilldownHref("orders", {
                      ...filters,
                      dateFrom: item.date,
                      dateTo: item.date,
                      paymentStatus: revenue.paymentStatus
                    })}
                  >
                    {revenue.orderLinkLabel}
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
        <Table aria-describedby={REPORT_TABLE_HINT_ID} aria-label="Top selling products">
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
                <TableCell className="reportTitleCell">
                  <strong>{item.name}</strong>
                </TableCell>
                <TableCell className="reportWideCell" data-label="SKU" title={item.sku}>
                  {item.sku}
                </TableCell>
                <TableCell data-label="Quantity">{formatReportNumber(item.quantity)}</TableCell>
                <TableCell data-label="Revenue">{formatReportCurrency(item.revenue)}</TableCell>
                <TableCell className="reportLinksCell">
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
        <Table aria-describedby={REPORT_TABLE_HINT_ID} aria-label="Stock alerts">
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
                <TableCell className="reportTitleCell">
                  <strong>{item.warehouseName}</strong>
                  <em>{item.warehouseCode}</em>
                </TableCell>
                <TableCell data-label="Low stock">
                  {formatReportNumber(item.lowStockProducts)}
                </TableCell>
                <TableCell data-label="Near expiry">
                  {formatReportNumber(item.nearExpiryBatches)}
                </TableCell>
                <TableCell className="reportLinksCell">
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
        <Table
          aria-describedby={REPORT_TABLE_HINT_ID}
          aria-label="Warehouse-wise stock summary"
        >
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
                <TableCell className="reportTitleCell">
                  <strong>{item.warehouseName}</strong>
                  <em>{item.warehouseCode}</em>
                </TableCell>
                <TableCell data-label="Available">
                  {formatReportNumber(item.availableQuantity)}
                </TableCell>
                <TableCell data-label="Reserved">
                  {formatReportNumber(item.reservedQuantity)}
                </TableCell>
                <TableCell data-label="Batches">
                  {formatReportNumber(item.activeBatches)}
                </TableCell>
                <TableCell data-label="Alerts">
                  <span className="flagList">
                    {item.lowStockProducts > 0 ? (
                      <ReportResourceLink
                        href={buildReportDrilldownHref(
                          "inventory-low-stock",
                          filters,
                          item.warehouseId
                        )}
                      >
                        {formatReportNumber(item.lowStockProducts)} low
                      </ReportResourceLink>
                    ) : null}
                    {item.nearExpiryBatches > 0 ? (
                      <ReportResourceLink
                        href={buildReportDrilldownHref(
                          "inventory-near-expiry",
                          filters,
                          item.warehouseId
                        )}
                      >
                        {formatReportNumber(item.nearExpiryBatches)} expiry
                      </ReportResourceLink>
                    ) : null}
                    {item.lowStockProducts === 0 && item.nearExpiryBatches === 0 ? (
                      <span>-</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="reportLinksCell">
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
  const { hasPermission } = useAdminSession();

  if (!canAccessReportHref(href, hasPermission)) {
    return <span aria-disabled="true" title="Your role cannot open this page.">{children}</span>;
  }

  return (
    <Link className="reportTableLink" href={href}>
      <span>{children}</span>
      <ExternalLink aria-hidden size={13} />
    </Link>
  );
}

function ReportResourceLink({
  children,
  className,
  href
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  const { hasPermission } = useAdminSession();

  return canAccessReportHref(href, hasPermission) ? (
    <Link className={className} href={href}>{children}</Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

function getMetricsForView(
  cards: DashboardCards,
  filters: DashboardReportFilters,
  view: ReportView,
  todayDate: string
): ReportMetricCard[] {
  const revenue = getReportRevenueContext(filters);
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
        href: buildTodayOrdersHref(filters, todayDate),
        icon: <CalendarDays aria-hidden size={18} />,
        label: "Today orders",
        tone: "primary",
        value: formatReportNumber(cards.todayOrders)
      },
      {
        href: buildReportDrilldownHref("orders-pending", filters),
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
        label: revenue.label,
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
          paymentStatus: revenue.paymentStatus
        }),
        icon: <IndianRupee aria-hidden size={18} />,
        label: revenue.label,
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
      href: buildTodayOrdersHref(filters, todayDate),
      icon: <CalendarDays aria-hidden size={18} />,
      label: "Today orders",
      tone: "primary",
      value: formatReportNumber(cards.todayOrders)
    },
    {
      href: buildReportDrilldownHref("orders-pending", filters),
      icon: <AlertTriangle aria-hidden size={18} />,
      label: "Pending orders",
      tone: "warning",
      value: formatReportNumber(cards.pendingOrders)
    },
    {
      href: buildReportDrilldownHref("orders", {
        ...filters,
        paymentStatus: revenue.paymentStatus
      }),
      icon: <IndianRupee aria-hidden size={18} />,
      label: revenue.label,
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

function mergeTrendData(
  ordersByDay: OrdersByDayPoint[],
  revenueByDay: RevenueByDayPoint[]
) {
  const points = new Map<string, { date: string; orders: number; revenue: number }>();

  for (const item of ordersByDay) {
    points.set(item.date, {
      date: item.date,
      orders: item.orders,
      revenue: points.get(item.date)?.revenue ?? 0
    });
  }

  for (const item of revenueByDay) {
    points.set(item.date, {
      date: item.date,
      orders: points.get(item.date)?.orders ?? 0,
      revenue: item.revenue
    });
  }

  return Array.from(points.values())
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((item) => ({
      ...item,
      label: formatChartDate(item.date)
    }));
}

function buildTrendChartData(report: DashboardReport) {
  const trendData = mergeTrendData(report.charts.ordersByDay, report.charts.revenueByDay);

  if (trendData.length > 0) {
    return trendData;
  }

  return [
    {
      date: "pending",
      label: "Pending",
      orders: report.cards.pendingOrders,
      revenue: 0
    },
    {
      date: "today",
      label: "Today",
      orders: report.cards.todayOrders,
      revenue: 0
    },
    {
      date: "total",
      label: "Total",
      orders: report.cards.totalOrders,
      revenue: report.cards.revenue
    }
  ];
}

function formatChartDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

function compactLabel(value: string, maxLength = 18) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatCompactNumberAxis(value: number | string) {
  return compactNumberFormatter.format(Number(value) || 0);
}

function formatCompactCurrencyAxis(value: number | string) {
  return compactCurrencyFormatter.format(Number(value) || 0);
}

function formatChartTooltipValue(value: unknown, name: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value) || 0;
  const label = String(name);
  const formattedValue = /revenue|value/i.test(label)
    ? formatReportCurrency(numericValue)
    : formatReportNumber(numericValue);

  return [formattedValue, label] as [string, string];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
