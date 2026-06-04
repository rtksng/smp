"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
import {
  buildCustomerQuery,
  createEmptyCustomerFilters,
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
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <Button
                className="iconTextButton"
                onClick={() => void customersQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Customers"
            summary="Search customer accounts by identity, contact, business, or GSTIN."
            title="Customer records"
          />

          {customersQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(customersQuery.error) ?? "Unable to load customers."}
            </p>
          ) : null}

          <div className="metricGrid resourceMetrics">
            <MetricCard label="Total customers" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={customers.length} />
            <MetricCard label="Active visible" tone="primary" value={activeVisibleCount} />
            <MetricCard label="Inactive visible" tone="warning" value={inactiveVisibleCount} />
            <MetricCard label="GSTIN visible" value={gstVisibleCount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find customers" />
          <CustomerFilterForm
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={applyFilters}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Customer list" level={2} title="Accounts and order activity" />

          {customersQuery.isLoading ? (
            <LoadingState label="Loading customers..." />
          ) : null}
          {!customersQuery.isLoading && customers.length === 0 ? (
            <EmptyState
              body="No customers match the current filters."
              title="No customers found"
            />
          ) : null}
          {customers.length > 0 ? <CustomerTable customers={customers} /> : null}
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
        <Input
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
            isActive: value as CustomerFilters["isActive"]
          })
        }
        value={filters.isActive}
      >
        <SelectTrigger>
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any</SelectItem>
          <SelectItem value="true">Active</SelectItem>
          <SelectItem value="false">Inactive</SelectItem>
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

function CustomerTable({ customers }: { customers: AdminCustomer[] }) {
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Business</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
      {customers.map((customer) => (
        <TableRow key={customer.id}>
          <TableCell>
            <strong>{customer.name}</strong>
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
            <StatusBadge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
          </TableCell>
          <TableCell>{formatCustomerDate(customer.createdAt)}</TableCell>
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
