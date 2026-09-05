"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  MAX_BULK_SELECTION,
  processBulkRows,
  type BulkResult
} from "@/lib/bulk-actions";
import type { BulkSelection } from "@/lib/use-bulk-selection";
import "./bulk-actions.css";

export type BulkAction<T> = {
  retryable?: boolean;
  reviewDetail?: (item: T) => string;
  id: string;
  label: string;
  description: string;
  fields?: ReactNode;
  validationError?: string | null;
  destructive?: boolean;
  skipReason: (item: T) => string | null;
  execute: (item: T) => Promise<unknown>;
  artifact?: (
    results: BulkResult<T>[]
  ) => Promise<{ blob: Blob; filename: string } | null>;
};

export function BulkPageCheckbox<T extends { id: string }>({
  selection
}: {
  selection: BulkSelection<T>;
}) {
  return (
    <Checkbox
      aria-label="Select current page"
      checked={selection.pageChecked}
      indeterminate={selection.pageMixed}
      disabled={selection.isBusy}
      onCheckedChange={selection.togglePage}
    />
  );
}

export function BulkRowCheckbox<T extends { id: string }>({
  selection,
  item,
  label
}: {
  selection: BulkSelection<T>;
  item: T;
  label: string;
}) {
  return (
    <Checkbox
      aria-label={`Select ${label}`}
      checked={selection.ids.has(item.id)}
      disabled={
        selection.isBusy ||
        (!selection.ids.has(item.id) && selection.selected.length >= MAX_BULK_SELECTION)
      }
      onCheckedChange={(checked) => selection.toggle(item, checked)}
    />
  );
}

