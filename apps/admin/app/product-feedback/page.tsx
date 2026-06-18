"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  PRODUCT_FEEDBACK_STATUSES,
  PRODUCT_FEEDBACK_TYPES,
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
} from "../../lib/support-management";

const PAGE_SIZE = 20;

export default function ProductFeedbackPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <ProductFeedbackContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function ProductFeedbackContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const canAnswer = hasPermission(ADMIN_PERMISSION.ProductsUpdate);
  const [draftFilters, setDraftFilters] = useState<ProductFeedbackFilters>(
    createEmptyProductFeedbackFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState<ProductFeedbackFilters>(
    createEmptyProductFeedbackFilters()
  );
  const [page, setPage] = useState(1);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [moderationDrafts, setModerationDrafts] = useState<Record<string, string>>({});
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
      moderationNote,
      status,
      type
    }: {
      id: string;
      moderationNote: string;
      status: ProductFeedbackStatus;
      type: AdminProductFeedback["type"];
    }) =>
      api.request<AdminProductFeedback>(
        `/admin/product-feedback/${
          type === "REVIEW" ? "reviews" : "questions"
        }/${id}/moderation`,
        {
          body: JSON.stringify(
            buildProductFeedbackModerationPayload(status, moderationNote)
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

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters = createEmptyProductFeedbackFilters();
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

  function updateModerationDraft(id: string, note: string) {
    setModerationDrafts((current) => ({
      ...current,
      [id]: note
    }));
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
      moderationNote: moderationDrafts[item.id] ?? "",
      status,
      type: item.type
    });
    setMessage(`${formatSupportLabel(item.type)} marked ${formatSupportLabel(status)}.`);
    setModerationDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    await refreshFeedback();
  }

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <PageHeader
            actions={
              <Button
                className="iconTextButton"
                onClick={() => void refreshFeedback()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
            }
            eyebrow="Product feedback"
            summary="Review customer questions and product reviews from the storefront."
            title="Feedback inbox"
          />

          {message ? <p className="formSuccess">{message}</p> : null}
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}

          <div className="metricGrid resourceMetrics">
            <MetricCard label="Total feedback" tone="primary" value={pagination?.total ?? 0} />
            <MetricCard label="Visible" value={feedback.length} />
            <MetricCard label="Reviews visible" value={reviewVisibleCount} />
            <MetricCard label="Questions visible" tone="primary" value={questionVisibleCount} />
            <MetricCard label="Pending visible" tone="warning" value={pendingVisibleCount} />
            <MetricCard label="Hidden visible" value={hiddenVisibleCount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PageHeader eyebrow="Filters" level={2} title="Find feedback" />
          <form className="productFilters customerFilters" onSubmit={applyFilters}>
            <Select
              aria-label="Feedback type"
              onValueChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  type: value as ProductFeedbackFilters["type"]
                }))
              }
              value={draftFilters.type}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any type</SelectItem>
                {PRODUCT_FEEDBACK_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatSupportLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              aria-label="Feedback status"
              onValueChange={(value) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: value as ProductFeedbackFilters["status"]
                }))
              }
              value={draftFilters.status}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any status</SelectItem>
                {PRODUCT_FEEDBACK_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatSupportLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label>
              Product ID
              <Input
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    productId: event.target.value
                  }))
                }
                placeholder="Filter by product id"
                value={draftFilters.productId}
              />
            </label>
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
          <PageHeader eyebrow="Inbox" level={2} title="Reviews and questions" />

          {feedbackListQuery.isLoading ? (
            <LoadingState label="Loading product feedback..." />
          ) : null}
          {!feedbackListQuery.isLoading &&
          !feedbackListQuery.isError &&
          feedback.length === 0 ? (
            <EmptyState
              body="No product feedback matches the current filters."
              title="No feedback found"
            />
          ) : null}
          {feedback.length > 0 ? (
            <ProductFeedbackTable
              answerDrafts={answerDrafts}
              answerErrors={answerErrors}
              canAnswer={canAnswer}
              feedback={feedback}
              isSaving={answerMutation.isPending || moderationMutation.isPending}
              moderationDrafts={moderationDrafts}
              onAnswerChange={updateAnswerDraft}
              onModerationChange={updateModerationDraft}
              onModerate={moderateFeedback}
              onSaveAnswer={saveAnswer}
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

function ProductFeedbackTable({
  answerDrafts,
  answerErrors,
  canAnswer,
  feedback,
  isSaving,
  moderationDrafts,
  onAnswerChange,
  onModerationChange,
  onModerate,
  onSaveAnswer
}: {
  answerDrafts: Record<string, string>;
  answerErrors: Record<string, string>;
  canAnswer: boolean;
  feedback: AdminProductFeedback[];
  isSaving: boolean;
  moderationDrafts: Record<string, string>;
  onAnswerChange: (id: string, answer: string) => void;
  onModerationChange: (id: string, note: string) => void;
  onModerate: (
    item: AdminProductFeedback,
    status: ProductFeedbackStatus
  ) => Promise<void>;
  onSaveAnswer: (item: AdminProductFeedback) => Promise<void>;
}) {
  return (
    <div className="resourceTable">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Feedback</TableHead>
            <TableHead>Answer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Moderation</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedback.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <strong>{item.customerName}</strong>
                <em>{formatSupportLabel(item.type)}</em>
              </TableCell>
              <TableCell>{item.productId}</TableCell>
              <TableCell>
                {item.type === "REVIEW" ? (
                  <>
                    <strong>{item.rating ?? 0}/5 {item.title ?? "Review"}</strong>
                    <em>{item.comment ?? "-"}</em>
                  </>
                ) : (
                  <strong>{item.question ?? "-"}</strong>
                )}
              </TableCell>
              <TableCell>
                {item.type === "QUESTION" && canAnswer ? (
                  <form
                    className="feedbackAnswerForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onSaveAnswer(item);
                    }}
                  >
                    <Textarea
                      onChange={(event) =>
                        onAnswerChange(item.id, event.target.value)
                      }
                      placeholder="Write answer"
                      value={answerDrafts[item.id] ?? item.answer ?? ""}
                    />
                    {answerErrors[item.id] ? (
                      <span className="fieldError">{answerErrors[item.id]}</span>
                    ) : null}
                    <Button
                      className="iconTextButton"
                      disabled={isSaving || item.status === "HIDDEN"}
                      type="submit"
                    >
                      <CheckCircle2 aria-hidden size={16} />
                      <span>{isSaving ? "Saving..." : "Save answer"}</span>
                    </Button>
                  </form>
                ) : (
                  <em>{item.type === "QUESTION" ? item.answer ?? "-" : "-"}</em>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={getProductFeedbackStatusTone(item.status)} />
                <em>{formatSupportLabel(item.status)}</em>
                {item.moderatedAt ? (
                  <em>Moderated {formatSupportDateTime(item.moderatedAt)}</em>
                ) : null}
                {item.moderationNote ? <em>{item.moderationNote}</em> : null}
              </TableCell>
              <TableCell>
                {canAnswer ? (
                  <div className="feedbackModerationPanel">
                    <Textarea
                      onChange={(event) =>
                        onModerationChange(item.id, event.target.value)
                      }
                      placeholder="Moderation note"
                      value={moderationDrafts[item.id] ?? ""}
                    />
                    <div className="feedbackActionGroup">
                      {getModerationActions(item).map((status) => (
                        <Button
                          className="iconTextButton"
                          disabled={isSaving || item.status === status}
                          key={status}
                          onClick={() => void onModerate(item, status)}
                          size="sm"
                          type="button"
                          variant={status === "PUBLISHED" ? "default" : "outline"}
                        >
                          {getModerationIcon(status)}
                          <span>{getModerationActionLabel(status)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <em>{item.moderationNote ?? "-"}</em>
                )}
              </TableCell>
              <TableCell>{formatSupportDateTime(item.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
