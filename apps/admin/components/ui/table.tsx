import type { ComponentProps } from "react";
import { Table as HeroTable } from "@heroui/table";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  HeroTable;

  return (
    <div className="relative w-full overflow-auto" data-slot="table-container">
      <table
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        data-slot="table"
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead className={cn("[&_tr]:border-b", className)} data-slot="table-header" {...props} />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn("border-t bg-muted font-bold", className)}
      data-slot="table-footer"
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/70", className)}
      data-slot="table-row"
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-11 whitespace-nowrap bg-muted px-4 text-left align-middle text-xs font-extrabold text-foreground",
        className
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-muted-foreground", className)}
      data-slot="table-cell"
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      data-slot="table-caption"
      {...props}
    />
  );
}
