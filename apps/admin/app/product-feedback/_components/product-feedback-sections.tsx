"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import {
  PRODUCT_FEEDBACK_STATUSES,
  PRODUCT_QUESTION_MODERATION_STATUSES,
  PRODUCT_REVIEW_MODERATION_STATUSES,
  buildProductFeedbackModerationPayload,
  buildProductFeedbackQuery,
  createEmptyProductFeedbackFilters,
  formatSupportDateTime,
  formatSupportLabel,
  getProductFeedbackStatusTone,
  type AdminProductFeedback,
  type PaginatedAdminResponse,
  type ProductFeedbackFilters,
  type ProductFeedbackStatus
} from "../../../lib/support-management";

import { BulkActions, BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { feedbackBulkActions } from "@/lib/bulk-module-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import "./product-feedback.css";

const PAGE_SIZE = 20;
const PRODUCT_QUESTION_FILTER_STATUSES: ProductFeedbackStatus[] = [
  "PENDING",
  "ANSWERED",
  "HIDDEN"
];

type ProductFeedbackListView = "reviews" | "questions";

const productFeedbackSections: Array<{
  description: string;
  href: string;
  id: ProductFeedbackListView;
  title: string;
}> = [
    {
      description: "Approve, reject, hide, and audit product reviews.",
      href: "/product-feedback",
      id: "reviews",
      title: "Reviews"
    },
    {
      description: "Answer customer questions and manage question visibility.",
      href: "/product-feedback/questions",
      id: "questions",
      title: "Questions"
    }
  ];

const productFeedbackCopy: Record<
  ProductFeedbackListView,
  { summary: string; title: string }
> = {
  questions: {
    summary: "Answer customer product questions and control question visibility from a focused table.",
    title: "Customer questions"
  },
  reviews: {
    summary: "Moderate customer product reviews with product, customer, rating, and status context.",
    title: "Product reviews"
  }
};

export function ProductFeedbackRoute({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        {children}
      </ProtectedRoute>
    </AdminShell>
  );
}

export function ProductFeedbackLandingPage() {
  return <ProductFeedbackDestination view="reviews" />;
}

export function ProductReviewsPage() {
  return <ProductFeedbackDestination view="reviews" />;
}

export function ProductQuestionsPage() {
  return <ProductFeedbackDestination view="questions" />;
}

function ProductFeedbackDestination({ view }: { view: ProductFeedbackListView }) {
  return (
    <Suspense fallback={<LoadingState label="Loading product feedback..." />}>
      <ProductFeedbackUrlContent view={view} />
    </Suspense>
  );
}

function ProductFeedbackUrlContent({ view }: { view: ProductFeedbackListView }) {
  const searchKey = useSearchParams().toString();
  const params = new URLSearchParams(searchKey);
  const status = params.get("status") ?? "";
  const productId = (params.get("productId") ?? "").trim();
  const initialFilters: ProductFeedbackFilters = {
    ...createProductFeedbackFiltersForView(view),
    status: getFeedbackStatusOptions(view).some((item) => item === status)
      ? status as ProductFeedbackStatus
      : "",
    productId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
      ? productId
      : "",
    productSearch: (params.get("productSearch") ?? "").trim().slice(0, 160)
  };
  return <ProductFeedbackContent key={`${view}:${searchKey}`} initialFilters={initialFilters} view={view} />;
}

function ProductFeedbackContent({ view, initialFilters }: {
  view: ProductFeedbackListView;
  initialFilters: ProductFeedbackFilters;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const canAnswer = hasPermission(ADMIN_PERMISSION.ProductsUpdate);
  const [draftFilters, setDraftFilters] =
    useState<ProductFeedbackFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<ProductFeedbackFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [bulkNote, setBulkNote] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [answerDialogItem, setAnswerDialogItem] =
    useState<AdminProductFeedback | null>(null);
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const feedbackQuery = useMemo(
    () => buildProductFeedbackQuery(appliedFilters, page, PAGE_SIZE),
    [appliedFilters, page]
  );
  const feedbackListQuery = useQuery({
    queryFn: () =>
      api.request<PaginatedAdminResponse<AdminProductFeedback>>(
        "/admin/product-feedback",
        {
          query: feedbackQuery
        }
      ),
    queryKey: ["admin", "product-feedback", feedbackQuery]
  });
  const answerMutation = useMutation({
    mutationFn: ({ answer, id }: { answer: string; id: string }) =>
      api.request<AdminProductFeedback>(
        `/admin/product-feedback/questions/${id}/answer`,
        {
          body: JSON.stringify({ answer }),
          method: "PATCH"
        }
      )
  });
  const moderationMutation = useMutation({
    mutationFn: ({
      id,
      status,
      type
    }: {
      id: string;
      status: ProductFeedbackStatus;
      type: AdminProductFeedback["type"];
    }) =>
      api.request<AdminProductFeedback>(
        `/admin/product-feedback/${type === "REVIEW" ? "reviews" : "questions"
        }/${id}/moderation`,
        {
          body: JSON.stringify(
            buildProductFeedbackModerationPayload(status, "")
          ),
          method: "PATCH"
        }
      )
  });
  const feedback = useMemo(
    () => feedbackListQuery.data?.items ?? [],
    [feedbackListQuery.data?.items]
  );
  const pagination = feedbackListQuery.data?.pagination;
  const bulk = useBulkSelection(JSON.stringify([view, appliedFilters]), feedback);
  const bulkActions = feedbackBulkActions(api, view, bulkNote).map((action) => ({ ...action,
    fields: <label>Moderation note (optional)<Input maxLength={500} value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} /></label>
  }));
  const reviewVisibleCount = feedback.filter((item) => item.type === "REVIEW").length;
  const questionVisibleCount = feedback.filter(
    (item) => item.type === "QUESTION"
  ).length;
  const pendingVisibleCount = feedback.filter(
    (item) => item.status === "PENDING" || item.status === "PENDING_REVIEW"
  ).length;
  const hiddenVisibleCount = feedback.filter((item) => item.status === "HIDDEN").length;
  const error =
    getErrorMessage(feedbackListQuery.error) ??
    getErrorMessage(answerMutation.error) ??
    getErrorMessage(moderationMutation.error);
  const pageCopy = productFeedbackCopy[view];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createProductFeedbackFiltersForView(view);
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function refreshFeedback() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "product-feedback"] });
  }

  function updateAnswerDraft(id: string, answer: string) {
    setAnswerDrafts((current) => ({
      ...current,
      [id]: answer
    }));
  }

  function openAnswerDialog(item: AdminProductFeedback) {
    setAnswerDrafts((current) => ({
      ...current,
      [item.id]: item.answer ?? ""
    }));
    setAnswerErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setAnswerDialogItem(item);
  }

  function closeAnswerDialog() {
    if (answerDialogItem) {
      setAnswerErrors((current) => {
        const next = { ...current };
        delete next[answerDialogItem.id];
        return next;
      });
    }

    setAnswerDialogItem(null);
  }

  async function saveAnswer(item: AdminProductFeedback) {
    const answer = (answerDrafts[item.id] ?? item.answer ?? "").trim();

    if (!answer) {
      setAnswerErrors((current) => ({
        ...current,
        [item.id]: "Enter an answer before saving."
      }));
      return;
    }

    setAnswerErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    await answerMutation.mutateAsync({
      answer,
      id: item.id
    });
    setMessage("Product question answered.");
    setAnswerDialogItem(null);
    setAnswerDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    await refreshFeedback();
  }

  async function moderateFeedback(
    item: AdminProductFeedback,
    status: ProductFeedbackStatus
  ) {
    await moderationMutation.mutateAsync({
      id: item.id,
      status,
      type: item.type
    });
    setMessage(`${formatSupportLabel(item.type)} marked ${formatSupportLabel(status)}.`);
    await refreshFeedback();
  }

  async function copyProductId(productId: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(productId);
      setCopiedProductId(productId);
      window.setTimeout(() => {
        setCopiedProductId((current) => (current === productId ? null : current));
      }, 1500);
    }
  }

  return (
    <>
      <section className="panel productFeedbackSummaryPanel">
        <ProductFeedbackSectionNav active={view} />
        <PageHeader
          actions={
            <div className="actionRow">
              <Button
                className="iconTextButton"
                onClick={() => void refreshFeedback()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          }
          className="productFeedbackPageHeader"
          eyebrow="Product feedback"
          summary={pageCopy.summary}
          title={pageCopy.title}
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics productFeedbackMetricGrid">
          <MetricCard label="Total matches" tone="primary" value={pagination?.total ?? 0} />
          <MetricCard label="Visible" value={feedback.length} />
          <MetricCard label="Reviews visible" value={reviewVisibleCount} />
          <MetricCard label="Questions visible" tone="primary" value={questionVisibleCount} />
          <MetricCard label="Pending visible" tone="warning" value={pendingVisibleCount} />
          <MetricCard label="Hidden visible" value={hiddenVisibleCount} />
        </div>
      </section>

      <section className="panel productFeedbackListPanel mt-3">
        <PageHeader
          className="settingsSectionHeader"
          eyebrow={view === "reviews" ? "Review table" : "Question table"}
          level={2}
          summary={
            view === "reviews"
              ? "Filter product reviews by product or moderation status before approving, rejecting, or hiding."
              : "Filter product questions by product or status before answering or hiding them."
          }
          title={view === "reviews" ? "Review moderation" : "Question answers"}
        />
        <ProductFeedbackFilterForm
          filters={draftFilters}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={applyFilters}
          view={view}
        />

        {feedbackListQuery.isLoading ? (
          <LoadingState label={`Loading product ${view}...`} />
        ) : null}
        {canAnswer ? (
          <div className="productFeedbackBulkActions">
            <BulkActions
              key={bulk.scope}
              selection={bulk}
              actions={bulkActions}
              total={pagination?.total ?? 0}
              disabled={
                feedbackListQuery.isFetching ||
                feedbackListQuery.isError ||
                answerMutation.isPending ||
                moderationMutation.isPending
              }
              loadAll={() =>
                loadBulkRows((next, limit) =>
                  api.request<
                    PaginatedAdminResponse<AdminProductFeedback>
                  >("/admin/product-feedback", {
                    query: buildProductFeedbackQuery(
                      appliedFilters,
                      next,
                      limit
                    )
                  })
                )
              }
              getLabel={(item) =>
                `${item.customerName}: ${
                  item.title ||
                  item.question ||
                  item.comment ||
                  item.productName
                }`
              }
              onComplete={refreshFeedback}
            />
          </div>
        ) : null}
        {!feedbackListQuery.isLoading &&
          !feedbackListQuery.isError &&
          feedback.length === 0 ? (
          <EmptyState
            body={`No product ${view} match the selected filters.`}
            title={`No ${view} found`}
          />
        ) : null}
        {feedback.length > 0 ? (
          <ProductFeedbackTable
            bulk={bulk}
            canAnswer={canAnswer}
            copiedProductId={copiedProductId}
            feedback={feedback}
            isSaving={bulk.isBusy || answerMutation.isPending || moderationMutation.isPending}
            onCopyProductId={copyProductId}
            onOpenAnswer={openAnswerDialog}
            onModerate={moderateFeedback}
            view={view}
          />
        ) : null}
        {pagination ? (
          <PaginationControls
            onChange={(next) => { if (!bulk.isBusy) setPage(next); }}
            page={pagination.page}
            totalPages={Math.max(pagination.totalPages, 1)}
          />
        ) : null}
      </section>
      <AnswerQuestionDialog
        answer={
          answerDialogItem
            ? answerDrafts[answerDialogItem.id] ?? answerDialogItem.answer ?? ""
            : ""
        }
        error={
          answerDialogItem ? answerErrors[answerDialogItem.id] ?? null : null
        }
        isOpen={Boolean(answerDialogItem)}
        isSaving={answerMutation.isPending}
        item={answerDialogItem}
        onAnswerChange={(answer) => {
          if (answerDialogItem) {
            updateAnswerDraft(answerDialogItem.id, answer);
          }
        }}
        onClose={closeAnswerDialog}
        onSave={() => {
          if (answerDialogItem) {
            void saveAnswer(answerDialogItem);
          }
        }}
      />
    </>
  );
}

