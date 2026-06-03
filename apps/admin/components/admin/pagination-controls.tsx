import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type PaginationControlsProps = {
  onChange: (page: number) => void;
  page: number;
  totalPages: number;
};

export function PaginationControls({
  onChange,
  page,
  totalPages
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="paginationControls">
      <Button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        type="button"
        variant="outline"
      >
        Previous
      </Button>
      <Pagination
        page={page}
        total={totalPages}
        onChange={onChange}
      />
      <Button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        type="button"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}
