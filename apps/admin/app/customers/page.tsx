"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  buildCustomerQuery,
  createEmptyCustomerFilters,
  customerStatusLabel,
  formatCustomerDate,
  type AdminCustomer,
  type CustomerFilters,
  type PaginatedCustomerResponse
} from "../../lib/customer-management";

export default function CustomersPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.UsersRead}>
        <CustomersContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CustomersContent() {
  const { api } = useAdminSession();
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(
    createEmptyCustomerFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<CustomerFilters>(
    createEmptyCustomerFilters()
  );
  const [page, setPage] = useState(1);
  const customersQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedCustomerResponse>("/admin/customers", {
        query: buildCustomerQuery(appliedFilters, page)
      }),
    queryKey: ["admin", "customers", appliedFilters, page]
  });
  const customers = useMemo(
    () => customersQuery.data?.items ?? [],
    [customersQuery.data?.items]
  );
  const pagination = customersQuery.data?.pagination;
  const activeVisibleCount = customers.filter((customer) => customer.isActive).length;
  const inactiveVisibleCount = customers.length - activeVisibleCount;
  const gstVisibleCount = customers.filter((customer) => customer.gstNumber).length;

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyCustomerFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Customers</p>
            <h2>Customer records</h2>
            <p className="panelSummary">
              Search customer accounts by identity, contact, business, or GSTIN.
            </p>
          </div>
          <button
            className="ghostButton iconTextButton"
            onClick={() => void customersQuery.refetch()}
            type="button"
          >
            <RefreshCw aria-hidden size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {customersQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(customersQuery.error) ?? "Unable to load customers."}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Total customers</span>
            <strong>{pagination?.total ?? 0}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Visible</span>
            <strong>{customers.length}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Active visible</span>
            <strong>{activeVisibleCount}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Inactive visible</span>
            <strong>{inactiveVisibleCount}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>GSTIN visible</span>
            <strong>{gstVisibleCount}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find customers</h2>
          </div>
        </div>
        <CustomerFilterForm
          filters={draftFilters}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={applyFilters}
        />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Customer list</p>
            <h2>Accounts and order activity</h2>
          </div>
        </div>

        {customersQuery.isLoading ? (
          <div className="loadingBlock">Loading customers...</div>
        ) : null}
        {!customersQuery.isLoading && customers.length === 0 ? (
          <div className="emptyPanel smallEmpty">
            No customers match the current filters.
          </div>
        ) : null}
        {customers.length > 0 ? <CustomerTable customers={customers} /> : null}
        {pagination ? (
          <PaginationControls
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            label={`Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`}
            onNext={() => setPage((current) => current + 1)}
            onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
          />
        ) : null}
      </section>
    </>
  );
}

function CustomerFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  filters: CustomerFilters;
  onChange: (filters: CustomerFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="productFilters customerFilters" onSubmit={onSubmit}>
      <label>
        Search
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Name, mobile, email, business, GSTIN"
            value={filters.search}
          />
        </span>
      </label>
      <label>
        Status
        <select
          onChange={(event) =>
            onChange({
              ...filters,
              isActive: event.target.value as CustomerFilters["isActive"]
            })
          }
          value={filters.isActive}
        >
          <option value="">Any</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
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

function CustomerTable({ customers }: { customers: AdminCustomer[] }) {
  const gridTemplateColumns =
    "minmax(220px, 1.3fr) minmax(150px, 0.8fr) minmax(210px, 1fr) minmax(190px, 1fr) 110px 120px 130px";

  return (
    <div className="resourceTable" role="table">
      <div className="resourceTableHeader" role="row" style={{ gridTemplateColumns }}>
        <strong role="columnheader">Customer</strong>
        <strong role="columnheader">Mobile</strong>
        <strong role="columnheader">Email</strong>
        <strong role="columnheader">Business</strong>
        <strong role="columnheader">Orders</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Created</strong>
      </div>
      {customers.map((customer) => (
        <div
          className="resourceTableRow"
          key={customer.id}
          role="row"
          style={{ gridTemplateColumns }}
        >
          <span role="cell">
            <strong>{customer.name}</strong>
            <em>{customer.addressCount} addresses</em>
          </span>
          <span role="cell">{customer.mobileNumber}</span>
          <span role="cell">{customer.email ?? "-"}</span>
          <span role="cell">
            <strong>{customer.businessName ?? "-"}</strong>
            <em>{customer.gstNumber ?? "No GSTIN"}</em>
          </span>
          <span role="cell">{customer.orderCount}</span>
          <span role="cell">
            <span
              className={`statusBadge statusBadge--${customer.isActive ? "active" : "inactive"}`}
            >
              {customerStatusLabel(customer.isActive)}
            </span>
          </span>
          <span role="cell">{formatCustomerDate(customer.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function PaginationControls({
  hasNextPage,
  hasPreviousPage,
  label,
  onNext,
  onPrevious
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="paginationBar">
      <button
        className="ghostButton"
        disabled={!hasPreviousPage}
        onClick={onPrevious}
        type="button"
      >
        Previous
      </button>
      <span>{label}</span>
      <button
        className="ghostButton"
        disabled={!hasNextPage}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
