"use client";

import { BulkActions, BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { quoteBulkActions } from "@/lib/bulk-resource-actions";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import {
  QUOTE_REQUEST_STATUSES,
  buildQuoteRequestQuery,
  buildQuoteResponsePayload,
  calculateQuoteResponseDraftTotals,
  createEmptyQuoteRequestFilters,
  createEmptyQuoteResponseDraft,
  createEmptyQuoteResponseLine,
  formatSupportDateTime,
  formatSupportLabel,
  formatCurrency,
  getQuoteRequestStatusOptions,
  validateQuoteResponseDraft,
  type AdminQuoteRequest,
  type PaginatedAdminResponse,
  type QuoteResponseDraft,
  type QuoteResponseLineFormValues,
  type QuoteRequestFilters,
  type QuoteRequestStatus
} from "../../../lib/support-management";
import "../quote-requests-responsive.css";

const PAGE_SIZE = 20;

type QuoteRequestView = "requests";

const quoteRequestCopy: Record<QuoteRequestView, { summary: string; title: string }> = {
  requests: {
    summary: "Track bulk purchase enquiries and open each request in a focused edit page.",
    title: "Bulk quote queue"
  }
};

export function QuoteRequestsRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.SettingsManage}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function QuoteRequestsLandingPage() {
  return <QuoteRequestsContent view="requests" />;
}

export function QuoteRequestQueuePage() {
  return <QuoteRequestsContent view="requests" />;
}

