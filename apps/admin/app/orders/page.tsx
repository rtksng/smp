"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import type { WarehouseListResponse } from "../../lib/warehouse-management";
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
} from "../../lib/order-management";

const ORDERS_PAGE_SIZE = 20;

export default function OrdersPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.OrdersRead}>
        <OrdersContent />
      </ProtectedRoute>
    </AdminShell>
  );
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

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
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
  }

  function resetFilters() {
    const emptyFilters = createEmptyOrderFilters();
    setFilterError(null);
    setPage(1);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <Button
                className="iconTextButton"
                onClick={() => void ordersQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Orders"
            summary="Review warehouse-scoped customer orders, payments, invoices, and delivery readiness."
            title="Customer order management"
          />

          <div className="metricGrid resourceMetrics">
            <MetricCard label="Total matches" tone="primary" value={pagination?.total ?? orders.length} />
            <MetricCard label="Visible" value={orders.length} />
            <MetricCard label="Open" tone="warning" value={openOrders} />
            <MetricCard
              label="Paid visible"
              tone="primary"
              value={orders.filter((order) => order.paymentStatus === "PAID").length}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find orders" />
          <OrderFilterForm
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Order table" level={2} title="Warehouse-scoped results" />
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
        </CardContent>
      </Card>
    </>
  );
}

function OrderFilterForm({
  filters,
  isWarehouseLoading,
  onChange,
  onReset,
  onSubmit,
  warehouses
}: {
  filters: OrderFilters;
  isWarehouseLoading: boolean;
  onChange: (filters: OrderFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  warehouses: WarehouseListResponse["items"];
}) {
  return (
    <form className="ordersFilters" onSubmit={onSubmit}>
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
        <SelectTrigger>
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
        <SelectTrigger>
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
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
      </label>
      <label>
        To
        <Input
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
      </label>
      <label>
        Customer mobile
        <Input
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
