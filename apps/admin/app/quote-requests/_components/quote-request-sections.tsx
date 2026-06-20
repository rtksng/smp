"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  validateQuoteResponseDraft,
  type AdminQuoteRequest,
  type PaginatedAdminResponse,
  type QuoteResponseDraft,
  type QuoteResponseLineFormValues,
  type QuoteRequestFilters,
  type QuoteRequestStatus
} from "../../../lib/support-management";

const PAGE_SIZE = 20;

type QuoteRequestView = "overview" | "requests";

const quoteRequestSections: Array<{
  description: string;
  href: string;
  id: QuoteRequestView;
  title: string;
}> = [
  {
    description: "Quote request metrics and quick access to the response queue.",
    href: "/quote-requests",
    id: "overview",
    title: "Overview"
  },
  {
    description: "Search, filter, update status, and send quotations.",
    href: "/quote-requests/requests",
    id: "requests",
    title: "Requests"
  }
];

const quoteRequestCopy: Record<QuoteRequestView, { summary: string; title: string }> = {
  overview: {
    summary: "Review quote request activity and open the focused quotation response queue.",
    title: "Quote requests"
  },
  requests: {
    summary: "Track bulk purchase enquiries, update statuses, and respond from a selected side panel.",
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
  return <QuoteRequestsContent view="overview" />;
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
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedQuoteRequestId, setSelectedQuoteRequestId] = useState<string | null>(
    null
  );
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteResponseDraft>>({});
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
  const sendQuoteMutation = useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: ReturnType<typeof buildQuoteResponsePayload>;
    }) =>
      api.request<AdminQuoteRequest>(`/admin/quote-requests/${id}/quotation`, {
        body: JSON.stringify(payload),
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
  const quotedVisibleCount = quoteRequests.filter((item) => item.quotation).length;
  const selectedQuoteRequest =
    quoteRequests.find((item) => item.id === selectedQuoteRequestId) ?? null;
  const error =
    formError ??
    getErrorMessage(quoteRequestsQuery.error) ??
    getErrorMessage(updateStatusMutation.error) ??
    getErrorMessage(sendQuoteMutation.error);

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

  function updateDraft(id: string, draft: QuoteResponseDraft) {
    setQuoteDrafts((current) => ({
      ...current,
      [id]: draft
    }));
  }

  async function sendQuotation(quoteRequest: AdminQuoteRequest) {
    const draft = quoteDrafts[quoteRequest.id] ?? quoteRequestToDraft(quoteRequest);
    const errors = validateQuoteResponseDraft(draft);

    if (errors.length > 0) {
      setMessage(null);
      setFormError(errors.join(" "));
      return;
    }

    setFormError(null);
    await sendQuoteMutation.mutateAsync({
      id: quoteRequest.id,
      payload: buildQuoteResponsePayload(draft)
    });
    setMessage("Quotation response sent.");
    await refreshQuoteRequests();
  }

  const pageCopy = quoteRequestCopy[view];

  return (
    <>
      <section className="panel quoteRequestOverviewPanel">
        <QuoteRequestSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              {view === "overview" ? (
                <Button asChild className="iconTextButton">
                  <Link href="/quote-requests/requests">
                    <MessageSquare aria-hidden size={16} />
                    <span>Open requests</span>
                  </Link>
                </Button>
              ) : null}
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
          className="quoteRequestPageHeader"
          eyebrow="Quote requests"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
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

      {view === "overview" ? (
        <QuoteRequestHub
          contactedVisibleCount={contactedVisibleCount}
          newVisibleCount={newVisibleCount}
          quotedVisibleCount={quotedVisibleCount}
          totalRequests={pagination?.total ?? 0}
        />
      ) : null}

      {view === "requests" ? (
        <div
          className={
            selectedQuoteRequest
              ? "quoteRequestWorkspaceGrid"
              : "quoteRequestWorkspaceGrid quoteRequestWorkspaceGrid--single"
          }
        >
          <section className="panel quoteRequestListPanel">
            <PageHeader
              className="settingsSectionHeader"
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
                onSelect={setSelectedQuoteRequestId}
                quoteRequests={quoteRequests}
                selectedQuoteRequestId={selectedQuoteRequestId}
              />
            ) : null}
            {pagination ? (
              <PaginationControls
                onChange={setPage}
                page={pagination.page}
                totalPages={Math.max(pagination.totalPages, 1)}
              />
            ) : null}
          </section>

          {selectedQuoteRequest ? (
            <aside className="panel quoteRequestResponsePanel">
              <QuoteRequestResponsePanel
                draft={
                  quoteDrafts[selectedQuoteRequest.id] ??
                  quoteRequestToDraft(selectedQuoteRequest)
                }
                isSending={sendQuoteMutation.isPending}
                isUpdating={updateStatusMutation.isPending}
                onClose={() => setSelectedQuoteRequestId(null)}
                onDraftChange={(draft) => updateDraft(selectedQuoteRequest.id, draft)}
                onSendQuotation={() => sendQuotation(selectedQuoteRequest)}
                onStatusChange={(status) => updateStatus(selectedQuoteRequest, status)}
                quoteRequest={selectedQuoteRequest}
              />
            </aside>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function QuoteRequestsTable({
  onSelect,
  quoteRequests,
  selectedQuoteRequestId
}: {
  onSelect: (id: string) => void;
  quoteRequests: AdminQuoteRequest[];
  selectedQuoteRequestId: string | null;
}) {
  return (
    <div className="resourceTable quoteRequestTable">
      <Table>
        <TableHeader>
          <TableRow>
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
            <TableRow
              data-active={quoteRequest.id === selectedQuoteRequestId}
              key={quoteRequest.id}
            >
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
                  className="iconTextButton"
                  onClick={() => onSelect(quoteRequest.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <MessageSquare aria-hidden size={16} />
                  <span>Open</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QuoteRequestSectionNav({ active }: { active: QuoteRequestView }) {
  return (
    <nav className="quoteRequestSectionNav" aria-label="Quote request sections">
      {quoteRequestSections.map((section) => (
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

function QuoteRequestHub({
  contactedVisibleCount,
  newVisibleCount,
  quotedVisibleCount,
  totalRequests
}: {
  contactedVisibleCount: number;
  newVisibleCount: number;
  quotedVisibleCount: number;
  totalRequests: number;
}) {
  const cards = [
    {
      description: "Open the table-first quote response queue.",
      href: "/quote-requests/requests",
      metric: totalRequests,
      title: "Request queue"
    },
    {
      description: "Review fresh enquiries that still need first follow-up.",
      href: "/quote-requests/requests",
      metric: newVisibleCount,
      title: "New visible"
    },
    {
      description: "Track customers that have already been contacted.",
      href: "/quote-requests/requests",
      metric: contactedVisibleCount,
      title: "Contacted visible"
    },
    {
      description: "Review requests that already have admin quotation responses.",
      href: "/quote-requests/requests",
      metric: quotedVisibleCount,
      title: "Quoted visible"
    }
  ];

  return (
    <section className="quoteRequestHubGrid">
      {cards.map((card) => (
        <Link className="quoteRequestHubCard" href={card.href} key={card.title}>
          <span>{card.title}</span>
          <strong>{card.metric}</strong>
          <p>{card.description}</p>
        </Link>
      ))}
    </section>
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
  onClose,
  onDraftChange,
  onSendQuotation,
  onStatusChange,
  quoteRequest
}: {
  draft: QuoteResponseDraft;
  isSending: boolean;
  isUpdating: boolean;
  onClose: () => void;
  onDraftChange: (draft: QuoteResponseDraft) => void;
  onSendQuotation: () => Promise<void>;
  onStatusChange: (status: QuoteRequestStatus) => Promise<void>;
  quoteRequest: AdminQuoteRequest;
}) {
  return (
    <>
      <PageHeader
        actions={
          <Button
            className="iconTextButton"
            onClick={onClose}
            type="button"
            variant="outline"
          >
            <span>Close</span>
          </Button>
        }
        className="settingsSectionHeader"
        eyebrow="Quotation"
        level={2}
        summary={quoteRequest.organization ?? quoteRequest.mobileNumber}
        title={quoteRequest.name}
      />
      <div className="quoteRequestPanelMeta">
        <StatusBadge status={quoteRequest.status} />
        <span>{formatSupportDateTime(quoteRequest.createdAt)}</span>
      </div>
      <Select
        aria-label={`Update ${quoteRequest.name} status`}
        disabled={isUpdating}
        onValueChange={(value) => void onStatusChange(value as QuoteRequestStatus)}
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
      <div className="quoteRequestMessageBox">
        <strong>Customer message</strong>
        <p>{quoteRequest.message}</p>
      </div>
      <QuoteResponseEditor
        draft={draft}
        isSending={isSending}
        onChange={onDraftChange}
        onSend={onSendQuotation}
        quoteRequest={quoteRequest}
      />
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
    <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
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
        className="iconTextButton justify-self-start"
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

      <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="grid gap-2 rounded-lg border border-border bg-background p-3 text-sm">
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
        className="iconTextButton justify-self-start"
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
    <div className="grid gap-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
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
