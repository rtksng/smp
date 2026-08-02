"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AdminShell } from "../../admin-shell";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  buildOrderQuery,
  createEmptyOrderFilters,
  formatCurrency,
  formatDateTime,
  formatOrderLabel,
  type AdminOrder,
  type OrderFilters,
  type PaginatedResponse
} from "../../../lib/order-management";

const ORDERS_PAGE_SIZE = 20;

const orderCopy = {
  summary: "Review order workload, filter results, and open order detail pages.",
  title: "Orders"
};

export function OrdersRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.OrdersRead}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function OrdersLandingPage() {
  return <OrdersContent />;
}

function OrdersContent() {
  const { api } = useAdminSession();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const urlFilters = useMemo(
    () => createOrderFiltersFromSearchParams(new URLSearchParams(searchKey)),
    [searchKey]
  );
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(
    urlFilters
  );
  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(
    urlFilters
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState<string | null>(null);

  const orderQuery = useMemo(
    () => buildOrderQuery(appliedFilters, page, ORDERS_PAGE_SIZE),
    [appliedFilters, page]
  );

  const ordersQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedResponse<AdminOrder>>("/admin/orders", {
        query: orderQuery
      }),
    queryKey: ["admin", "orders", orderQuery]
  });
  const warehousesQuery = useQuery({
    queryFn: () =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: {
          limit: 100
        }
      }),
    queryKey: ["admin", "orders", "warehouses"]
  });

  const orders = ordersQuery.data?.items ?? [];
  const warehouses = warehousesQuery.data?.items ?? [];
  const pagination = ordersQuery.data?.pagination;
  const openOrders = orders.filter(
    (order) => !["DELIVERED", "CANCELLED", "RETURNED"].includes(order.status)
  ).length;

  useEffect(() => {
    setFilterError(null);
    setPage(1);
    setDraftFilters(urlFilters);
    setAppliedFilters(urlFilters);
  }, [urlFilters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      draftFilters.dateFrom &&
      draftFilters.dateTo &&
      draftFilters.dateFrom > draftFilters.dateTo
    ) {
      setFilterError("Start date must be before end date.");
      return;
    }

    setFilterError(null);
    setPage(1);
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyOrderFilters();
    setFilterError(null);
    setPage(1);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  const paidVisibleCount = orders.filter((order) => order.paymentStatus === "PAID").length;
  return (
    <>
      <section className="panel orderOverviewPanel">
        <PageHeader
          actions={
            <div className="actionRow">
              <Button
                className="iconTextButton"
                onClick={() => setIsFilterDrawerOpen(true)}
                type="button"
              >
                <SlidersHorizontal aria-hidden size={16} />
                <span>Add filter</span>
              </Button>
              <Button
                className="iconTextButton"
                onClick={() => void ordersQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="orderPageHeader"
          eyebrow="Orders"
          summary={orderCopy.summary}
          title={orderCopy.title}
        />

        <div className="metricGrid resourceMetrics orderMetricGrid">
          <MetricCard label="Total matches" tone="primary" value={pagination?.total ?? orders.length} />
          <MetricCard label="Visible" value={orders.length} />
          <MetricCard label="Open" tone="warning" value={openOrders} />
          <MetricCard label="Paid visible" tone="primary" value={paidVisibleCount} />
        </div>
      </section>

      <FilterDrawer
        error={filterError}
        isOpen={isFilterDrawerOpen}
        isSubmitting={ordersQuery.isFetching}
        onApply={applyFilters}
        onOpenChange={setIsFilterDrawerOpen}
        onReset={resetFilters}
        summary="Filter by status, payment, warehouse, customer mobile, date, or order number."
        title="Order filters"
      >
        <OrderFilterFields
          filters={draftFilters}
          isWarehouseLoading={warehousesQuery.isLoading}
          onChange={setDraftFilters}
          warehouses={warehouses}
        />
      </FilterDrawer>

      <section className="panel orderListPanel mt-3">
        <PageHeader
          className="settingsSectionHeader"
          eyebrow="Order table"
          level={2}
          title="Warehouse-scoped results"
        />
        {warehousesQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(warehousesQuery.error) ?? "Unable to load warehouses."}
          </p>
        ) : null}

        {ordersQuery.isLoading ? <LoadingState label="Loading orders..." /> : null}
        {ordersQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(ordersQuery.error) ?? "Unable to load orders."}
          </p>
        ) : null}
        {!ordersQuery.isLoading && !ordersQuery.isError ? (
          <OrdersTable orders={orders} />
        ) : null}
        {pagination ? (
          <PaginationControls
            onChange={setPage}
            page={pagination.page}
            totalPages={Math.max(pagination.totalPages, 1)}
          />
        ) : null}
      </section>
    </>
  );
}