function ProductFeedbackSectionNav({ active }: { active: ProductFeedbackListView }) {
  return (
    <nav className="productFeedbackSectionNav" aria-label="Product feedback sections">
      {productFeedbackSections.map((section) => (
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

function ProductFeedbackFilterForm({
  filters,
  onChange,
  onReset,
  onSubmit,
  view
}: {
  filters: ProductFeedbackFilters;
  onChange: (filters: ProductFeedbackFilters) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  view: ProductFeedbackListView;
}) {
  return (
    <form className="productFilters productFeedbackFilters" onSubmit={onSubmit}>
      <label>
        Product search
        <Input
          onChange={(event) =>
            onChange({
              ...filters,
              productId: "",
              productSearch: event.target.value
            })
          }
          placeholder="Search by product name, SKU, or copied ID"
          value={filters.productSearch || filters.productId}
        />
      </label>
      <label>
        Status
        <Select
          aria-label="Feedback status"
          onValueChange={(value) =>
            onChange({
              ...filters,
              status: value as ProductFeedbackFilters["status"]
            })
          }
          value={filters.status}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any status</SelectItem>
            {getFeedbackStatusOptions(view).map((status) => (
              <SelectItem key={status} value={status}>
                {formatSupportLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <div className="productFilterActions productFeedbackFilterActions">
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

function ProductFeedbackTable({
  bulk,
  canAnswer,
  copiedProductId,
  feedback,
  isSaving,
  onCopyProductId,
  onOpenAnswer,
  onModerate,
  view
}: {
  bulk: BulkSelection<AdminProductFeedback>;
  canAnswer: boolean;
  copiedProductId: string | null;
  feedback: AdminProductFeedback[];
  isSaving: boolean;
  onCopyProductId: (productId: string) => Promise<void>;
  onOpenAnswer: (item: AdminProductFeedback) => void;
  onModerate: (
    item: AdminProductFeedback,
    status: ProductFeedbackStatus
  ) => Promise<void>;
  view: ProductFeedbackListView;
}) {
  const isQuestionView = view === "questions";

  return (
    <div
      className={
        isQuestionView
          ? "resourceTable productFeedbackTable productFeedbackQuestionsTable"
          : "resourceTable productFeedbackTable"
      }
    >
      <p className="productFeedbackTableHint" id="product-feedback-table-hint">
        Swipe horizontally to see every feedback field and moderation action.
      </p>
      <Table
        aria-describedby="product-feedback-table-hint"
        aria-label={isQuestionView ? "Product questions" : "Product reviews"}
        className="productFeedbackDataTable"
        containerClassName="productFeedbackTableViewport"
      >
        <TableHeader>
          <TableRow>
            {canAnswer ? <TableHead className="bulkCheckboxCell"><BulkPageCheckbox selection={bulk} /></TableHead> : null}
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>{isQuestionView ? "Question" : "Review"}</TableHead>
            {isQuestionView ? <TableHead>Answer</TableHead> : null}
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Moderation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedback.map((item) => (
            <TableRow key={item.id}>
              {canAnswer ? <TableCell className="bulkCheckboxCell"><BulkRowCheckbox selection={bulk} item={item} label={`${item.customerName} ${item.productName}`} /></TableCell> : null}
              <TableCell>
                <strong>{item.customerName}</strong>
                <em>{formatSupportLabel(item.type)}</em>
              </TableCell>
              <TableCell>
                <div className="productFeedbackProductCell">
                  <strong title={item.productName || "Product name unavailable"}>
                    {item.productName || "Product name unavailable"}
                  </strong>
                  <button
                    className="copyProductIdButton"
                    onClick={() => void onCopyProductId(item.productId)}
                    type="button"
                  >
                    <Copy aria-hidden size={13} />
                    <span>
                      {copiedProductId === item.productId ? "Copied" : "Copy ID"}
                    </span>
                  </button>
                </div>
              </TableCell>
              <TableCell>
                {item.type === "REVIEW" ? (
                  <>
                    <strong>
                      {item.rating ?? 0}/5 {item.title ?? "Review"}
                    </strong>
                    <em>{item.comment ?? "-"}</em>
                  </>
                ) : (
                  <strong>{item.question ?? "-"}</strong>
                )}
              </TableCell>
              {isQuestionView ? (
                <TableCell>
                  {canAnswer ? (
                    <Button
                      className="answerModalTriggerButton"
                      onClick={() => onOpenAnswer(item)}
                      type="button"
                      variant={item.answer ? "outline" : "default"}
                    >
                      {item.answer ? "View answer" : "Add answer"}
                    </Button>
                  ) : (
                    <em>{item.answer ?? "-"}</em>
                  )}
                </TableCell>
              ) : null}
              <TableCell>
                <StatusBadge status={getProductFeedbackStatusTone(item.status)} />
                {item.moderatedAt ? (
                  <em>Moderated {formatSupportDateTime(item.moderatedAt)}</em>
                ) : null}
              </TableCell>
              <TableCell>{formatSupportDateTime(item.createdAt)}</TableCell>
              <TableCell>
                {canAnswer ? (
                  <div className="feedbackModerationPanel">
                    <div className="feedbackActionGroup">
                      {getModerationActions(item).map((status) => (
                        <Button
                          aria-label={getModerationActionLabel(status)}
                          className="feedbackIconActionButton"
                          disabled={isSaving || item.status === status}
                          key={status}
                          onClick={() => void onModerate(item, status)}
                          size="sm"
                          title={getModerationActionLabel(status)}
                          type="button"
                          variant={
                            status === "PUBLISHED" ? "default" : "outline"
                          }
                        >
                          {getModerationIcon(status)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <em>-</em>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AnswerQuestionDialog({
  answer,
  error,
  isOpen,
  isSaving,
  item,
  onAnswerChange,
  onClose,
  onSave
}: {
  answer: string;
  error: string | null;
  isOpen: boolean;
  isSaving: boolean;
  item: AdminProductFeedback | null;
  onAnswerChange: (answer: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="productFeedbackAnswerDialog"
        isDismissable={!isSaving}
        isKeyboardDismissDisabled={isSaving}
      >
        <form
          className="productFeedbackAnswerDialogForm"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <DialogHeader>
            <DialogTitle>{item?.answer ? "View answer" : "Add answer"}</DialogTitle>
            <DialogDescription>
              {item?.question ?? "Write a customer-facing answer for this product question."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            className="productFeedbackAnswerTextarea"
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Write answer"
            value={answer}
          />
          {error ? <span className="fieldError">{error}</span> : null}
          <DialogFooter className="productFeedbackAnswerDialogFooter">
            <Button
              disabled={isSaving}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button className="iconTextButton" disabled={isSaving} type="submit">
              <CheckCircle2 aria-hidden size={16} />
              <span>{isSaving ? "Saving..." : "Save answer"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createProductFeedbackFiltersForView(
  view: ProductFeedbackListView
): ProductFeedbackFilters {
  const filters = createEmptyProductFeedbackFilters();

  if (view === "reviews") {
    return {
      ...filters,
      type: "REVIEW"
    };
  }

  if (view === "questions") {
    return {
      ...filters,
      type: "QUESTION"
    };
  }

  return filters;
}

function getFeedbackStatusOptions(view: ProductFeedbackListView) {
  if (view === "reviews") {
    return PRODUCT_REVIEW_MODERATION_STATUSES;
  }

  return PRODUCT_FEEDBACK_STATUSES.filter((status) =>
    PRODUCT_QUESTION_FILTER_STATUSES.includes(status)
  );
}

function getModerationActions(item: AdminProductFeedback): ProductFeedbackStatus[] {
  if (item.type === "REVIEW") {
    return PRODUCT_REVIEW_MODERATION_STATUSES.filter(
      (status) => status !== "PENDING_REVIEW"
    );
  }

  return [...PRODUCT_QUESTION_MODERATION_STATUSES];
}

function getModerationActionLabel(status: ProductFeedbackStatus) {
  if (status === "PUBLISHED") {
    return "Approve";
  }

  if (status === "REJECTED") {
    return "Reject";
  }

  if (status === "HIDDEN") {
    return "Hide";
  }

  if (status === "PENDING") {
    return "Reopen";
  }

  return formatSupportLabel(status);
}

function getModerationIcon(status: ProductFeedbackStatus) {
  if (status === "PUBLISHED") {
    return <CheckCircle2 aria-hidden size={14} />;
  }

  if (status === "REJECTED") {
    return <XCircle aria-hidden size={14} />;
  }

  if (status === "HIDDEN") {
    return <EyeOff aria-hidden size={14} />;
  }

  return <RotateCcw aria-hidden size={14} />;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
