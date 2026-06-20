"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AdminShell } from "../../admin-shell";
import { EmptyState } from "@/components/admin/empty-state";
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
  createEmptyCustomerFilters,
  formatCustomerDate,
  formatCustomerStatus,
  getCustomerStatusTone,
  resolveCustomerStatus,
  type AdminCustomer,
  type CustomerFilters,
  type PaginatedCustomerResponse
} from "../../../lib/customer-management";

type CustomersView = "overview" | "list";

const customerSections: Array<{
  description: string;
  href: string;
  id: CustomersView;
  title: string;
}> = [
  {
    description: "Customer metrics and shortcuts into account operations.",
    href: "/customers",
    id: "overview",
    title: "Overview"
  },
  {
    description: "Search, filter, and open customer account detail pages.",
    href: "/customers/list",
    id: "list",
    title: "Customer list"
  }
];

const customerCopy: Record<CustomersView, { summary: string; title: string }> = {
  list: {
    summary: "Search customer accounts by identity, contact, business, or GSTIN in a focused table workspace.",
    title: "Customer list"
  },
  overview: {
    summary: "Review customer coverage and open the focused account list page.",
    title: "Customers"
  }
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
  return <CustomersContent view="overview" />;
}

export function CustomerListPage() {
  return <CustomersContent view="list" />;
}

function CustomersContent({ view }: { view: CustomersView }) {
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

  function applyFilters(event: FormEvent<HTMLFormElement>) {
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

  const pageCopy = customerCopy[view];

  return (
    <>
      <section className="panel customerOverviewPanel">
        <CustomerSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              {view === "overview" ? (
                <Button asChild className="iconTextButton">
                  <Link href="/customers/list">
                    <Search aria-hidden size={16} />
                    <span>Open customers</span>
                  </Link>
                </Button>
              ) : null}
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
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {customersQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(customersQuery.error) ?? "Unable to load customers."}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics customerMetricGrid">
          <MetricCard label="Total customers" tone="primary" value={pagination?.total ?? 0} />
          <MetricCard label="Visible" value={customers.length} />
          <MetricCard label="Active visible" tone="primary" value={activeVisibleCount} />
          <MetricCard label="Inactive visible" tone="warning" value={inactiveVisibleCount} />
          <MetricCard label="GSTIN visible" value={gstVisibleCount} />
        </div>
      </section>

      {view === "overview" ? (
        <CustomerHub
          activeVisibleCount={activeVisibleCount}
          gstVisibleCount={gstVisibleCount}
          inactiveVisibleCount={inactiveVisibleCount}
          totalCustomers={pagination?.total ?? 0}
          visibleCustomers={customers.length}
        />
      ) : null}

      {view === "list" ? (
        <section className="panel customerListPanel">
          <PageHeader
            className="settingsSectionHeader"
            eyebrow="Customer list"
            level={2}
            summary="Filter first, then open a customer detail page for order history, addresses, status actions, and notes."
            title="Accounts and order activity"
          />
          <CustomerFilterForm
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={applyFilters}
          />

          {customersQuery.isLoading ? (
            <LoadingState label="Loading customers..." />
          ) : null}
          {!customersQuery.isLoading && !customersQuery.isError && customers.length === 0 ? (
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
        </section>
      ) : null}
    </>
  );
}

function CustomerSectionNav({ active }: { active: CustomersView }) {
  return (
    <nav className="customerSectionNav" aria-label="Customer sections">
      {customerSections.map((section) => (
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

function CustomerHub({
  activeVisibleCount,
  gstVisibleCount,
  inactiveVisibleCount,
  totalCustomers,
  visibleCustomers
}: {
  activeVisibleCount: number;
  gstVisibleCount: number;
  inactiveVisibleCount: number;
  totalCustomers: number;
  visibleCustomers: number;
}) {
  const cards = [
    {
      description: "Open the searchable table for customer account operations.",
      href: "/customers/list",
      metric: totalCustomers,
      title: "Customer records"
    },
    {
      description: "Review customers in the current visible result set.",
      href: "/customers/list",
      metric: visibleCustomers,
      title: "Visible accounts"
    },
    {
      description: "Open accounts that are currently allowed to place orders.",
      href: "/customers/list",
      metric: activeVisibleCount,
      title: "Active visible"
    },
    {
      description: "Inspect inactive or blocked customer records.",
      href: "/customers/list",
      metric: inactiveVisibleCount,
      title: "Inactive visible"
    },
    {
      description: "Review business accounts with GSTIN details.",
      href: "/customers/list",
      metric: gstVisibleCount,
      title: "GSTIN visible"
    }
  ];

  return (
    <section className="customerHubGrid">
      {cards.map((card) => (
        <Link className="customerHubCard" href={card.href} key={card.title}>
          <span>{card.title}</span>
          <strong>{card.metric}</strong>
          <p>{card.description}</p>
        </Link>
      ))}
    </section>
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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
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
    <div className="resourceTable customerTable">
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
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const status = resolveCustomerStatus(customer);

            return (
              <TableRow key={customer.id}>
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
                  <em>{formatCustomerStatus(status)}</em>
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
