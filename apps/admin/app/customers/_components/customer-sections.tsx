"use client";

import { BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { CustomerBulkActions } from "@/components/admin/customer-bulk-actions";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, RefreshCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
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
import {
  buildCustomerQuery,
  CUSTOMER_STATUSES,
  createEmptyCustomerFilters,
  formatCustomerDate,
  formatCustomerStatus,
  getCustomerStatusTone,
  resolveCustomerStatus,
  type AdminCustomer,
  type CustomerFilters,
  type PaginatedCustomerResponse
} from "../../../lib/customer-management";

const customerCopy = {
  summary: "Review customer coverage, filter accounts, and open customer detail pages.",
  title: "Customers"
};

export function CustomersRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.UsersRead}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function CustomersLandingPage() {
  return <CustomersContent />;
}

function CustomersContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const canUpdate = hasPermission(ADMIN_PERMISSION.UsersUpdate);
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(
    createEmptyCustomerFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<CustomerFilters>(
    createEmptyCustomerFilters()
  );
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
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
  const bulk = useBulkSelection(JSON.stringify(appliedFilters), customers);
  const pagination = customersQuery.data?.pagination;
  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) setPage(Math.max(pagination.totalPages, 1));
  }, [page, pagination]);
  const activeVisibleCount = customers.filter((customer) => customer.isActive).length;
  const inactiveVisibleCount = customers.length - activeVisibleCount;

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
  }

  function resetFilters() {
    const emptyFilters = createEmptyCustomerFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  return (
    <>
      <section className="panel customerOverviewPanel">
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
                onClick={() => void customersQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="customerPageHeader"
          eyebrow="Customers"
          summary={customerCopy.summary}
          title={customerCopy.title}
        />

        {customersQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(customersQuery.error) ?? "Unable to load customers."}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics customerMetricGrid">
          <MetricCard label="Total matches" tone="primary" value={pagination?.total ?? 0} />
          <MetricCard label="Visible" value={customers.length} />
          <MetricCard label="Active visible" tone="primary" value={activeVisibleCount} />
          <MetricCard label="Inactive visible" tone="warning" value={inactiveVisibleCount} />
        </div>
      </section>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        isSubmitting={customersQuery.isFetching}
        onApply={applyFilters}
        onOpenChange={setIsFilterDrawerOpen}
        onReset={resetFilters}
        summary="Filter customers by name, mobile, email, business, GSTIN, or account status."
        title="Customer filters"
      >
        <CustomerFilterFields filters={draftFilters} onChange={setDraftFilters} />
      </FilterDrawer>

      <section className="panel customerListPanel mt-3">
        <PageHeader
          className="settingsSectionHeader"
          eyebrow="Customer table"
          level={2}
          title="Accounts and order activity"
        />

        {customersQuery.isLoading ? <LoadingState label="Loading customers..." /> : null}
        {!customersQuery.isLoading && !customersQuery.isError && customers.length === 0 ? (
          <EmptyState
            body="No customers match the current filters."
            title="No customers found"
          />
        ) : null}
        {canUpdate ? <CustomerBulkActions key={bulk.scope} selection={bulk} total={pagination?.total ?? 0}
          disabled={customersQuery.isFetching || customersQuery.isError}
          loadAll={() => loadBulkRows((next, limit) => api.request<PaginatedCustomerResponse>("/admin/customers", { query: buildCustomerQuery(appliedFilters, next, limit) }))}
          onComplete={() => queryClient.invalidateQueries({ queryKey: ["admin", "customers"] })} /> : null}
        {customers.length > 0 ? <CustomerTable customers={customers} bulk={bulk} canUpdate={canUpdate} /> : null}
        {pagination ? (
          <PaginationControls
            onChange={(next) => { if (!bulk.isBusy) setPage(next); }}
            page={pagination.page}
            totalPages={Math.max(pagination.totalPages, 1)}
          />
        ) : null}
      </section>
    </>
  );
}

function CustomerFilterFields({
  filters,
  onChange
}: {
  filters: CustomerFilters;
  onChange: (filters: CustomerFilters) => void;
}) {
  return (
    <div className="filterDrawerFields">
      <label>
        Search
        <Input
          className="filterDrawerControl"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Name, mobile, email, business, GSTIN"
          value={filters.search}
        />
      </label>
      <Select
        aria-label="Status"
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value as CustomerFilters["status"]
          })
        }
        value={filters.status}
      >
        <SelectTrigger className="filterDrawerControl">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any</SelectItem>
          {CUSTOMER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {formatCustomerStatus(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CustomerTable({ customers, bulk, canUpdate }: { customers: AdminCustomer[]; bulk: BulkSelection<AdminCustomer>; canUpdate: boolean }) {
  return (
    <div className="resourceTable customerTable">
      <Table>
        <TableHeader>
          <TableRow>
            {canUpdate ? <TableHead className="bulkCheckboxCell"><BulkPageCheckbox selection={bulk} /></TableHead> : null}
            <TableHead>Customer</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const status = resolveCustomerStatus(customer);

            return (
              <TableRow key={customer.id}>
                {canUpdate ? <TableCell className="bulkCheckboxCell"><BulkRowCheckbox selection={bulk} item={customer} label={customer.name} /></TableCell> : null}
                <TableCell>
                  <Link className="tablePrimaryLink" href={`/customers/${customer.id}`}>
                    {customer.name}
                  </Link>
                  <em>{customer.addressCount} addresses</em>
                </TableCell>
                <TableCell>{customer.mobileNumber}</TableCell>
                <TableCell>{customer.email ?? "-"}</TableCell>
                <TableCell>
                  <strong>{customer.businessName ?? "-"}</strong>
                  <em>{customer.gstNumber ?? "No GSTIN"}</em>
                </TableCell>
                <TableCell>{customer.orderCount}</TableCell>
                <TableCell>
                  <StatusBadge status={getCustomerStatusTone(status)} />
                </TableCell>
                <TableCell>{formatCustomerDate(customer.createdAt)}</TableCell>
                <TableCell>
                  <Button asChild className="iconTextButton" size="sm" variant="outline">
                    <Link href={`/customers/${customer.id}`}>
                      <Eye aria-hidden size={14} />
                      <span>View</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
