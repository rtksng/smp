import type { ComponentProps } from "react";
import { cn } from "@heroui/theme";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "grid min-w-0 gap-2 text-sm font-semibold leading-tight text-muted-foreground",
        className
      )}
      data-slot="label"
      {...props}
    />
  );
}
