type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      className={["block animate-pulse rounded-lg bg-[#cfe9d2]", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-label="Loading products"
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <article
          className="overflow-hidden rounded-[1.25rem] border border-[#cfe9d2] bg-white shadow-sm shadow-[#287c30]/5"
          key={index}
        >
          <Skeleton className="h-44 rounded-none" />
          <div className="grid gap-4 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex justify-between gap-4">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function TableSkeleton({
  columns = 5,
  rows = 4
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      aria-label="Loading table rows"
      className="grid gap-3 rounded-[1.25rem] border border-[#cfe9d2] bg-white p-4 shadow-sm shadow-[#287c30]/5"
      role="status"
    >
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          className="grid gap-3"
          key={rowIndex}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton className="h-5 w-full" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
