"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_CATALOG_BULK_CREATE_ROWS,
  catalogBulkCreateRowHasContent,
  createCatalogBulkCreateRow,
  createCatalogBulkRowsFromNames,
  validateCatalogBulkCreateRows,
  type CatalogBulkCreateKind,
  type CatalogBulkCreatePayload,
  type CatalogBulkCreateRow,
  type CatalogBulkCreateRowErrors
} from "@/lib/catalog-bulk-create";
import { slugifyCatalogName } from "@/lib/catalog-management";
import "./catalog-bulk-create-page.css";

const ROOT_CATEGORY_VALUE = "__bulk_root_category__";
const INITIAL_ROW_COUNT = 3;

type RowResult = {
  message: string;
  status: "creating" | "failed" | "succeeded";
};

type ParentOption = {
  id: string;
  name: string;
};

const EMPTY_PARENT_OPTIONS: readonly ParentOption[] = [];

export function CatalogBulkCreatePage({
  backHref,
  existingSlugs,
  kind,
  onComplete,
  onCreate,
  parentOptions = EMPTY_PARENT_OPTIONS
}: {
  backHref: string;
  existingSlugs: readonly string[];
  kind: CatalogBulkCreateKind;
  onComplete: (createdCount: number) => Promise<unknown> | unknown;
  onCreate: (payload: CatalogBulkCreatePayload) => Promise<unknown>;
  parentOptions?: readonly ParentOption[];
}) {
  const [rows, setRows] = useState<CatalogBulkCreateRow[]>(createInitialRows);
  const [rowErrors, setRowErrors] = useState<
    Record<string, CatalogBulkCreateRowErrors>
  >({});
  const [rowResults, setRowResults] = useState<Record<string, RowResult>>({});
  const [pasteValue, setPasteValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    created: number;
    failed: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRowsToBottomRef = useRef(false);
  const itemLabel = kind === "brand" ? "brand" : "category";
  const itemLabelPlural = kind === "brand" ? "brands" : "categories";
  const filledRowCount = rows.filter(catalogBulkCreateRowHasContent).length;
  const pendingRowCount = rows.filter(
    (row) =>
      catalogBulkCreateRowHasContent(row) && rowResults[row.id]?.status !== "succeeded"
  ).length;

  useEffect(() => {
    if (!shouldScrollRowsToBottomRef.current) {
      return;
    }

    shouldScrollRowsToBottomRef.current = false;
    const rowsContainer = rowsContainerRef.current;

    if (rowsContainer) {
      rowsContainer.scrollTop = rowsContainer.scrollHeight;
    }
  }, [rows.length]);

  function updateRow(
    rowId: string,
    update: (row: CatalogBulkCreateRow) => CatalogBulkCreateRow
  ) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? update(row) : row))
    );
    clearRowFeedback(rowId);
    setNotice(null);
    setSummary(null);
  }

  function clearRowFeedback(rowId: string) {
    setRowErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[rowId];
      return nextErrors;
    });
    setRowResults((currentResults) => {
      const nextResults = { ...currentResults };
      delete nextResults[rowId];
      return nextResults;
    });
  }

  function addBlankRow() {
    if (rows.length >= MAX_CATALOG_BULK_CREATE_ROWS) {
      return;
    }

    shouldScrollRowsToBottomRef.current = true;
    setRows((currentRows) => {
      if (currentRows.length >= MAX_CATALOG_BULK_CREATE_ROWS) {
        return currentRows;
      }

      return [
        ...currentRows,
        createCatalogBulkCreateRow({ sortOrder: String(currentRows.length) })
      ];
    });
    setNotice(null);
  }

  function addPastedNames() {
    const populatedRows = rows.filter(catalogBulkCreateRowHasContent);
    const availableRows = MAX_CATALOG_BULK_CREATE_ROWS - populatedRows.length;
    const pastedRows = createCatalogBulkRowsFromNames(pasteValue, {
      sortOrderStart: populatedRows.length
    });

    if (pastedRows.length === 0) {
      setNotice(`Paste at least one ${itemLabel} name, one per line.`);
      return;
    }

    if (availableRows === 0) {
      setNotice(`You can create up to ${MAX_CATALOG_BULK_CREATE_ROWS} rows at once.`);
      return;
    }

    const acceptedRows = pastedRows.slice(0, availableRows);
    setRows([...populatedRows, ...acceptedRows]);
    setPasteValue("");
    setRowErrors({});
    setSummary(null);
    setNotice(
      acceptedRows.length < pastedRows.length
        ? `Added ${acceptedRows.length} names. The remaining names exceeded the ${MAX_CATALOG_BULK_CREATE_ROWS}-row limit.`
        : `Added ${acceptedRows.length} ${acceptedRows.length === 1 ? itemLabel : itemLabelPlural}.`
    );
  }

  function removeRow(rowId: string) {
    const remainingRows = rows.filter((row) => row.id !== rowId);
    setRows(remainingRows.length > 0 ? remainingRows : [createCatalogBulkCreateRow()]);
    clearRowFeedback(rowId);
    setSummary(null);
  }

  async function submitRows(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const pendingRows = rows.filter(
      (row) =>
        catalogBulkCreateRowHasContent(row) &&
        rowResults[row.id]?.status !== "succeeded"
    );
    const validation = validateCatalogBulkCreateRows(pendingRows, kind, existingSlugs);

    setRowErrors(validation.errors);
    setSummary(null);

    if (validation.candidateCount === 0) {
      setNotice(`Add at least one ${itemLabel} before creating.`);
      return;
    }

    if (validation.validRows.length !== validation.candidateCount) {
      setNotice("Fix the highlighted rows before creating this batch.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setProgress({ completed: 0, total: validation.validRows.length });
    let created = 0;
    let failed = 0;

    for (const [index, validRow] of validation.validRows.entries()) {
      setRowResults((currentResults) => ({
        ...currentResults,
        [validRow.row.id]: {
          message: "Creating...",
          status: "creating"
        }
      }));

      try {
        await onCreate(validRow.payload);
        created += 1;
        setRowResults((currentResults) => ({
          ...currentResults,
          [validRow.row.id]: {
            message: "Created successfully",
            status: "succeeded"
          }
        }));
      } catch (error) {
        failed += 1;
        setRowResults((currentResults) => ({
          ...currentResults,
          [validRow.row.id]: {
            message: getErrorMessage(error) ?? `Unable to create this ${itemLabel}.`,
            status: "failed"
          }
        }));
      }

      setProgress({ completed: index + 1, total: validation.validRows.length });
    }

    if (created > 0) {
      try {
        await onComplete(created);
      } catch {
        setNotice(
          `${created} ${created === 1 ? itemLabel : itemLabelPlural} created, but the list could not refresh automatically.`
        );
      }
    }

    setSummary({ created, failed });
    setIsSubmitting(false);
  }

  return (
    <Card className="panel catalogBulkCreatePage">
      <PageHeader
        backHref={backHref}
        className="catalogBulkCreateHeader catalogFormHeader"
        eyebrow={kind === "brand" ? "Brands" : "Categories"}
        level={2}
        title={`Bulk create ${itemLabelPlural}`}
      />

      <form
        className="catalogBulkCreateForm"
        onSubmit={(event) => void submitRows(event)}
      >
        <div className="catalogBulkCreateToolbar">
          <Label className="catalogBulkPasteField">
            Paste {itemLabel} names
            <Textarea
              aria-label={`Paste ${itemLabel} names`}
              disabled={isSubmitting}
              onChange={(event) => setPasteValue(event.target.value)}
              placeholder={`One ${itemLabel} name per line`}
              rows={3}
              value={pasteValue}
            />
          </Label>
          <Button
            className="iconTextButton catalogBulkPasteButton"
            disabled={isSubmitting || pasteValue.trim().length === 0}
            onClick={addPastedNames}
            type="button"
            variant="outline"
          >
            <Sparkles aria-hidden size={16} />
            <span>Add names</span>
          </Button>
          <div className="catalogBulkCount" aria-label="Bulk row count">
            <strong>{filledRowCount}</strong>
            <span>of {MAX_CATALOG_BULK_CREATE_ROWS} ready</span>
          </div>
        </div>

        {notice ? (
          <p className="catalogBulkNotice" role="status">
            {notice}
          </p>
        ) : null}

        {summary ? (
          <div className="catalogBulkSummary" role="status">
            <span>
              <CheckCircle2 aria-hidden size={16} />
              <strong>{summary.created}</strong> created
            </span>
            <span data-tone={summary.failed > 0 ? "danger" : "neutral"}>
              <CircleAlert aria-hidden size={16} />
              <strong>{summary.failed}</strong> failed
            </span>
          </div>
        ) : null}

        <div
          aria-label={`${itemLabelPlural} to create`}
          className="catalogBulkRows"
          ref={rowsContainerRef}
        >
          {rows.map((row, index) => {
            const errors = rowErrors[row.id];
            const result = rowResults[row.id];
            const isCreated = result?.status === "succeeded";

            return (
              <fieldset
                className="catalogBulkRow"
                data-kind={kind}
                disabled={isSubmitting || isCreated}
                key={row.id}
              >
                <span className="catalogBulkRowNumber">{index + 1}</span>
                <Label className="catalogBulkNameField">
                  Name
                  <Input
                    aria-label={`${capitalize(itemLabel)} name row ${index + 1}`}
                    aria-invalid={Boolean(errors?.name)}
                    onChange={(event) =>
                      updateRow(row.id, (currentRow) => ({
                        ...currentRow,
                        name: event.target.value,
                        slug: currentRow.slugEdited
                          ? currentRow.slug
                          : slugifyCatalogName(event.target.value)
                      }))
                    }
                    placeholder={`${capitalize(itemLabel)} name`}
                    value={row.name}
                  />
                </Label>
                <Label className="catalogBulkSlugField">
                  Slug
                  <Input
                    aria-label={`${capitalize(itemLabel)} slug row ${index + 1}`}
                    aria-invalid={Boolean(errors?.slug)}
                    onChange={(event) =>
                      updateRow(row.id, (currentRow) => ({
                        ...currentRow,
                        slug: event.target.value.toLowerCase(),
                        slugEdited: true
                      }))
                    }
                    placeholder={`${itemLabel}-slug`}
                    value={row.slug}
                  />
                </Label>
                {kind === "category" ? (
                  <Label className="catalogBulkParentField">
                    Parent
                    <Select
                      onValueChange={(value) =>
                        updateRow(row.id, (currentRow) => ({
                          ...currentRow,
                          parentId: value === ROOT_CATEGORY_VALUE ? "" : value
                        }))
                      }
                      value={row.parentId || ROOT_CATEGORY_VALUE}
                    >
                      <SelectTrigger
                        aria-label={`Parent category row ${index + 1}`}
                        aria-invalid={Boolean(errors?.parentId)}
                      >
                        <SelectValue placeholder="Root category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ROOT_CATEGORY_VALUE}>
                          Root category
                        </SelectItem>
                        {parentOptions.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                ) : null}
                {kind === "category" ? (
                  <Label className="catalogBulkSortField">
                    Sort order
                    <Input
                      aria-label={`Sort order row ${index + 1}`}
                      aria-invalid={Boolean(errors?.sortOrder)}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateRow(row.id, (currentRow) => ({
                          ...currentRow,
                          sortOrder: event.target.value
                        }))
                      }
                      value={row.sortOrder}
                    />
                  </Label>
                ) : null}
                <Label className="catalogBulkActiveField">
                  Status
                  <span>
                    <Checkbox
                      aria-label={`${capitalize(itemLabel)} active row ${index + 1}`}
                      checked={row.isActive}
                      onCheckedChange={(checked) =>
                        updateRow(row.id, (currentRow) => ({
                          ...currentRow,
                          isActive: checked === true
                        }))
                      }
                    />
                    Active
                  </span>
                </Label>
                <Button
                  aria-label={`Remove ${itemLabel} row ${index + 1}`}
                  className="catalogBulkRemoveButton"
                  disabled={isSubmitting || isCreated}
                  onClick={() => removeRow(row.id)}
                  size="icon"
                  title="Remove row"
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden size={15} />
                </Button>

                {errors ? (
                  <p className="catalogBulkRowError" role="alert">
                    {Array.from(new Set(Object.values(errors))).join(" ")}
                  </p>
                ) : null}
                {result ? (
                  <p className="catalogBulkRowResult" data-status={result.status}>
                    {result.status === "creating" ? (
                      <LoaderCircle
                        aria-hidden
                        className="catalogBulkSpinner"
                        size={14}
                      />
                    ) : result.status === "succeeded" ? (
                      <CheckCircle2 aria-hidden size={14} />
                    ) : (
                      <CircleAlert aria-hidden size={14} />
                    )}
                    {result.message}
                  </p>
                ) : null}
              </fieldset>
            );
          })}
        </div>

        <div className="catalogBulkCreateFooter">
          <Button
            className="iconTextButton"
            disabled={isSubmitting || rows.length >= MAX_CATALOG_BULK_CREATE_ROWS}
            onClick={addBlankRow}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden size={16} />
            <span>Add row</span>
          </Button>
          <span className="catalogBulkFooterHint">
            Requests are created one at a time so each record keeps normal validation
            and audit history.
          </span>
          <Button asChild variant="outline">
            <Link
              aria-disabled={isSubmitting}
              href={backHref}
              onClick={(event) => {
                if (isSubmitting) event.preventDefault();
              }}
            >
              {summary?.created ? "Done" : "Cancel"}
            </Link>
          </Button>
          <Button disabled={isSubmitting || pendingRowCount === 0} type="submit">
            {isSubmitting ? (
              <>
                <LoaderCircle aria-hidden className="catalogBulkSpinner" size={16} />
                <span>
                  Creating {progress.completed} of {progress.total}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden size={16} />
                <span>
                  Create {pendingRowCount}{" "}
                  {pendingRowCount === 1 ? itemLabel : itemLabelPlural}
                </span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function createInitialRows() {
  return Array.from({ length: INITIAL_ROW_COUNT }, (_, index) =>
    createCatalogBulkCreateRow({ sortOrder: String(index) })
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return null;
}
