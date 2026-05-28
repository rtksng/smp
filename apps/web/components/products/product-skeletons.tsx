import { ProductGridSkeleton, Skeleton } from "../ui/skeleton";

export { ProductGridSkeleton };

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-4">
        <Skeleton className="aspect-square w-full" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="aspect-square" key={index} />
          ))}
        </div>
      </div>
      <div className="grid content-start gap-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-44" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  );
}
