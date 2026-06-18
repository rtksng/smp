"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  Clock3,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
  type StockAlertPoint,
  type WarehouseStockSummaryPoint
} from "../../lib/reports-management";
import type { WarehouseListResponse } from "../../lib/warehouse-management";

type ReportsDashboardProps = {
  eyebrow: string;
  title: string;
};

type MetricCard = {
  href?: string;
  icon: ReactNode;
  label: string;
  tone: "neutral" | "primary" | "warning";
  value: string;
};

export function ReportsDashboard({ eyebrow, title }: ReportsDashboardProps) {
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
      <Card className="reportControlPanel">
        <CardHeader>
          <PageHeader
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
            summary="Warehouse-scoped orders, revenue, inventory alerts, and operating coverage."
            title={title}
          />
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {dashboardQuery.isLoading ? (
        <LoadingState label="Loading reports..." />
      ) : null}
      {dashboardQuery.isError ? (
        <Card>
          <CardContent>
            <p className="formError" role="alert">
              {errorMessage}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {emptyState ? (
        <EmptyState body={emptyState} title="No report data" />
      ) : null}

      {report ? (
        <>
          <MetricGrid cards={report.cards} filters={appliedFilters} />
          <div className="reportChartsGrid">
            <ChartPanel title="Orders by day">
              <BarList
                emptyState="No orders in this date range."
                getLabel={(item) => formatShortDate(item.date)}
                getHref={(item) =>
                  buildReportDrilldownHref("orders", {
                    ...appliedFilters,
                    dateFrom: item.date,
                    dateTo: item.date
                  })
                }
                getValue={(item) => item.orders}
                items={report.charts.ordersByDay}
                renderValue={(value) => formatReportNumber(value)}
              />
            </ChartPanel>

            <ChartPanel title="Revenue by day">
              <BarList
                emptyState="No paid revenue in this date range."
                getLabel={(item) => formatShortDate(item.date)}
                getHref={(item) =>
                  buildReportDrilldownHref("orders", {
                    ...appliedFilters,
                    dateFrom: item.date,
                    dateTo: item.date,
                    paymentStatus: "PAID"
                  })
                }
                getValue={(item) => item.revenue}
                items={report.charts.revenueByDay}
                renderValue={(value) => formatReportCurrency(value)}
              />
            </ChartPanel>

            <ChartPanel title="Top selling products">
              <BarList
                emptyState="No product sales in this date range."
                getLabel={(item) => item.name}
                getHref={(item) =>
                  buildReportDrilldownHref("product", appliedFilters, item.productId)
                }
                getSubLabel={(item) => item.sku}
                getValue={(item) => item.quantity}
                items={report.charts.topSellingProducts}
                renderValue={(value, item) =>
                  `${formatReportNumber(value)} units | ${formatReportCurrency(item.revenue)}`
                }
              />
            </ChartPanel>

            <ChartPanel title="Stock alerts">
              <StockAlertChart filters={appliedFilters} items={report.charts.stockAlerts} />
            </ChartPanel>

            <ChartPanel wide title="Warehouse-wise stock summary">
              <WarehouseStockSummaryChart
                filters={appliedFilters}
                items={report.charts.warehouseStockSummary}
              />
            </ChartPanel>
          </div>
        </>
      ) : null}
    </>
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
              <SelectItem key={warehouse.id} value={warehouse.id}>
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
  filters
}: {
  cards: DashboardCards;
  filters: DashboardReportFilters;
}) {
  const metrics: MetricCard[] = [
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
      icon: <Clock3 aria-hidden size={18} />,
      label: "Pending orders",
      tone: "warning",
      value: formatReportNumber(cards.pendingOrders)
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
      icon: <Truck aria-hidden size={18} />,
      label: "Active delivery partners",
      tone: "neutral",
      value: formatReportNumber(cards.activeDeliveryPartners)
    },
    {
      href: buildReportDrilldownHref("warehouse", filters),
      icon: <Warehouse aria-hidden size={18} />,
      label: "Active warehouses",
      tone: "neutral",
      value: formatReportNumber(cards.activeWarehouses)
    }
  ];

  return (
    <section className="metricGrid reportMetricGrid" aria-label="Dashboard cards">
      {metrics.map((metric) => {
        const card = (
          <Card
          className={`metric reportMetric metric--${metric.tone}`}
        >
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

function ChartPanel({
  children,
  title,
  wide = false
}: {
  children: ReactNode;
  title: string;
  wide?: boolean;
}) {
  return (
    <Card className="reportChartPanel" data-wide={wide}>
      <CardHeader>
        <p className="eyebrow">Chart</p>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BarList<TItem>({
  emptyState,
  getLabel,
  getHref,
  getSubLabel,
  getValue,
  items,
  renderValue
}: {
  emptyState: string;
  getLabel: (item: TItem) => string;
  getHref?: (item: TItem) => string | undefined;
  getSubLabel?: (item: TItem) => string;
  getValue: (item: TItem) => number;
  items: TItem[];
  renderValue: (value: number, item: TItem) => string;
}) {
  const maxValue = Math.max(...items.map(getValue), 0);

  if (items.length === 0) {
    return <div className="emptyPanel smallEmpty">{emptyState}</div>;
  }

  return (
    <div className="barList">
      {items.map((item) => {
        const value = getValue(item);
        const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 3) : 0;
        const href = getHref?.(item);
        const key = `${getLabel(item)}-${getSubLabel?.(item) ?? ""}`;
        const rowContent = (
          <>
            <div className="barHeader">
              <span>
                <strong>{getLabel(item)}</strong>
                {getSubLabel ? <em>{getSubLabel(item)}</em> : null}
              </span>
              <b>
                {renderValue(value, item)}
                {href ? <ExternalLink aria-hidden size={13} /> : null}
              </b>
            </div>
            <div className="barTrack" aria-hidden>
              <span style={{ width: `${width}%` }} />
            </div>
          </>
        );

        return href ? (
          <Link className="barRow reportDrilldownRow" href={href} key={key}>
            {rowContent}
          </Link>
        ) : (
          <div className="barRow" key={key}>
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}

function StockAlertChart({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: StockAlertPoint[];
}) {
  const maxValue = Math.max(
    ...items.map((item) => item.lowStockProducts + item.nearExpiryBatches),
    0
  );

  if (items.length === 0) {
    return <div className="emptyPanel smallEmpty">No stock alerts for visible warehouses.</div>;
  }

  return (
    <div className="barList">
      {items.map((item) => {
        const lowWidth =
          maxValue > 0 ? Math.max((item.lowStockProducts / maxValue) * 100, 3) : 0;
        const expiryWidth =
          maxValue > 0 ? Math.max((item.nearExpiryBatches / maxValue) * 100, 3) : 0;

        return (
          <div className="barRow" key={item.warehouseId}>
            <div className="barHeader">
              <span>
                <strong>{item.warehouseName}</strong>
                <em>{item.warehouseCode}</em>
              </span>
              <b>
                {formatReportNumber(item.lowStockProducts)} low |{" "}
                {formatReportNumber(item.nearExpiryBatches)} expiry
              </b>
            </div>
            <div className="reportRowActions">
              <Link
                href={buildReportDrilldownHref(
                  "inventory-low-stock",
                  filters,
                  item.warehouseId
                )}
              >
                Low stock
              </Link>
              <Link
                href={buildReportDrilldownHref(
                  "inventory-near-expiry",
                  filters,
                  item.warehouseId
                )}
              >
                Expiry
              </Link>
            </div>
            <div className="stackedBars" aria-hidden>
              <span className="stackedBarsLow" style={{ width: `${lowWidth}%` }} />
              <span className="stackedBarsExpiry" style={{ width: `${expiryWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WarehouseStockSummaryChart({
  filters,
  items
}: {
  filters: DashboardReportFilters;
  items: WarehouseStockSummaryPoint[];
}) {
  if (items.length === 0) {
    return <div className="emptyPanel smallEmpty">No warehouse stock summary available.</div>;
  }

  return (
    <div className="warehouseStockChart" role="table">
      <div className="warehouseStockHeader" role="row">
        <strong role="columnheader">Warehouse</strong>
        <strong role="columnheader">Available</strong>
        <strong role="columnheader">Reserved</strong>
        <strong role="columnheader">Batches</strong>
        <strong role="columnheader">Alerts</strong>
      </div>
      {items.map((item) => (
        <div className="warehouseStockRow" key={item.warehouseId} role="row">
          <span role="cell">
            <strong>
              <Link
                href={buildReportDrilldownHref("warehouse", filters, item.warehouseId)}
              >
                {item.warehouseName}
              </Link>
            </strong>
            <em>{item.warehouseCode}</em>
          </span>
          <span role="cell">{formatReportNumber(item.availableQuantity)}</span>
          <span role="cell">{formatReportNumber(item.reservedQuantity)}</span>
          <span role="cell">{formatReportNumber(item.activeBatches)}</span>
          <span className="flagList" role="cell">
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
        </div>
      ))}
    </div>
  );
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
