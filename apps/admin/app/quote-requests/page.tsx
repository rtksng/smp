"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  QUOTE_REQUEST_STATUSES,
  buildQuoteRequestQuery,
  createEmptyQuoteRequestFilters,
  formatSupportDateTime,
  formatSupportLabel,
  type AdminQuoteRequest,
  type PaginatedAdminResponse,
  type QuoteRequestFilters,
  type QuoteRequestStatus
} from "../../lib/support-management";

const PAGE_SIZE = 20;

export default function QuoteRequestsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        <QuoteRequestsContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function QuoteRequestsContent() {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<QuoteRequestFilters>(
    createEmptyQuoteRequestFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<QuoteRequestFilters>(
    createEmptyQuoteRequestFilters()
  );
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const quoteQuery = useMemo(
    () => buildQuoteRequestQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );
  const quoteRequestsQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedAdminResponse<AdminQuoteRequest>>(
        "/admin/quote-requests",
        {
          query: quoteQuery
        }
      ),
    queryKey: ["admin", "quote-requests", quoteQuery]
  });
  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status
    }: {
      id: string;
      status: QuoteRequestStatus;
    }) =>
      api.request<AdminQuoteRequest>(`/admin/quote-requests/${id}/status`, {
        body: JSON.stringify({ status }),
        method: "PATCH"
      })
  });
  const quoteRequests = useMemo(
    () => quoteRequestsQuery.data?.items ?? [],
    [quoteRequestsQuery.data?.items]
  );
  const pagination = quoteRequestsQuery.data?.pagination;
  const newVisibleCount = quoteRequests.filter((item) => item.status === "NEW").length;
  const contactedVisibleCount = quoteRequests.filter(
    (item) => item.status === "CONTACTED"
  ).length;
  const closedVisibleCount = quoteRequests.filter(
    (item) => item.status === "CLOSED"
  ).length;
  const error =
    getErrorMessage(quoteRequestsQuery.error) ??
    getErrorMessage(updateStatusMutation.error);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyQuoteRequestFilters();
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshQuoteRequests() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "quote-requests"] });
  }

  async function updateStatus(
    quoteRequest: AdminQuoteRequest,
    status: QuoteRequestStatus
  ) {
    if (quoteRequest.status === status) {
      return;
    }

    await updateStatusMutation.mutateAsync({
      id: quoteRequest.id,
      status
    });
    setMessage("Quote request status updated.");
    await refreshQuoteRequests();
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <Button
                className="iconTextButton"
                onClick={() => void refreshQuoteRequests()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Quote requests"
            summary="Track bulk purchase enquiries and move each lead through follow-up."
            title="Bulk quote queue"
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}

          <div className="metricGrid resourceMetrics">
            <MetricCard label="Total requests" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={quoteRequests.length} />
            <MetricCard label="New visible" tone="primary" value={newVisibleCount} />
            <MetricCard label="Contacted visible" value={contactedVisibleCount} />
            <MetricCard label="Closed visible" tone="warning" value={closedVisibleCount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find quote requests" />
          <form className="productFilters customerFilters" onSubmit={applyFilters}>
            <Select
              aria-label="Status"
              onValueChange={(value) =>
                setDraftFilters({
                  status: value as QuoteRequestFilters["status"]
                })
              }
              value={draftFilters.status}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any status</SelectItem>
                {QUOTE_REQUEST_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatSupportLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="productFilterActions">
              <Button className="iconTextButton" type="submit">
                <Search aria-hidden size={16} />
                <span>Apply</span>
              </Button>
              <Button onClick={resetFilters} type="button" variant="outline">
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader
            eyebrow="Requests"
            level={2}
            title="Customer enquiries"
          />

          {quoteRequestsQuery.isLoading ? (
            <LoadingState label="Loading quote requests..." />
          ) : null}
          {!quoteRequestsQuery.isLoading &&
          !quoteRequestsQuery.isError &&
          quoteRequests.length === 0 ? (
            <EmptyState
              body="No quote requests match the current filters."
              title="No quote requests found"
            />
          ) : null}
          {quoteRequests.length > 0 ? (
            <QuoteRequestsTable
              isUpdating={updateStatusMutation.isPending}
              onStatusChange={updateStatus}
              quoteRequests={quoteRequests}
            />
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

function QuoteRequestsTable({
  isUpdating,
  onStatusChange,
  quoteRequests
}: {
  isUpdating: boolean;
  onStatusChange: (
    quoteRequest: AdminQuoteRequest,
    status: QuoteRequestStatus
  ) => Promise<void>;
  quoteRequests: AdminQuoteRequest[];
}) {
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Request</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Follow-up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quoteRequests.map((quoteRequest) => (
            <TableRow key={quoteRequest.id}>
              <TableCell>
                <strong>{quoteRequest.name}</strong>
                <em>{quoteRequest.organization ?? "Individual customer"}</em>
              </TableCell>
              <TableCell>
                <strong>{quoteRequest.mobileNumber}</strong>
                <em>{quoteRequest.email}</em>
              </TableCell>
              <TableCell>
                <MessageSquare aria-hidden className="mr-2 inline-block" size={16} />
                {quoteRequest.message}
              </TableCell>
              <TableCell>
                <StatusBadge status={quoteRequest.status} />
              </TableCell>
              <TableCell>{formatSupportDateTime(quoteRequest.createdAt)}</TableCell>
              <TableCell>
                <Select
                  aria-label={`Update ${quoteRequest.name} status`}
                  disabled={isUpdating}
                  onValueChange={(value) =>
                    void onStatusChange(quoteRequest, value as QuoteRequestStatus)
                  }
                  value={quoteRequest.status}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_REQUEST_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatSupportLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
