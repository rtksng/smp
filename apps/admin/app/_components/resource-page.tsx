"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import type { QueryParams } from "../../lib/admin-api";

type Metric = {
  label: string;
  tone?: "neutral" | "primary" | "warning";
  value: string;
};

type Column<TItem> = {
  header: string;
  render: (item: TItem) => ReactNode;
};

type ResourcePageProps<TData, TItem> = {
  children?: ReactNode;
  columns?: Array<Column<TItem>>;
  description?: string;
  emptyState?: string;
  endpoint?: string;
  eyebrow: string;
  getMetrics?: (items: TItem[], data: TData | undefined) => Metric[];
  permission: string;
  query?: QueryParams;
  queryKey: readonly unknown[];
  selectItems?: (data: TData) => TItem[];
  title: string;
};

export function ResourcePage<TData, TItem>({
  children,
  columns,
  description,
  emptyState = "No records",
  endpoint,
  eyebrow,
  getMetrics,
  permission,
  query,
  queryKey,
  selectItems,
  title
}: ResourcePageProps<TData, TItem>) {
  const { api } = useAdminSession();
  const queryResult = useQuery({
    enabled: Boolean(endpoint),
    queryFn: () => api.request<TData>(endpoint ?? "", { query }),
    queryKey
  });
  const items =
    queryResult.data && selectItems ? selectItems(queryResult.data) : [];
  const metrics = getMetrics?.(items, queryResult.data) ?? [];
  const errorMessage =
    queryResult.error instanceof Error
      ? queryResult.error.message
      : "Unable to load this admin view.";

  return (
    <AdminShell>
      <ProtectedRoute permission={permission}>
        <PageHeader
          actions={
            endpoint ? (
              <Button
                onClick={() => void queryResult.refetch()}
                type="button"
                variant="outline"
              >
                Refresh
              </Button>
            ) : null
          }
          eyebrow={eyebrow}
          summary={description}
          title={title}
        />

        {queryResult.isLoading ? (
          <LoadingState label={`Loading ${eyebrow.toLowerCase()}...`} />
        ) : null}

        {queryResult.isError ? (
          <Card>
            <CardContent>
              <div className="formError" role="alert">
                {errorMessage}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {metrics.length ? (
          <section className="metricGrid resourceMetrics">
            {metrics.map((metric) => (
              <Card
                className={`metric metric--${metric.tone ?? "neutral"}`}
                key={metric.label}
              >
                <CardContent>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : null}

        {!queryResult.isLoading && columns && items.length === 0 ? (
          <EmptyState body={emptyState} title="No records found" />
        ) : null}

        {!queryResult.isLoading && columns && items.length > 0 ? (
          <Card className="resourceTableCard">
            <CardContent>
              <ResourceTable columns={columns} rows={items} />
            </CardContent>
          </Card>
        ) : null}

        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

function ResourceTable<TItem>({
  columns,
  rows
}: {
  columns: Array<Column<TItem>>;
  rows: TItem[];
}) {
  return (
    <div className="resourceTable">
      <Table style={{ minWidth: `max(720px, ${columns.length * 140}px)` }}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.header}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell key={column.header}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
