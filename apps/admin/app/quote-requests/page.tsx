"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
  const [formError, setFormError] = useState<string | null>(null);
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
              drafts={quoteDrafts}
              isUpdating={updateStatusMutation.isPending}
              isSending={sendQuoteMutation.isPending}
              onDraftChange={updateDraft}
              onSendQuotation={sendQuotation}
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
  drafts,
  isSending,
  isUpdating,
  onDraftChange,
  onSendQuotation,
  onStatusChange,
  quoteRequests
}: {
  drafts: Record<string, QuoteResponseDraft>;
  isSending: boolean;
  isUpdating: boolean;
  onDraftChange: (id: string, draft: QuoteResponseDraft) => void;
  onSendQuotation: (quoteRequest: AdminQuoteRequest) => Promise<void>;
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
                <div className="grid min-w-[340px] gap-4">
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
                  <QuoteResponseEditor
                    draft={drafts[quoteRequest.id] ?? quoteRequestToDraft(quoteRequest)}
                    isSending={isSending}
                    onChange={(draft) => onDraftChange(quoteRequest.id, draft)}
                    onSend={() => onSendQuotation(quoteRequest)}
                    quoteRequest={quoteRequest}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
