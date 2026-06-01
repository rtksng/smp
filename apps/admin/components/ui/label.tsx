"use client";

import type { ComponentProps } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "grid gap-2 text-sm font-extrabold text-muted-foreground",
        className
      )}
      data-slot="label"
      {...props}
    />
  );
}