export function BulkActions<T extends { id: string }>({
  selection,
  actions,
  total,
  loadAll,
  getLabel,
  onComplete,
  disabled = false
}: {
  selection: BulkSelection<T>;
  actions: BulkAction<T>[];
  total: number;
  loadAll: () => Promise<T[]>;
  getLabel: (item: T) => string;
  onComplete: () => Promise<unknown>;
  disabled?: boolean;
}) {
  const [actionId, setActionId] = useState("");
  const [review, setReview] = useState<{ action: BulkAction<T>; rows: T[] } | null>(
    null
  );
  const [results, setResults] = useState<BulkResult<T>[]>([]);
  const [resultAction, setResultAction] = useState<BulkAction<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(
    null
  );
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const active = actions.find((action) => action.id === actionId);
  const failed = results.filter((result) => result.status === "failed");

  useEffect(
    () => () => {
      stopped.current = true;
    },
    []
  );
  useEffect(
    () => () => {
      if (download) URL.revokeObjectURL(download.url);
    },
    [download]
  );
  useEffect(() => {
    if (!processing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [processing]);

  async function selectAll() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    selection.setBusy(true);
    setError(null);
    try {
      const rows = await loadAll();
      if (rows.length > MAX_BULK_SELECTION)
        throw new Error(
          `Narrow your filters to ${MAX_BULK_SELECTION} records or fewer.`
        );
      selection.replace(rows);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to select filtered records."
      );
    } finally {
      inFlight.current = false;
      selection.setBusy(false);
    }
  }

  async function process() {
    if (
      !review ||
      inFlight.current ||
      !actions.some((action) => action.id === review.action.id)
    )
      return;
    const snapshot = review;
    inFlight.current = true;
    stopped.current = false;
    selection.setBusy(true);
    setProcessing(true);
    setError(null);
    setDownload(null);
    setResults([]);
    setShowResults(false);
    setResultAction(snapshot.action);
    try {
      const completed = await processBulkRows(
        snapshot.rows,
        snapshot.action,
        setResults,
        () => stopped.current
      );
      const processedIds = new Set(snapshot.rows.map((row) => row.id));
      selection.replace([
        ...selection.selected.filter((item) => !processedIds.has(item.id)),
        ...completed
          .filter((result) => result.status !== "succeeded")
          .map((result) => result.item)
      ]);
      if (snapshot.action.artifact) {
        const artifact = await snapshot.action.artifact(completed);
        if (artifact)
          setDownload({
            url: URL.createObjectURL(artifact.blob),
            filename: artifact.filename
          });
      }
      await onComplete();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to refresh results."
      );
    } finally {
      inFlight.current = false;
      selection.setBusy(false);
      setProcessing(false);
      setReview(null);
      setShowResults(true);
    }
  }

  if (!actions.length) return null;
  const eligible = review?.rows.filter((row) => !review.action.skipReason(row)) ?? [];
  return (
    <div className="bulkActions" aria-label="Bulk actions">
      <div className="bulkActionBar">
        <div className="bulkSelectionSummary">
          <strong aria-live="polite">{selection.selected.length} selected</strong>
          <span className="bulkSelectionHint">
            Select across pages · maximum {MAX_BULK_SELECTION}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || selection.isBusy || !total}
          onClick={() => void selectAll()}
        >
          Select all {total} filtered
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selection.isBusy || !selection.selected.length}
          onClick={selection.clear}
        >
          Clear selection
        </Button>
      </div>
      {selection.selected.length > 0 ? (
        <div className="bulkActionForm">
          <Select
            aria-label="Bulk action"
            value={active?.id ?? ""}
            disabled={selection.isBusy || disabled}
            onValueChange={setActionId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an action" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {active ? (
            <>
              <p className="bulkSelectionHint">{active.description}</p>
              <fieldset className="bulkFields" disabled={selection.isBusy || disabled}>
                {active.fields}
              </fieldset>
              {active.validationError ? (
                <p className="formError">{active.validationError}</p>
              ) : null}
            </>
          ) : null}
          <Button
            type="button"
            disabled={
              !active || Boolean(active.validationError) || selection.isBusy || disabled
            }
            onClick={() => {
              if (active) setReview({ action: active, rows: [...selection.selected] });
            }}
          >
            Review selected
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="formError" role="alert">
          {error}
        </p>
      ) : null}
      {results.length > 0 && !processing ? (
        <Button
          className="bulkResultsTrigger"
          type="button"
          variant="outline"
          onClick={() => setShowResults(true)}
        >
          View last results
        </Button>
      ) : null}
      <Dialog open={showResults && !review} onOpenChange={setShowResults}>
        <DialogContent className="bulkReviewDialog" hideCloseButton>
          <DialogHeader>
            <DialogTitle>Processing results</DialogTitle>
            <DialogDescription>
              {resultAction?.label}. Review the outcome for each selected record.
            </DialogDescription>
          </DialogHeader>
          <div className="bulkResultTotals" role="status">
            <div data-status="succeeded">
              <strong>{results.filter((r) => r.status === "succeeded").length}</strong>
              <span>Succeeded</span>
            </div>
            <div data-status="skipped">
              <strong>{results.filter((r) => r.status === "skipped").length}</strong>
              <span>Skipped</span>
            </div>
            <div data-status="failed">
              <strong>{failed.length}</strong>
              <span>Failed</span>
            </div>
          </div>
          {error ? (
            <p className="formError" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="bulkResultList">
            {results.map((result) => (
              <li key={result.item.id}>
                <div className="bulkResultHeading">
                  <strong>{getLabel(result.item)}</strong>
                  <span className="bulkResultBadge" data-status={result.status}>
                    {result.status}
                  </span>
                </div>
                <span className="bulkResultMessage">{result.message}</span>
              </li>
            ))}
          </ul>
          {failed.length > 0 ? (
            <p className="bulkSelectionHint">
              Check failed records before retrying; a connection failure may have
              happened after a change was saved.
            </p>
          ) : null}
          <DialogFooter>
            {download ? (
              <Button asChild>
                <a href={download.url} download={download.filename}>
                  Download {download.filename}
                </a>
              </Button>
            ) : null}
            {failed.length > 0 &&
            resultAction?.retryable !== false &&
            resultAction &&
            actions.some((action) => action.id === resultAction.id) ? (
              <Button
                type="button"
                variant="outline"
                disabled={selection.isBusy || disabled}
                onClick={() => {
                  setShowResults(false);
                  setReview({
                    action: resultAction,
                    rows: failed.map((result) => result.item)
                  });
                }}
              >
                Review failed records
              </Button>
            ) : null}
            <Button type="button" onClick={() => setShowResults(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !processing) setReview(null);
        }}
      >
        <DialogContent
          className="bulkReviewDialog"
          hideCloseButton
          isDismissable={false}
          isKeyboardDismissDisabled
        >
          <DialogHeader>
            <DialogTitle>{review?.action.label ?? "Review bulk action"}</DialogTitle>
            <DialogDescription>{review?.action.description}</DialogDescription>
          </DialogHeader>
          <div className="bulkReviewSummary">
            <strong>{eligible.length} ready to process</strong>
            <span>{(review?.rows.length ?? 0) - eligible.length} will be skipped</span>
          </div>
          {processing ? (
            <p role="status">
              Processed {results.length} of {review?.rows.length}. Keep this page open.
            </p>
          ) : null}
          <ul className="bulkResultList">
            {review?.rows.map((item) => (
              <li key={item.id}>
                <div className="bulkResultHeading">
                  <strong>{getLabel(item)}</strong>
                  <span
                    className="bulkResultBadge"
                    data-status={
                      review.action.skipReason(item) ? "skipped" : "succeeded"
                    }
                  >
                    {review.action.skipReason(item) ? "Skip" : "Ready"}
                  </span>
                </div>
                <span className="bulkResultMessage">
                  {review.action.skipReason(item) ??
                    review.action.reviewDetail?.(item) ??
                    "Eligible for this action"}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            {processing ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  stopped.current = true;
                }}
              >
                Stop remaining
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setReview(null)}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant={review?.action.destructive ? "destructive" : "default"}
                  disabled={
                    !eligible.length ||
                    !actions.some((action) => action.id === review?.action.id)
                  }
                  onClick={() => void process()}
                >
                  Process {eligible.length}{" "}
                  {eligible.length === 1 ? "record" : "records"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
