import type { ComponentProps } from "react";
import { input } from "@heroui/theme";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  const inputSlots = input({ size: "md", variant: "bordered" });

  return (
    <label
      className={cn(
        inputSlots.label(),
        "grid gap-2 text-sm font-extrabold text-muted-foreground",
        className
      )}
      data-slot="label"
      {...props}
    />
  );
}
