import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  ariaLabel?: string;
  isPending?: boolean;
  itemLabel?: string;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  page: number;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  totalItems?: number;
  totalPages: number;
};

/**
 * Shared table pagination: range summary, optional page-size selector, and numbered pages.
 * Phones swap the numbered list for a compact "Page x of y" label between Previous and Next.
 */
export function PaginationControls({
  ariaLabel = "Pagination",
  isPending = false,
  itemLabel = "Rows per page",
  onChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [],
  totalItems,
  totalPages
}: PaginationControlsProps) {
  const pageCount = Math.max(totalPages, 1);
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const hasPageSizeSelector =
    pageSize !== undefined && pageSizeOptions.length > 0 && Boolean(onPageSizeChange);
  const hasSummary = totalItems !== undefined && totalItems > 0;

  if (pageCount <= 1 && !hasPageSizeSelector && !hasSummary) {
    return null;
  }

  function goTo(nextPage: number) {
    if (nextPage >= 1 && nextPage <= pageCount && nextPage !== currentPage) {
      onChange(nextPage);
    }
  }

  return (
    <div aria-busy={isPending} className="paginationControls">
      {hasSummary || hasPageSizeSelector ? (
        <div className="paginationMeta">
          {hasSummary ? (
            <p className="paginationSummary">
              {getRangeSummary(currentPage, pageSize, totalItems)}
            </p>
          ) : null}
          {hasPageSizeSelector ? (
            <label className="paginationPageSize">
              <span>{itemLabel}</span>
              <select
                aria-label={itemLabel}
                onChange={(event) => onPageSizeChange?.(Number(event.target.value))}
                value={pageSize}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      {isPending ? (
        <span aria-live="polite" className="paginationStatus">
          Updating…
        </span>
      ) : null}

      {pageCount > 1 ? (
        <nav aria-label={ariaLabel} className="paginationNavigation">
          <Button
            aria-label="Previous"
            className="paginationStepButton"
            disabled={currentPage <= 1}
            onClick={() => goTo(currentPage - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden size={16} />
            <span>Previous</span>
          </Button>

          <ol className="paginationPages">
            {getPaginationItems(currentPage, pageCount).map((item) =>
              typeof item === "number" ? (
                <li key={item}>
                  <Button
                    aria-current={item === currentPage ? "page" : undefined}
                    aria-label={`Go to page ${item}`}
                    className="paginationPageButton"
                    onClick={() => goTo(item)}
                    size="sm"
                    type="button"
                    variant={item === currentPage ? "default" : "outline"}
                  >
                    {item}
                  </Button>
                </li>
              ) : (
                <li aria-hidden className="paginationEllipsis" key={item}>
                  …
                </li>
              )
            )}
          </ol>

          <span className="paginationCompactStatus">
            Page {currentPage} of {pageCount}
          </span>

          <Button
            aria-label="Next"
            className="paginationStepButton"
            disabled={currentPage >= pageCount}
            onClick={() => goTo(currentPage + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <span>Next</span>
            <ChevronRight aria-hidden size={16} />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

function getRangeSummary(page: number, pageSize: number | undefined, totalItems = 0) {
  if (!pageSize) {
    return `${totalItems.toLocaleString("en-IN")} total`;
  }

  const start = Math.min((page - 1) * pageSize + 1, totalItems);
  const end = Math.min(page * pageSize, totalItems);

  return `Showing ${start.toLocaleString("en-IN")}–${end.toLocaleString("en-IN")} of ${totalItems.toLocaleString("en-IN")}`;
}

/** Seven slots at most: first, last, the current page with one neighbour each side, and ellipses. */
export function getPaginationItems(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "end-ellipsis", totalPages] as const;
  }

  if (page >= totalPages - 3) {
    return [
      1,
      "start-ellipsis",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    ] as const;
  }

  return [1, "start-ellipsis", page - 1, page, page + 1, "end-ellipsis", totalPages] as const;
}
