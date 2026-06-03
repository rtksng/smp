import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  onPageChange,
  page,
  totalPages
}: PaginationControlsProps) {
  return (
    <div className="paginationControls">
      <Button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <Pagination
        page={page}
        total={Math.max(totalPages, 1)}
        onChange={onPageChange}
      />
      <Button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        type="button"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}