function QuoteRequestsContent({ view }: { view: QuoteRequestView }) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<QuoteRequestFilters>(
    createEmptyQuoteRequestFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<QuoteRequestFilters>(
    createEmptyQuoteRequestFilters()
  );
  const [page, setPage] = useState(1);
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
  const quoteRequests = useMemo(
    () => quoteRequestsQuery.data?.items ?? [],
    [quoteRequestsQuery.data?.items]
  );
  const bulk = useBulkSelection(JSON.stringify(appliedFilters), quoteRequests);
  const pagination = quoteRequestsQuery.data?.pagination;
  useEffect(() => {
    if (pagination && page > Math.max(pagination.totalPages, 1)) setPage(Math.max(pagination.totalPages, 1));
  }, [page, pagination]);
  const newVisibleCount = quoteRequests.filter((item) => item.status === "NEW").length;
  const contactedVisibleCount = quoteRequests.filter(
    (item) => item.status === "CONTACTED"
  ).length;
  const closedVisibleCount = quoteRequests.filter(
    (item) => item.status === "CLOSED"
  ).length;
  const quotedVisibleCount = quoteRequests.filter((item) => item.quotation).length;
  const error = getErrorMessage(quoteRequestsQuery.error);

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

  const pageCopy = quoteRequestCopy[view];

  return (
    <div className="quoteRequestModule" data-quote-request-view={view}>
      <section className="panel quoteRequestSummaryPanel">
        <PageHeader
          actions={
            <div className="actionRow quoteRequestHeaderActions">
              <Button
                className="iconTextButton"
                onClick={() => void refreshQuoteRequests()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="quoteRequestPageHeader quoteRequestQueueHeader"
          eyebrow="Quote requests"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics quoteRequestMetricGrid">
          <MetricCard label="Total requests" tone="primary" value={pagination?.total ?? 0} />
          <MetricCard label="Visible" value={quoteRequests.length} />
          <MetricCard label="New visible" tone="primary" value={newVisibleCount} />
          <MetricCard label="Contacted visible" value={contactedVisibleCount} />
          <MetricCard label="Quoted visible" value={quotedVisibleCount} />
          <MetricCard label="Closed visible" tone="warning" value={closedVisibleCount} />
        </div>
      </section>

      <div className="quoteRequestWorkspaceGrid quoteRequestWorkspaceGrid--single">
        <section className="panel quoteRequestListPanel mt-3">
          <PageHeader
            className="settingsSectionHeader quoteRequestSectionHeader"
            eyebrow="Requests"
            level={2}
            summary="Filter the queue, then open one enquiry to update status or send a quotation."
            title="Customer enquiries"
          />

          <QuoteRequestFiltersForm
            filters={draftFilters}
            onChange={setDraftFilters}
            onReset={resetFilters}
            onSubmit={applyFilters}
          />

          {quoteRequestsQuery.isLoading ? (
            <LoadingState label="Loading quote requests..." />
          ) : null}
          <div className="quoteRequestBulkActions">
            <BulkActions
              actions={quoteBulkActions(api)}
              disabled={quoteRequestsQuery.isFetching || quoteRequestsQuery.isError}
              getLabel={(quoteRequest) => quoteRequest.name}
              key={bulk.scope}
              loadAll={() =>
                loadBulkRows((next, limit) =>
                  api.request<PaginatedAdminResponse<AdminQuoteRequest>>(
                    "/admin/quote-requests",
                    {
                      query: buildQuoteRequestQuery(appliedFilters, next, limit)
                    }
                  )
                )
              }
              onComplete={refreshQuoteRequests}
              selection={bulk}
              total={pagination?.total ?? 0}
            />
          </div>
          {!quoteRequestsQuery.isLoading &&
          !quoteRequestsQuery.isError &&
          quoteRequests.length === 0 ? (
            <EmptyState
              body="No quote requests match the current filters."
              title="No quote requests found"
            />
          ) : null}
          {quoteRequests.length > 0 ? (
            <QuoteRequestsTable bulk={bulk} quoteRequests={quoteRequests} />
          ) : null}
          {pagination ? (
            <PaginationControls
              onChange={(next) => { if (!bulk.isBusy) setPage(next); }}
              page={pagination.page}
              totalPages={Math.max(pagination.totalPages, 1)}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function QuoteRequestDetailPage() {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const params = useParams();
  const quoteRequestId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [draft, setDraft] = useState<QuoteResponseDraft>(
    createEmptyQuoteResponseDraft()
  );
  const [message, setMessage] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const quoteRequestQuery = useQuery({
    enabled: Boolean(quoteRequestId),
    queryFn: () =>
      api.request<AdminQuoteRequest>(`/admin/quote-requests/${quoteRequestId}`),
    queryKey: ["admin", "quote-requests", "detail", quoteRequestId]
  });
  const updateStatusMutation = useMutation({
    mutationFn: (status: QuoteRequestStatus) =>
      api.request<AdminQuoteRequest>(
        `/admin/quote-requests/${quoteRequestId}/status`,
        {
          body: JSON.stringify({ status }),
          method: "PATCH"
        }
      )
  });
  const sendQuoteMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildQuoteResponsePayload>) =>
      api.request<AdminQuoteRequest>(
        `/admin/quote-requests/${quoteRequestId}/quotation`,
        {
          body: JSON.stringify(payload),
          method: "PATCH"
        }
      )
  });
  const quoteRequest = quoteRequestQuery.data ?? null;
  const error =
    formError ??
    getErrorMessage(quoteRequestQuery.error) ??
    getErrorMessage(updateStatusMutation.error) ??
    getErrorMessage(sendQuoteMutation.error);

  useEffect(() => {
    const version = quoteRequest ? `${quoteRequest.id}:${quoteRequest.quotation?.respondedAt ?? "new"}` : null;
    if (quoteRequest && version !== draftVersion) {
      setDraft(quoteRequestToDraft(quoteRequest));
      setDraftVersion(version);
    }
  }, [quoteRequest, draftVersion]);

  async function refreshQuoteRequest() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "quote-requests"] });
  }

  async function updateStatus(status: QuoteRequestStatus) {
    if (!quoteRequest || quoteRequest.status === status || updateStatusMutation.isPending || sendQuoteMutation.isPending) {
      return;
    }

    setFormError(null);
    setMessage(null);
    sendQuoteMutation.reset();
    try {
      await updateStatusMutation.mutateAsync(status);
      setMessage("Quote request status updated.");
      await refreshQuoteRequest();
    } catch { /* The mutation error is rendered below. */ }
  }

  async function sendQuotation() {
    if (!quoteRequest || sendQuoteMutation.isPending || updateStatusMutation.isPending) {
      return;
    }

    const errors = validateQuoteResponseDraft(draft);

    if (errors.length > 0) {
      setMessage(null);
      setFormError(errors.join(" "));
      return;
    }

    setFormError(null);
    setMessage(null);
    updateStatusMutation.reset();
    try {
      await sendQuoteMutation.mutateAsync(buildQuoteResponsePayload(draft));
      setMessage("Quotation response sent.");
      await refreshQuoteRequest();
    } catch { /* The mutation error is rendered below. */ }
  }

  return (
    <div className="quoteRequestModule quoteRequestDetailModule">
      <section className="panel quoteRequestDetailPagePanel">
        <PageHeader
          actions={
            <div className="actionRow quoteRequestHeaderActions quoteRequestDetailHeaderActions">
              <Button asChild className="iconTextButton" variant="outline">
                <Link href="/quote-requests">
                  <ArrowLeft aria-hidden size={16} />
                  <span>Back</span>
                </Link>
              </Button>
              <Button
                className="iconTextButton"
                onClick={() => void refreshQuoteRequest()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="quoteRequestPageHeader quoteRequestDetailHeader"
          eyebrow="Quote request"
          summary={
            quoteRequest
              ? `${quoteRequest.mobileNumber} - ${quoteRequest.email}`
              : "Open and edit a customer quotation request."
          }
          title={quoteRequest?.name ?? "Quote request"}
        />

        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {message && !error ? <p className="formSuccess" role="status">{message}</p> : null}
      {quoteRequestQuery.isLoading ? (
        <LoadingState label="Loading quote request..." />
      ) : null}
      {!quoteRequestQuery.isLoading && !quoteRequest ? (
        <EmptyState
          body="The quote request could not be loaded."
          title="Quote request not found"
        />
      ) : null}
      {quoteRequest ? (
        <div className="quoteRequestDetailGrid">
          <section className="panel quoteRequestCustomerPanel">
            <PageHeader
              className="settingsSectionHeader quoteRequestSectionHeader"
              eyebrow="Customer"
              level={2}
              summary="Original enquiry and customer contact details."
              title="Request details"
            />
            <div className="quoteRequestDetailCards">
              <div>
                <span>Name</span>
                <strong>{quoteRequest.name}</strong>
              </div>
              <div>
                <span>Organization</span>
                <strong>{quoteRequest.organization ?? "Individual customer"}</strong>
              </div>
              <div>
                <span>Mobile</span>
                <strong>{quoteRequest.mobileNumber}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{quoteRequest.email}</strong>
              </div>
            </div>
            <div className="quoteRequestPanelMeta">
              <StatusBadge status={quoteRequest.status} />
              <span>Created {formatSupportDateTime(quoteRequest.createdAt)}</span>
            </div>
            <div className="quoteRequestMessageBox">
              <strong>Customer message</strong>
              <p>{quoteRequest.message}</p>
            </div>
          </section>

          <section className="panel quoteRequestResponsePanel quoteRequestEditPanel">
            <QuoteRequestResponsePanel
              draft={draft}
              isSending={sendQuoteMutation.isPending}
              isUpdating={updateStatusMutation.isPending}
              onDraftChange={setDraft}
              onSendQuotation={sendQuotation}
              onStatusChange={updateStatus}
              quoteRequest={quoteRequest}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function QuoteRequestsTable({
  bulk,
  quoteRequests
}: {
  bulk: BulkSelection<AdminQuoteRequest>;
  quoteRequests: AdminQuoteRequest[];
}) {
  return (
    <div className="quoteRequestTableShell">
      <p className="quoteRequestTableHint">Swipe sideways to view every quote request option.</p>
      <div className="resourceTable quoteRequestTable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bulkCheckboxCell">
                <BulkPageCheckbox selection={bulk} />
              </TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Request</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Quotation</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quoteRequests.map((quoteRequest) => (
              <TableRow key={quoteRequest.id}>
                <TableCell className="bulkCheckboxCell">
                  <BulkRowCheckbox
                    item={quoteRequest}
                    label={quoteRequest.name}
                    selection={bulk}
                  />
                </TableCell>
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
                <TableCell>
                  {quoteRequest.quotation ? (
                    <strong>{formatCurrency(quoteRequest.quotation.totals.grandTotal)}</strong>
                  ) : (
                    <em>Not sent</em>
                  )}
                </TableCell>
                <TableCell>{formatSupportDateTime(quoteRequest.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    asChild
                    className="iconTextButton"
                    size="sm"
                    variant="outline"
                  >
                    <Link href={`/quote-requests/${quoteRequest.id}`}>
                      <MessageSquare aria-hidden size={16} />
                      <span>Open</span>
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function QuoteRequestFiltersForm({
  filters,
  onChange,
  onReset,
  onSubmit
}: {
  filters: QuoteRequestFilters;
  onChange: (filters: QuoteRequestFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="productFilters quoteRequestFilters" onSubmit={onSubmit}>
      <Select
        aria-label="Status"
        onValueChange={(value) =>
          onChange({
            status: value as QuoteRequestFilters["status"]
          })
        }
        value={filters.status}
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
        <Button onClick={onReset} type="button" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
}

function QuoteRequestResponsePanel({
  draft,
  isSending,
  isUpdating,
  onDraftChange,
  onSendQuotation,
  onStatusChange,
  quoteRequest
}: {
  draft: QuoteResponseDraft;
  isSending: boolean;
  isUpdating: boolean;
  onDraftChange: (draft: QuoteResponseDraft) => void;
  onSendQuotation: () => Promise<void>;
  onStatusChange: (status: QuoteRequestStatus) => Promise<void>;
  quoteRequest: AdminQuoteRequest;
}) {
  return (
    <>
      <PageHeader
        className="settingsSectionHeader quoteRequestSectionHeader"
        eyebrow="Quotation"
        level={2}
        summary="Update status and prepare the itemized quotation response."
        title="Edit quotation"
      />
      <div className="quoteRequestPanelMeta">
        <StatusBadge status={quoteRequest.status} />
        <span>{formatSupportDateTime(quoteRequest.createdAt)}</span>
      </div>
      <Select
        aria-label={`Update ${quoteRequest.name} status`}
        disabled={isUpdating || isSending || getQuoteRequestStatusOptions(quoteRequest).length === 1}
        onValueChange={(value) => void onStatusChange(value as QuoteRequestStatus)}
        value={quoteRequest.status}
      >
        <SelectTrigger className="quoteRequestStatusTrigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {getQuoteRequestStatusOptions(quoteRequest).map((status) => (
            <SelectItem key={status} value={status}>
              {formatSupportLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(["CLOSED", "CONVERTED"].includes(quoteRequest.status) || quoteRequest.convertedCartId || quoteRequest.convertedOrderId) ? (
        <><ExistingQuoteSummary quoteRequest={quoteRequest} /><p className="text-sm text-muted-foreground">Closed or converted quotations cannot be edited.</p></>
      ) : <fieldset className="min-w-0 border-0 p-0" disabled={isSending || isUpdating}><QuoteResponseEditor
        draft={draft}
        isSending={isSending}
        onChange={onDraftChange}
        onSend={onSendQuotation}
        quoteRequest={quoteRequest}
      /></fieldset>}
    </>
  );
}

function QuoteResponseEditor({
  draft,
  isSending,
  onChange,
  onSend,
  quoteRequest
}: {
  draft: QuoteResponseDraft;
  isSending: boolean;
  onChange: (draft: QuoteResponseDraft) => void;
  onSend: () => Promise<void>;
  quoteRequest: AdminQuoteRequest;
}) {
  const totals = calculateQuoteResponseDraftTotals(draft);

  function updateLine(index: number, nextLine: QuoteResponseLineFormValues) {
    onChange({
      ...draft,
      items: draft.items.map((item, itemIndex) =>
        itemIndex === index ? nextLine : item
      )
    });
  }

  function removeLine(index: number) {
    if (draft.items.length === 1) {
      return;
    }

    onChange({
      ...draft,
      items: draft.items.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  return (
    <div className="quoteRequestResponseEditor grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
      {quoteRequest.quotation ? (
        <ExistingQuoteSummary quoteRequest={quoteRequest} />
      ) : null}

      <div className="grid gap-3">
        {draft.items.map((item, index) => (
          <QuoteLineEditor
            canRemove={draft.items.length > 1}
            index={index}
            item={item}
            key={`${quoteRequest.id}-${index}`}
            onChange={(nextLine) => updateLine(index, nextLine)}
            onRemove={() => removeLine(index)}
          />
        ))}
      </div>

      <Button
        className="iconTextButton quoteRequestAddLineButton justify-self-start"
        onClick={() =>
          onChange({
            ...draft,
            items: [...draft.items, createEmptyQuoteResponseLine()]
          })
        }
        type="button"
        variant="outline"
      >
        <Plus aria-hidden size={16} />
        <span>Add line</span>
      </Button>

      <div className="quoteRequestSupplementGrid grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Shipping total"
          inputMode="decimal"
          onChange={(event) =>
            onChange({
              ...draft,
              shippingTotal: event.target.value
            })
          }
          placeholder="Shipping"
          value={draft.shippingTotal}
        />
        <Input
          aria-label="Valid until"
          onChange={(event) =>
            onChange({
              ...draft,
              validUntil: event.target.value
            })
          }
          type="date"
          value={draft.validUntil}
        />
      </div>

      <Textarea
        aria-label="Quotation notes"
        onChange={(event) =>
          onChange({
            ...draft,
            notes: event.target.value
          })
        }
        placeholder="Notes for the customer"
        value={draft.notes}
      />

      <div className="quoteRequestTotals grid gap-2 rounded-lg border border-border bg-background p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>Subtotal</span>
          <strong>{formatCurrency(totals.subtotal)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Tax</span>
          <strong>{formatCurrency(totals.taxTotal)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Shipping</span>
          <strong>{formatCurrency(totals.shippingTotal)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <span>Total</span>
          <strong>{formatCurrency(totals.grandTotal)}</strong>
        </div>
      </div>

      <Button
        className="iconTextButton quoteRequestSendButton justify-self-start"
        disabled={isSending}
        onClick={() => void onSend()}
        type="button"
      >
        <Send aria-hidden size={16} />
        <span>{quoteRequest.quotation ? "Update quotation" : "Send quotation"}</span>
      </Button>
    </div>
  );
}

function QuoteLineEditor({
  canRemove,
  index,
  item,
  onChange,
  onRemove
}: {
  canRemove: boolean;
  index: number;
  item: QuoteResponseLineFormValues;
  onChange: (item: QuoteResponseLineFormValues) => void;
  onRemove: () => void;
}) {
  function updateField(field: keyof QuoteResponseLineFormValues, value: string) {
    onChange({
      ...item,
      [field]: value
    });
  }

  return (
    <div className="quoteRequestLineEditor grid gap-2 rounded-lg border border-border bg-background p-3">
      <div className="quoteRequestLineHeader flex items-center justify-between gap-3">
        <strong className="text-sm">Line {index + 1}</strong>
        <Button
          aria-label={`Remove line ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden size={16} />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label={`Line ${index + 1} SKU`}
          onChange={(event) => updateField("sku", event.target.value)}
          placeholder="SKU"
          value={item.sku}
        />
        <Input
          aria-label={`Line ${index + 1} item name`}
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="Item name"
          value={item.name}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          aria-label={`Line ${index + 1} quantity`}
          inputMode="numeric"
          onChange={(event) => updateField("quantity", event.target.value)}
          placeholder="Qty"
          value={item.quantity}
        />
        <Input
          aria-label={`Line ${index + 1} unit price`}
          inputMode="decimal"
          onChange={(event) => updateField("unitPrice", event.target.value)}
          placeholder="Unit price"
          value={item.unitPrice}
        />
        <Input
          aria-label={`Line ${index + 1} tax rate`}
          inputMode="decimal"
          onChange={(event) => updateField("taxRate", event.target.value)}
          placeholder="Tax %"
          value={item.taxRate}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label={`Line ${index + 1} product id`}
          onChange={(event) => updateField("productId", event.target.value)}
          placeholder="Product ID for cart"
          value={item.productId}
        />
        <Input
          aria-label={`Line ${index + 1} variant id`}
          onChange={(event) => updateField("variantId", event.target.value)}
          placeholder="Variant ID"
          value={item.variantId}
        />
      </div>
    </div>
  );
}

function ExistingQuoteSummary({
  quoteRequest
}: {
  quoteRequest: AdminQuoteRequest;
}) {
  const quotation = quoteRequest.quotation;

  if (!quotation) {
    return null;
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>Current quotation</strong>
        <span>{formatSupportDateTime(quotation.respondedAt)}</span>
      </div>
      <div className="grid gap-1">
        {quotation.items.map((item, index) => (
          <div className="flex items-start justify-between gap-3" key={`${item.sku}-${index}`}>
            <span>
              {item.quantity} x {item.name}
              <em className="block text-xs text-muted-foreground">{item.sku}</em>
            </span>
            <strong>{formatCurrency(item.lineTotal)}</strong>
          </div>
        ))}
      </div>
      {quotation.notes ? <p className="text-muted-foreground">{quotation.notes}</p> : null}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <span>Total</span>
        <strong>{formatCurrency(quotation.totals.grandTotal)}</strong>
      </div>
      {quoteRequest.customerDecision ? (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={quoteRequest.customerDecision.status} />
          <span>{formatSupportDateTime(quoteRequest.customerDecision.decidedAt)}</span>
        </div>
      ) : null}
      {quoteRequest.convertedCartId ? (
        <p className="text-xs font-semibold text-muted-foreground">
          Cart prepared: {quoteRequest.convertedCartId}
        </p>
      ) : null}
      {quoteRequest.convertedOrderId ? <Link className="text-sm font-semibold underline" href={`/orders/${quoteRequest.convertedOrderId}`}>View converted order</Link> : null}
    </div>
  );
}

function quoteRequestToDraft(quoteRequest: AdminQuoteRequest): QuoteResponseDraft {
  if (!quoteRequest.quotation) {
    return createEmptyQuoteResponseDraft();
  }

  return {
    items: quoteRequest.quotation.items.map((item) => ({
      name: item.name,
      productId: item.productId ?? "",
      quantity: String(item.quantity),
      sku: item.sku,
      taxRate: String(item.taxRate),
      unitPrice: String(item.unitPrice),
      variantId: item.variantId ?? ""
    })),
    notes: quoteRequest.quotation.notes ?? "",
    shippingTotal: String(quoteRequest.quotation.totals.shippingTotal),
    validUntil: quoteRequest.quotation.validUntil?.slice(0, 10) ?? ""
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
