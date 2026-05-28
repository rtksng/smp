"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
              {description ? <p className="panelSummary">{description}</p> : null}
            </div>
            {endpoint ? (
              <button
                className="ghostButton"
                onClick={() => void queryResult.refetch()}
                type="button"
              >
                Refresh
              </button>
            ) : null}
          </div>

          {queryResult.isLoading ? (
            <div className="loadingBlock">Loading {eyebrow.toLowerCase()}...</div>
          ) : null}
          {queryResult.isError ? (
            <div className="formError" role="alert">
              {errorMessage}
            </div>
          ) : null}

          {metrics.length ? (
            <div className="metricGrid resourceMetrics">
              {metrics.map((metric) => (
                <article
                  className={`metric metric--${metric.tone ?? "neutral"}`}
                  key={metric.label}
                >
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {columns ? (
          <section className="panel">
            <ResourceTable columns={columns} emptyState={emptyState} rows={items} />
          </section>
        ) : null}

        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

function ResourceTable<TItem>({
  columns,
  emptyState,
  rows
}: {
  columns: Array<Column<TItem>>;
  emptyState: string;
  rows: TItem[];
}) {
  const gridTemplateColumns = `repeat(${columns.length}, minmax(140px, 1fr))`;

  return (
    <div className="resourceTable" role="table">
      <div
        className="resourceTableHeader"
        role="row"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => (
          <strong key={column.header} role="columnheader">
            {column.header}
          </strong>
        ))}
      </div>
      {rows.length === 0 ? (
        <div
          className="resourceTableRow"
          role="row"
          style={{ gridTemplateColumns }}
        >
          <span role="cell">{emptyState}</span>
        </div>
      ) : (
        rows.map((row, rowIndex) => (
          <div
            className="resourceTableRow"
            key={rowIndex}
            role="row"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <span key={column.header} role="cell">
                {column.render(row)}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
