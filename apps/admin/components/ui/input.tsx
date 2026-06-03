import type { ComponentProps } from "react";
import { Input as HeroInput } from "@heroui/input";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  HeroInput;

  return (
    <input
      className={cn(
        "flex min-h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}
