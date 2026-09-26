import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type PaginationControlsProps = {
  isPending?: boolean;
  itemLabel?: string;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  page: number;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  totalPages: number;
};

export function PaginationControls({
  isPending = false,
  itemLabel = "Rows per page",
  onChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [],
  totalPages
}: PaginationControlsProps) {
  const hasPageSizeSelector =
    pageSize !== undefined && pageSizeOptions.length > 0 && Boolean(onPageSizeChange);

  if (totalPages <= 1 && !hasPageSizeSelector) {
    return null;
  }

  return (
    <div aria-busy={isPending} className="paginationControls">
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

      <div className="paginationNavigation">
        {isPending ? (
          <span aria-live="polite" className="paginationStatus">
            Updating…
          </span>
        ) : null}
        {totalPages > 1 ? (
          <>
            <Button
              disabled={page <= 1}
              onClick={() => onChange(page - 1)}
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <Pagination page={page} total={totalPages} onChange={onChange} />
            <Button
              disabled={page >= totalPages}
              onClick={() => onChange(page + 1)}
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
