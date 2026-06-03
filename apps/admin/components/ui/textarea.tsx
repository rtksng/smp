import type { ComponentProps } from "react";
import {
  Textarea as HeroTextarea,
  type TextAreaProps as HeroTextareaProps
} from "@heroui/input";
import { cn } from "@/lib/utils";

export function Textarea({ className, value, ...props }: ComponentProps<"textarea">) {
  const heroProps = props as Omit<
    HeroTextareaProps,
    "className" | "classNames" | "radius" | "value" | "variant"
  >;

  return (
    <HeroTextarea
      {...heroProps}
      classNames={{
        input: "min-h-24 resize-y text-foreground placeholder:text-muted-foreground",
        inputWrapper: cn(
          "flex min-h-24 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors shadow-none",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
          "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60",
          className
        )
      }}
      data-slot="textarea"
      radius="sm"
      value={Array.isArray(value) ? value.join(",") : value?.toString()}
      variant="bordered"
    />
  );
}
