"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
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
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(
    createEmptyOrderFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(
    createEmptyOrderFilters()
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
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Orders</p>
            <h2>Customer order management</h2>
            <p className="panelSummary">
              Review warehouse-scoped customer orders, payments, invoices, and delivery readiness.
            </p>
          </div>
          <button
            className="ghostButton iconTextButton"
            onClick={() => void ordersQuery.refetch()}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Total matches</span>
            <strong>{pagination?.total ?? orders.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Visible</span>
            <strong>{orders.length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Open</span>
            <strong>{openOrders}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Paid visible</span>
            <strong>{orders.filter((order) => order.paymentStatus === "PAID").length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find orders</h2>
          </div>
        </div>
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
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Order table</p>
            <h2>Warehouse-scoped results</h2>
          </div>
        </div>
        {ordersQuery.isLoading ? (
          <div className="loadingBlock">Loading orders...</div>
        ) : null}
        {ordersQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(ordersQuery.error) ?? "Unable to load orders."}
          </p>
        ) : null}
        {!ordersQuery.isLoading && !ordersQuery.isError ? (
          <OrdersTable orders={orders} />
        ) : null}
        {pagination ? (
          <div className="paginationControls">
            <button
              className="ghostButton"
              disabled={!pagination.hasPreviousPage || ordersQuery.isFetching}
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              className="ghostButton"
              disabled={!pagination.hasNextPage || ordersQuery.isFetching}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
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
      <label>
        Order status
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as OrderFilters["status"]
            })
          }
          value={filters.status}
        >
          <option value="">Any status</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatOrderLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Payment status
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              paymentStatus: event.target.value as OrderFilters["paymentStatus"]
            })
          }
          value={filters.paymentStatus}
        >
          <option value="">Any payment</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatOrderLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        From
        <input
          onChange={(event) => onChange({ ...filters, dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
      </label>
      <label>
        To
        <input
          onChange={(event) => onChange({ ...filters, dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
      </label>
      <label>
        Customer mobile
        <input
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
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) =>
              onChange({ ...filters, orderNumber: event.target.value.toUpperCase() })
            }
            placeholder="ORD-20260525"
            value={filters.orderNumber}
          />
        </span>
      </label>
      <label>
        Warehouse
        <select
          disabled={isWarehouseLoading}
          onChange={(event) => onChange({ ...filters, warehouseId: event.target.value })}
          value={filters.warehouseId}
        >
          <option value="">All visible warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name} ({warehouse.code})
            </option>
          ))}
        </select>
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </form>
  );
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <div className="emptyPanel smallEmpty">No orders match the selected filters.</div>;
  }

  return (
    <div className="ordersTable" role="table">
      <div className="ordersTableHeader" role="row">
        <strong role="columnheader">Order</strong>
        <strong role="columnheader">Customer</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Payment</strong>
        <strong role="columnheader">Date</strong>
        <strong role="columnheader">Warehouse</strong>
        <strong role="columnheader">Total</strong>
        <strong role="columnheader">Action</strong>
      </div>
      {orders.map((order) => (
        <div className="ordersTableRow" key={order.id} role="row">
          <span role="cell">
            <strong>{order.orderNumber}</strong>
            <em>{order.id}</em>
          </span>
          <span role="cell">
            <strong>
              {order.customer.firstName} {order.customer.lastName ?? ""}
            </strong>
            <em>{order.customer.mobileNumber}</em>
          </span>
          <span role="cell">
            <StatusBadge status={order.status} />
          </span>
          <span role="cell">
            <StatusBadge status={order.paymentStatus} />
          </span>
          <span role="cell">{formatDateTime(order.placedAt ?? order.createdAt)}</span>
          <span role="cell">{order.warehouse?.name ?? order.warehouseId ?? "Unassigned"}</span>
          <span role="cell">{formatCurrency(order.totals.grandTotal)}</span>
          <span role="cell">
            <Link className="ghostButton iconTextButton" href={`/orders/${order.id}`}>
              <Eye aria-hidden size={16} />
              <span>View</span>
            </Link>
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`statusBadge statusBadge--${status.toLowerCase()}`}>
      {formatOrderLabel(status)}
    </span>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