function OrderFilterFields({
  filters,
  isWarehouseLoading,
  onChange,
  warehouses
}: {
  filters: OrderFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: OrderFilters) => void;
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <div className="filterDrawerFields">
      <Select
        aria-label="Order status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as OrderFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any status</SelectItem>
          {ORDER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatOrderLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        aria-label="Payment status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            paymentStatus: value as OrderFilters["paymentStatus"]
          })
        }
        value={filters.paymentStatus}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any payment</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatOrderLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label>
        From
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
      </label>
      <label>
        To
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
      </label>
      <label>
        Customer mobile
        <Input
          className="filterDrawerControl"
          inputMode="tel"
          onChange={(event) =>
            onChange({ ...filters, customerMobile: event.target.value })
          }
          placeholder="9999999999"
          value={filters.customerMobile}
        />
      </label>
      <label>
        Order number
        <Input
          className="filterDrawerControl"
          onChange={(event) =>
            onChange({ ...filters, orderNumber: event.target.value.toUpperCase() })
          }
          placeholder="ORD-20260525"
          value={filters.orderNumber}
        />
      </label>
      <Select
        aria-label="Warehouse"
        disabled={isWarehouseLoading}
        onValueChange={(value) => onChange({ ...filters, warehouseId: value })}
        value={filters.warehouseId}
      >
        <SelectTrigger className="filterDrawerControl">
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
    </div>
  );
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        body="No orders match the selected filters."
        title="No orders found"
      />
    );
  }

  return (
    <div className="resourceTable ordersTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
      {orders.map((order) => (
        <TableRow key={order.id}>
          <TableCell>
            <strong>{order.orderNumber}</strong>
            <em>{order.id}</em>
          </TableCell>
          <TableCell>
            <strong>
              {order.customer.firstName} {order.customer.lastName ?? ""}
            </strong>
            <em>{order.customer.mobileNumber}</em>
          </TableCell>
          <TableCell>
            <StatusBadge status={order.status} />
          </TableCell>
          <TableCell>
            <StatusBadge status={order.paymentStatus} />
          </TableCell>
          <TableCell>{formatDateTime(order.placedAt ?? order.createdAt)}</TableCell>
          <TableCell>{order.warehouse?.name ?? order.warehouseId ?? "Unassigned"}</TableCell>
          <TableCell>{formatCurrency(order.totals.grandTotal)}</TableCell>
          <TableCell>
            <Button asChild className="iconTextButton" size="sm" variant="outline">
              <Link href={`/orders/${order.id}`}>
              <Eye aria-hidden size={16} />
              <span>View</span>
            </Link>
            </Button>
          </TableCell>
        </TableRow>
      ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function createOrderFiltersFromSearchParams(searchParams: {
  get: (key: string) => string | null;
}) {
  const filters = createEmptyOrderFilters();
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");

  return {
    ...filters,
    customerMobile: searchParams.get("customerMobile") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    orderNumber: searchParams.get("orderNumber") ?? "",
    paymentStatus: (PAYMENT_STATUSES as readonly string[]).includes(paymentStatus ?? "")
      ? (paymentStatus as OrderFilters["paymentStatus"])
      : "",
    status: (ORDER_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as OrderFilters["status"])
      : "",
    warehouseId: searchParams.get("warehouseId") ?? ""
  };
}
